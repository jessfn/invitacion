import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const COOKIE = 'dgtic_dispositivo';
const UN_ANIO = 60 * 60 * 24 * 365;

// Secreto persistente para firmar cookies y anonimizar IPs.
export function cargarSecreto(ruta) {
  if (process.env.SECRETO) return process.env.SECRETO;
  mkdirSync(dirname(ruta), { recursive: true });
  if (existsSync(ruta)) return readFileSync(ruta, 'utf8').trim();
  const nuevo = randomBytes(32).toString('hex');
  writeFileSync(ruta, nuevo, { mode: 0o600 });
  return nuevo;
}

export function crearSeguridad({ secreto, confiarProxy }) {
  const firmar = (txt) => createHmac('sha256', secreto).update(txt).digest('base64url');

  const iguales = (a, b) => {
    const A = Buffer.from(a);
    const B = Buffer.from(b);
    return A.length === B.length && timingSafeEqual(A, B);
  };

  // La IP nunca se guarda en claro: solo un HMAC irreversible.
  const hashIp = (ip) => createHmac('sha256', secreto).update(`ip:${ip}`).digest('hex').slice(0, 32);

  function ipDe(req) {
    if (confiarProxy) {
      const xff = req.headers['x-forwarded-for'];
      if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? 'desconocida';
  }

  function leerCookies(req) {
    const out = {};
    for (const par of (req.headers.cookie ?? '').split(';')) {
      const i = par.indexOf('=');
      if (i > 0) out[par.slice(0, i).trim()] = par.slice(i + 1).trim();
    }
    return out;
  }

  // Cookie: <id>.<timestamp>.<firma>
  function leerDispositivo(req) {
    const valor = leerCookies(req)[COOKIE];
    if (!valor) return null;
    const [id, ts, firma] = valor.split('.');
    if (!id || !ts || !firma) return null;
    if (!iguales(firma, firmar(`${id}.${ts}`))) return null;
    return { id, desde: Number(ts) };
  }

  function nuevaCookie(esHttps) {
    const id = randomBytes(16).toString('hex');
    const ts = Date.now();
    const valor = `${id}.${ts}.${firmar(`${id}.${ts}`)}`;
    const attrs = [`${COOKIE}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${UN_ANIO}`];
    if (esHttps) attrs.push('Secure');
    return { id, desde: ts, header: attrs.join('; ') };
  }

  return { hashIp, ipDe, leerDispositivo, nuevaCookie };
}

// Limitador sencillo en memoria: ventana deslizante por clave.
export function crearLimitador({ ventanaMs, maximo }) {
  const golpes = new Map();
  setInterval(() => {
    const corte = Date.now() - ventanaMs;
    for (const [k, v] of golpes) if (v[v.length - 1] < corte) golpes.delete(k);
  }, ventanaMs).unref();

  return (clave) => {
    const ahora = Date.now();
    const lista = (golpes.get(clave) ?? []).filter((t) => t > ahora - ventanaMs);
    lista.push(ahora);
    golpes.set(clave, lista);
    return lista.length <= maximo;
  };
}
