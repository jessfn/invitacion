import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

// PostgreSQL en producción (DATABASE_URL). Sin DATABASE_URL se usa PGlite, un PostgreSQL
// embebido que guarda los datos en data/pgdata, para desarrollar sin instalar nada.
async function conectar({ url, dirDatos }) {
  if (url) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
    return {
      motor: 'postgres',
      consulta: (sql, params) => pool.query(sql, params),
      async transaccion(fn) {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const r = await fn((sql, params) => c.query(sql, params));
          await c.query('COMMIT');
          return r;
        } catch (err) {
          await c.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          c.release();
        }
      }
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const ruta = join(dirDatos, 'pgdata');
  mkdirSync(dirDatos, { recursive: true });
  const local = new PGlite(ruta);
  await local.waitReady;
  return {
    motor: 'pglite',
    consulta: (sql, params) => local.query(sql, params),
    transaccion: (fn) => local.transaction((t) => fn((sql, params) => t.query(sql, params)))
  };
}

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS votantes (
    id        BIGSERIAL PRIMARY KEY,
    device_id TEXT   NOT NULL UNIQUE,
    huella    TEXT   NOT NULL,
    ip_hash   TEXT   NOT NULL,
    creado    BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_votantes_huella_ip ON votantes (huella, ip_hash);
  CREATE INDEX IF NOT EXISTS idx_votantes_ip ON votantes (ip_hash);
  CREATE INDEX IF NOT EXISTS idx_votantes_creado ON votantes (creado);

  CREATE TABLE IF NOT EXISTS respuestas (
    votante_id BIGINT NOT NULL REFERENCES votantes (id) ON DELETE CASCADE,
    pregunta   TEXT   NOT NULL,
    valor      TEXT   NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_respuestas_votante ON respuestas (votante_id);
  CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON respuestas (pregunta, valor);

  ALTER TABLE votantes ADD COLUMN IF NOT EXISTS dudoso BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE votantes ADD COLUMN IF NOT EXISTS coincide_con BIGINT;

  CREATE TABLE IF NOT EXISTS bloqueos (
    creado BIGINT NOT NULL,
    motivo TEXT   NOT NULL
  );
`;

export async function abrirDb({ url, dirDatos }) {
  const bd = await conectar({ url, dirDatos });
  await bd.consulta('SELECT 1');
  // Se crea el esquema en una transacción con candado para que dos arranques simultáneos no choquen.
  await bd.transaccion(async (q) => {
    await q('SELECT pg_advisory_xact_lock(7102026)');
    for (const sentencia of ESQUEMA.split(';').map((x) => x.trim()).filter(Boolean)) await q(sentencia);
  });

  const uno = async (sql, params) => (await bd.consulta(sql, params)).rows[0];

  return {
    motor: bd.motor,

    // Voto previo de este mismo navegador (cookie o token firmado). Es una identidad única y
    // aleatoria, así que nunca confunde a dos personas: es lo único que bloquea de forma firme.
    async buscarVoto({ deviceId }) {
      if (!deviceId) return null;
      const r = await uno('SELECT id FROM votantes WHERE device_id = $1', [deviceId]);
      return r ? { motivo: 'dispositivo', id: r.id } : null;
    },

    async registrarBloqueo(motivo) {
      await bd.consulta('INSERT INTO bloqueos (creado, motivo) VALUES ($1, $2)', [Date.now(), motivo]);
    },

    async bloqueos() {
      const filas = (await bd.consulta('SELECT motivo, COUNT(*)::int AS n FROM bloqueos GROUP BY motivo')).rows;
      return Object.fromEntries(filas.map((f) => [f.motivo, Number(f.n)]));
    },

    // Inserta el voto y sus respuestas en una transacción. El candado asesor serializa
    // los votos, así las comprobaciones de duplicados no pueden competir entre sí.
    async registrarVoto({ deviceId, huella, ipHash, filas, maxPorIp, estricto, huellaSola = false, confirmo = false }) {
      try {
        return await bd.transaccion(async (q) => {
          await q('SELECT pg_advisory_xact_lock(7102027)');
          if ((await q('SELECT 1 FROM votantes WHERE device_id = $1', [deviceId])).rows.length) {
            return { ok: false, motivo: 'dispositivo' };
          }
          // La huella NO bloquea: un teléfono idéntico de otra persona en la misma red daría la misma.
          // Si coincide con un voto anterior se pide una confirmación y el voto queda marcado como dudoso.
          let coincide = null;
          if (estricto && huella) {
            const previa = huellaSola
              ? await q('SELECT id FROM votantes WHERE huella = $1 ORDER BY id LIMIT 1', [huella])
              : await q('SELECT id FROM votantes WHERE huella = $1 AND ip_hash = $2 ORDER BY id LIMIT 1', [huella, ipHash]);
            coincide = previa.rows[0]?.id ?? null;
            if (coincide && !confirmo) return { ok: false, motivo: 'confirmar' };
          }
          const { rows } = await q('SELECT COUNT(*)::int AS n FROM votantes WHERE ip_hash = $1', [ipHash]);
          if (Number(rows[0].n) >= maxPorIp) return { ok: false, motivo: 'ip' };
          const ins = await q(
            'INSERT INTO votantes (device_id, huella, ip_hash, creado, dudoso, coincide_con) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [deviceId, huella, ipHash, Date.now(), Boolean(coincide), coincide]
          );
          const id = ins.rows[0].id;
          for (const [pregunta, valor] of filas) {
            await q('INSERT INTO respuestas (votante_id, pregunta, valor) VALUES ($1, $2, $3)', [id, pregunta, valor]);
          }
          return { ok: true };
        });
      } catch (err) {
        if (err.code === '23505' || String(err.message).includes('unique')) return { ok: false, motivo: 'dispositivo' };
        throw err;
      }
    },

    async respuestasDe(votanteId) {
      return (await bd.consulta('SELECT pregunta, valor FROM respuestas WHERE votante_id = $1', [votanteId])).rows;
    },

    // Datos del panel de administración, con filtros cruzados y rango de fechas.
    // filtros: [[pregunta, valor], ...] -> solo votantes que dieron TODAS esas respuestas.
    async panel(filtros = [], desde = 0, sinDudosos = false) {
      const donde = ['TRUE'];
      const params = [];
      if (sinDudosos) donde.push('v.dudoso = FALSE');
      if (desde > 0) {
        params.push(desde);
        donde.push(`v.creado >= $${params.length}`);
      }
      for (const [pregunta, valor] of filtros) {
        params.push(pregunta, valor);
        donde.push(`v.id IN (SELECT votante_id FROM respuestas WHERE pregunta = $${params.length - 1} AND valor = $${params.length})`);
      }
      const cond = donde.join(' AND ');
      const total = Number((await uno(`SELECT COUNT(*)::int AS n FROM votantes v WHERE ${cond}`, params)).n);
      const conteos = (
        await bd.consulta(
          `SELECT r.pregunta, r.valor, COUNT(*)::int AS n FROM respuestas r
           JOIN votantes v ON v.id = r.votante_id WHERE ${cond} GROUP BY r.pregunta, r.valor`,
          params
        )
      ).rows.map((r) => ({ pregunta: r.pregunta, valor: r.valor, n: Number(r.n) }));
      const tiempos = (await bd.consulta(`SELECT v.creado FROM votantes v WHERE ${cond} ORDER BY v.creado`, params)).rows.map((r) =>
        Number(r.creado)
      );
      const dudosos = Number((await uno(`SELECT COUNT(*)::int AS n FROM votantes v WHERE ${cond} AND v.dudoso`, params)).n);
      return { total, conteos, tiempos, dudosos };
    }
  };
}
