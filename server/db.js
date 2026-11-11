import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function abrirDb(ruta) {
  mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS votantes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT    NOT NULL UNIQUE,
      huella    TEXT    NOT NULL,
      ip_hash   TEXT    NOT NULL,
      creado    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_votantes_huella_ip ON votantes (huella, ip_hash);
    CREATE INDEX IF NOT EXISTS idx_votantes_ip ON votantes (ip_hash);

    CREATE TABLE IF NOT EXISTS respuestas (
      votante_id INTEGER NOT NULL REFERENCES votantes (id) ON DELETE CASCADE,
      pregunta   TEXT    NOT NULL,
      valor      TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON respuestas (pregunta, valor);
  `);

  const q = {
    porDispositivo: db.prepare('SELECT id FROM votantes WHERE device_id = ?'),
    porHuellaIp: db.prepare('SELECT id FROM votantes WHERE huella = ? AND ip_hash = ?'),
    contarIp: db.prepare('SELECT COUNT(*) AS n FROM votantes WHERE ip_hash = ?'),
    nuevoVotante: db.prepare(
      'INSERT INTO votantes (device_id, huella, ip_hash, creado) VALUES (?, ?, ?, ?)'
    ),
    nuevaRespuesta: db.prepare(
      'INSERT INTO respuestas (votante_id, pregunta, valor) VALUES (?, ?, ?)'
    ),
    respuestasDe: db.prepare('SELECT pregunta, valor FROM respuestas WHERE votante_id = ?'),
    conteos: db.prepare(
      'SELECT pregunta, valor, COUNT(*) AS n FROM respuestas GROUP BY pregunta, valor'
    ),
    total: db.prepare('SELECT COUNT(*) AS n FROM votantes'),
    textos: db.prepare(
      'SELECT valor, COUNT(*) AS n FROM respuestas WHERE pregunta = ? GROUP BY valor ORDER BY n DESC, valor'
    )
  };

  return {
    buscarVoto({ deviceId, huella, ipHash }) {
      if (deviceId && q.porDispositivo.get(deviceId)) return 'dispositivo';
      if (huella && q.porHuellaIp.get(huella, ipHash)) return 'huella';
      return null;
    },
    votosDeIp: (ipHash) => q.contarIp.get(ipHash).n,
    votantePorDispositivo: (deviceId) => q.porDispositivo.get(deviceId)?.id ?? null,

    // Inserta el voto y sus respuestas en una sola transacción.
    // Las comprobaciones se repiten dentro de la transacción para evitar carreras.
    registrarVoto({ deviceId, huella, ipHash, filas, maxPorIp, estricto }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (q.porDispositivo.get(deviceId)) {
          db.exec('ROLLBACK');
          return { ok: false, motivo: 'dispositivo' };
        }
        if (estricto && q.porHuellaIp.get(huella, ipHash)) {
          db.exec('ROLLBACK');
          return { ok: false, motivo: 'huella' };
        }
        if (q.contarIp.get(ipHash).n >= maxPorIp) {
          db.exec('ROLLBACK');
          return { ok: false, motivo: 'ip' };
        }
        const { lastInsertRowid } = q.nuevoVotante.run(deviceId, huella, ipHash, Date.now());
        for (const [pregunta, valor] of filas) q.nuevaRespuesta.run(lastInsertRowid, pregunta, valor);
        db.exec('COMMIT');
        return { ok: true };
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {}
        if (String(err.message).includes('UNIQUE')) return { ok: false, motivo: 'dispositivo' };
        throw err;
      }
    },

    respuestasDe: (votanteId) => q.respuestasDe.all(votanteId),
    conteos: () => q.conteos.all(),
    totalVotantes: () => q.total.get().n,
    textos: (pregunta) => q.textos.all(pregunta)
  };
}
