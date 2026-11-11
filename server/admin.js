import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { ENCUESTAS } from './datos.js';
import { crearLimitador } from './seguridad.js';

const COOKIE = 'dgtic_admin';
const DURACION = 8 * 60 * 60 * 1000;

export function hashClave(clave, sal = randomBytes(16)) {
  return { sal: sal.toString('hex'), hash: scryptSync(clave, sal, 64).toString('hex') };
}

// Credenciales: variables de entorno ADMIN_USER / ADMIN_PASS, o data/admin.json
// (creado con `npm run admin:crear -- usuario clave`). La clave nunca se guarda en texto plano.
function cargarCredenciales(ruta) {
  if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
    return { usuario: process.env.ADMIN_USER, ...hashClave(process.env.ADMIN_PASS) };
  }
  if (existsSync(ruta)) {
    try {
      return JSON.parse(readFileSync(ruta, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

const sha = (t) => createHash('sha256').update(String(t)).digest();

export function crearAdmin({ db, seg, json, leerCuerpo, cabeceras, rutaCredenciales }) {
  const creds = cargarCredenciales(rutaCredenciales);
  const limitaLogin = crearLimitador({ ventanaMs: 15 * 60_000, maximo: 8 });
  const clientes = new Set();

  const esHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);

  function verificar(usuario, clave) {
    if (!creds) return false;
    // Se calcula siempre el hash para no revelar si el usuario existe por tiempo de respuesta.
    const calculado = scryptSync(String(clave), Buffer.from(creds.sal, 'hex'), 64);
    const hashOk = timingSafeEqual(calculado, Buffer.from(creds.hash, 'hex'));
    const userOk = timingSafeEqual(sha(usuario), sha(creds.usuario));
    return hashOk && userOk;
  }

  function autenticado(req) {
    const valor = seg.leerCookies(req)[COOKIE];
    if (!valor) return false;
    const [exp, firma] = valor.split('.');
    if (!exp || !firma || Number(exp) < Date.now()) return false;
    return seg.iguales(firma, seg.firmar(`admin:${exp}`));
  }

  function cookieSesion(req) {
    const exp = Date.now() + DURACION;
    const attrs = [`${COOKIE}=${exp}.${seg.firmar(`admin:${exp}`)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${DURACION / 1000}`];
    if (esHttps(req)) attrs.push('Secure');
    return attrs.join('; ');
  }

  function filtrosDe(url) {
    const crudo = url.searchParams.get('f') ?? '';
    const filtros = [];
    for (const par of crudo.split(',').filter(Boolean).slice(0, 6)) {
      const i = par.indexOf(':');
      const pregunta = par.slice(0, i);
      const valor = par.slice(i + 1);
      const enc = ENCUESTAS.find((e) => e.id === pregunta);
      if (enc?.opciones?.some((o) => o.id === valor)) filtros.push([pregunta, valor]);
    }
    const desde = Number(url.searchParams.get('desde'));
    return { filtros, desde: Number.isFinite(desde) && desde > 0 ? desde : 0 };
  }

  function datos(url) {
    const { filtros, desde } = filtrosDe(url);
    const filtrado = db.panel(filtros, desde);
    const global = db.panel([], 0);
    const mapa = new Map(filtrado.conteos.map((c) => [`${c.pregunta}\u0001${c.valor}`, c.n]));
    const preguntas = ENCUESTAS.filter((e) => e.opciones).map((e) => ({
      id: e.id,
      seccion: e.seccion,
      titulo: e.titulo,
      icono: e.icono,
      tipo: e.tipo,
      max: e.max,
      respondieron: filtrado.conteos
        .filter((c) => c.pregunta === e.id)
        .reduce((a, c) => a + (e.tipo === 'unica' ? c.n : 0), 0),
      opciones: e.opciones.map((o) => ({ id: o.id, label: o.label, votos: mapa.get(`${e.id}\u0001${o.id}`) ?? 0 }))
    }));
    const lista = (clave) =>
      filtrado.conteos
        .filter((c) => c.pregunta === clave)
        .map((c) => ({ valor: c.valor, n: c.n }))
        .sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor, 'es'));
    const textos = ENCUESTAS.flatMap((e) => {
      const salida = [];
      if (e.tipo === 'cancion') salida.push({ id: e.id, titulo: 'Canciones pedidas', respuestas: lista(e.id) });
      if (e.otro) salida.push({ id: `${e.id}_otro`, titulo: `${e.titulo} · «Otro»`, respuestas: lista(`${e.id}_otro`) });
      return salida;
    });
    return {
      total: filtrado.total,
      totalGlobal: global.total,
      filtros: filtros.map(([p, v]) => ({ pregunta: p, valor: v })),
      preguntas,
      textos,
      tiempos: filtrado.tiempos,
      generado: Date.now()
    };
  }

  function notificar() {
    for (const res of clientes) res.write('event: voto\ndata: {}\n\n');
  }

  setInterval(() => { for (const res of clientes) res.write(': ping\n\n'); }, 25_000).unref();

  async function manejar(req, res, ruta) {
    const ipHash = seg.hashIp(seg.ipDe(req));
    const headers = { 'X-Robots-Tag': 'noindex, nofollow' };
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'POST' && ruta === '/api/admin/login') {
      if (!limitaLogin(ipHash)) return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' }, headers);
      if (!/^application\/json/.test(req.headers['content-type'] ?? '')) return json(res, 415, { error: 'Tipo no soportado.' }, headers);
      const origen = req.headers.origin;
      if (origen && new URL(origen).host !== req.headers.host) return json(res, 403, { error: 'Origen no permitido.' }, headers);
      const { usuario, clave } = await leerCuerpo(req, 1024);
      if (typeof usuario !== 'string' || typeof clave !== 'string' || usuario.length > 80 || clave.length > 200) {
        return json(res, 400, { error: 'Datos inválidos.' }, headers);
      }
      if (!verificar(usuario, clave)) {
        await new Promise((r) => setTimeout(r, 500));
        return json(res, 401, { error: 'Usuario o contraseña incorrectos.' }, headers);
      }
      return json(res, 200, { ok: true }, { ...headers, 'Set-Cookie': cookieSesion(req) });
    }

    if (!autenticado(req)) return json(res, 401, { error: 'No autorizado.' }, headers);

    if (req.method === 'POST' && ruta === '/api/admin/salir') {
      return json(res, 200, { ok: true }, { ...headers, 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
    }

    if (req.method === 'GET' && ruta === '/api/admin/datos') {
      return json(res, 200, datos(url), headers);
    }

    if (req.method === 'GET' && ruta === '/api/admin/stream') {
      res.writeHead(200, {
        ...cabeceras,
        ...headers,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      });
      res.write('retry: 3000\n\n');
      clientes.add(res);
      req.on('close', () => clientes.delete(res));
      return;
    }

    return json(res, 404, { error: 'No encontrado.' }, headers);
  }

  return { manejar, notificar, configurado: Boolean(creds) };
}
