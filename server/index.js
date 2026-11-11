import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENCUESTAS, ENCUESTAS_POR_ID, EVENTO } from './datos.js';
import { abrirDb } from './db.js';
import { cargarSecreto, crearLimitador, crearSeguridad } from './seguridad.js';
import { crearAdmin } from './admin.js';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLICO = join(RAIZ, 'public');
const DATOS = join(RAIZ, 'data');

const PUERTO = Number(process.env.PORT ?? 3000);
const MAX_POR_IP = Number(process.env.MAX_VOTOS_POR_IP ?? 15);
const ESTRICTO = process.env.MODO_ESTRICTO !== '0';
const MIN_SEGUNDOS = Number(process.env.MIN_SEGUNDOS ?? 6);

const db = await abrirDb({ url: process.env.DATABASE_URL, dirDatos: DATOS });
const seg = crearSeguridad({
  secreto: cargarSecreto(join(DATOS, 'secreto.key')),
  confiarProxy: process.env.TRUST_PROXY === '1'
});
const limitaApi = crearLimitador({ ventanaMs: 60_000, maximo: 90 });
const limitaVoto = crearLimitador({ ventanaMs: 10 * 60_000, maximo: 8 });

let admin;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const CABECERAS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; " +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function json(res, estado, cuerpo, extra = {}) {
  const data = JSON.stringify(cuerpo);
  res.writeHead(estado, {
    ...CABECERAS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extra
  });
  res.end(data);
}

function leerCuerpo(req, limite = 8 * 1024) {
  return new Promise((ok, fallo) => {
    let total = 0;
    const trozos = [];
    req.on('data', (t) => {
      total += t.length;
      if (total > limite) {
        fallo(Object.assign(new Error('Cuerpo demasiado grande'), { estado: 413 }));
        req.destroy();
      } else trozos.push(t);
    });
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}'));
      } catch {
        fallo(Object.assign(new Error('JSON inválido'), { estado: 400 }));
      }
    });
    req.on('error', fallo);
  });
}

const esHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
const HUELLA_OK = /^[a-f0-9]{16,64}$/;

// Identifica al visitante y, si no trae cookie válida, le entrega una nueva.
function identificar(req) {
  const ip = seg.ipDe(req);
  const huella = String(req.headers['x-huella'] ?? '').toLowerCase();
  let dispositivo = seg.leerDispositivo(req);
  let setCookie;
  if (!dispositivo) {
    const nueva = seg.nuevaCookie(esHttps(req));
    dispositivo = { id: nueva.id, desde: nueva.desde };
    setCookie = nueva.header;
  }
  return {
    ip,
    ipHash: seg.hashIp(ip),
    huella: HUELLA_OK.test(huella) ? huella : null,
    dispositivo,
    setCookie
  };
}

// Valida y normaliza las respuestas contra la definición de encuestas.
function validar(respuestas) {
  if (typeof respuestas !== 'object' || respuestas === null || Array.isArray(respuestas)) {
    return { error: 'Formato de respuestas inválido.' };
  }
  for (const k of Object.keys(respuestas)) {
    const base = k.endsWith('_otro') ? k.slice(0, -5) : k;
    if (!ENCUESTAS_POR_ID.has(base)) return { error: 'Pregunta desconocida.' };
  }
  const limpiar = (t, max) => {
    // eslint-disable-next-line no-control-regex
    const x = t.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
    return x.length <= max ? x : null;
  };
  const filas = [];
  for (const enc of ENCUESTAS) {
    const bruto = respuestas[enc.id];
    if (enc.tipo === 'cancion') {
      if (bruto == null) continue;
      if (typeof bruto !== 'object' || Array.isArray(bruto)) return { error: 'Canción inválida.' };
      const artista = typeof bruto.artista === 'string' ? limpiar(bruto.artista, enc.maxLength) : '';
      const tema = typeof bruto.tema === 'string' ? limpiar(bruto.tema, enc.maxLength) : '';
      if (artista === null || tema === null) return { error: 'Texto demasiado largo.' };
      if (!artista && !tema) continue;
      if (!artista || !tema) return { error: 'Escribe el artista y el nombre de la canción.' };
      filas.push([enc.id, `${artista} — ${tema}`]);
      continue;
    }
    if (enc.tipo === 'texto') {
      if (bruto == null || bruto === '') continue;
      if (typeof bruto !== 'string') return { error: 'Respuesta de texto inválida.' };
      // eslint-disable-next-line no-control-regex
      const limpio = bruto.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
      if (limpio.length > enc.maxLength) return { error: 'Texto demasiado largo.' };
      if (limpio) filas.push([enc.id, limpio]);
      continue;
    }
    const lista = enc.tipo === 'unica' ? [bruto] : bruto;
    if (!Array.isArray(lista) && enc.tipo !== 'unica') return { error: 'Respuesta múltiple inválida.' };
    const ids = new Set(enc.opciones.map((o) => o.id));
    const unicos = [...new Set(lista)];
    if (unicos.length === 0 || (enc.tipo === 'unica' && unicos.length !== 1)) {
      return { error: `Falta responder: ${enc.titulo}.` };
    }
    if (enc.tipo === 'multiple' && unicos.length > enc.max) {
      return { error: `Máximo ${enc.max} opciones en: ${enc.titulo}.` };
    }
    if (!unicos.every((v) => typeof v === 'string' && ids.has(v))) return { error: 'Opción inválida.' };
    if (unicos.includes('ninguna') && unicos.length > 1) return { error: 'Selección contradictoria.' };
    for (const v of unicos) filas.push([enc.id, v]);
    if (enc.otro && unicos.includes('otro')) {
      const crudo = respuestas[`${enc.id}_otro`];
      const texto = typeof crudo === 'string' ? limpiar(crudo, 60) : '';
      if (!texto) return { error: `Escribe cuál en: ${enc.titulo}.` };
      filas.push([`${enc.id}_otro`, texto]);
    }
  }
  return { filas };
}

// Lo que ve el votante: solo sus propias elecciones, sin conteos ni porcentajes.
function misRespuestas(propias) {
  const por = new Map();
  for (const { pregunta, valor } of propias) por.set(pregunta, [...(por.get(pregunta) ?? []), valor]);
  return {
    preguntas: ENCUESTAS.map((e) => {
      const otro = por.get(`${e.id}_otro`)?.[0];
      return {
        id: e.id,
        titulo: e.titulo,
        icono: e.icono,
        mias: (por.get(e.id) ?? []).map((v) =>
          v === 'otro' && otro ? `Otro: ${otro}` : (e.opciones?.find((o) => o.id === v)?.label ?? v)
        )
      };
    }).filter((p) => p.mias.length)
  };
}

async function api(req, res, ruta) {
  if (req.method === 'GET' && ruta === '/api/salud') return json(res, 200, { ok: true });
  if (ruta.startsWith('/api/admin/')) return admin.manejar(req, res, ruta);
  const id = identificar(req);
  const extra = id.setCookie ? { 'Set-Cookie': id.setCookie } : {};
  if (!limitaApi(id.ipHash)) return json(res, 429, { error: 'Demasiadas solicitudes.' }, extra);

  const yaVoto = () =>
    db.buscarVoto({
      deviceId: id.dispositivo.id,
      huella: ESTRICTO ? id.huella : null,
      ipHash: id.ipHash
    });

  if (req.method === 'GET' && ruta === '/api/evento') {
    const catalogo = ENCUESTAS.map((e) => ({ ...e }));
    return json(res, 200, { evento: EVENTO, encuestas: catalogo, yaVoto: Boolean(await yaVoto()) }, extra);
  }

  if (req.method === 'GET' && ruta === '/api/resultados') {
    if (!(await yaVoto())) return json(res, 403, { error: 'Vota primero para ver los resultados.' }, extra);
    const votanteId = await db.votantePorDispositivo(id.dispositivo.id);
    return json(res, 200, misRespuestas(votanteId ? await db.respuestasDe(votanteId) : []), extra);
  }

  if (req.method === 'POST' && ruta === '/api/votar') {
    if (!limitaVoto(id.ipHash)) return json(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' }, extra);
    if (!/^application\/json/.test(req.headers['content-type'] ?? '')) {
      return json(res, 415, { error: 'Tipo de contenido no soportado.' }, extra);
    }
    const origen = req.headers.origin;
    if (origen && new URL(origen).host !== req.headers.host) {
      return json(res, 403, { error: 'Origen no permitido.' }, extra);
    }
    const cuerpo = await leerCuerpo(req);

    // Trampa para bots: el campo real está oculto para personas.
    if (cuerpo.sitio) return json(res, 400, { error: 'Solicitud rechazada.' }, extra);
    if (!id.huella) return json(res, 400, { error: 'No se pudo verificar tu dispositivo.' }, extra);
    // Debe haber cargado la invitación antes (cookie con sello de tiempo del servidor).
    if (id.setCookie || Date.now() - id.dispositivo.desde < MIN_SEGUNDOS * 1000) {
      return json(res, 400, { error: 'Lee la invitación y responde con calma, intenta de nuevo.' }, extra);
    }

    const { filas, error } = validar(cuerpo.respuestas);
    if (error) return json(res, 422, { error }, extra);

    const r = await db.registrarVoto({
      deviceId: id.dispositivo.id,
      huella: id.huella,
      ipHash: id.ipHash,
      filas,
      maxPorIp: MAX_POR_IP,
      estricto: ESTRICTO
    });
    if (!r.ok) {
      const msg =
        r.motivo === 'ip'
          ? 'Se alcanzó el límite de votos desde esta red.'
          : 'Este celular ya registró sus respuestas.';
      return json(res, r.motivo === 'ip' ? 429 : 409, { error: msg, yaVoto: r.motivo !== 'ip' }, extra);
    }
    admin.notificar();
    return json(res, 201, { ok: true }, extra);
  }

  return json(res, 404, { error: 'No encontrado.' }, extra);
}

async function estatico(req, res, ruta) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...CABECERAS, Allow: 'GET, HEAD' });
    return res.end();
  }
  let rel;
  try {
    rel = decodeURIComponent(ruta);
  } catch {
    res.writeHead(400, CABECERAS);
    return res.end();
  }
  if (rel.includes('\0')) {
    res.writeHead(400, CABECERAS);
    return res.end();
  }
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const archivo = normalize(join(PUBLICO, rel));
  if (archivo !== PUBLICO && !archivo.startsWith(PUBLICO + sep)) {
    res.writeHead(403, CABECERAS);
    return res.end();
  }
  try {
    const info = await stat(archivo);
    if (!info.isFile()) throw new Error('no es archivo');
    const ext = extname(archivo).toLowerCase();
    res.writeHead(200, {
      ...CABECERAS,
      ...(archivo.endsWith('admin.html') ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-cache' : 'public, max-age=86400'
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(archivo).pipe(res);
  } catch {
    const cuerpo = await readFile(join(PUBLICO, 'index.html'));
    // Rutas desconocidas sin extensión vuelven a la invitación; lo demás es 404.
    if (extname(rel)) {
      res.writeHead(404, { ...CABECERAS, 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('No encontrado');
    }
    res.writeHead(200, { ...CABECERAS, 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
    res.end(cuerpo);
  }
}

admin = crearAdmin({ db, seg, json, leerCuerpo, cabeceras: CABECERAS, rutaCredenciales: join(DATOS, 'admin.json') });

const servidor = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname.startsWith('/api/')) await api(req, res, pathname);
    else await estatico(req, res, pathname);
  } catch (err) {
    const estado = err.estado ?? 500;
    if (estado === 500) console.error(err);
    if (!res.headersSent) json(res, estado, { error: estado === 500 ? 'Error interno.' : err.message });
    else res.end();
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Invitación DGTIC 2026 lista en http://localhost:${PUERTO} (base de datos: ${db.motor})`);
  console.log(admin.configurado ? `Panel de administración: http://localhost:${PUERTO}/admin` : 'Crea el administrador con: npm run admin:crear -- usuario clave');
});
