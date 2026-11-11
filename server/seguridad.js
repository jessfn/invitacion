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

  // Identidad del dispositivo: <id>.<timestamp>.<firma>. Viaja en una cookie y, como respaldo,
  // en la cabecera X-Dispositivo (el navegador la guarda también en localStorage). Si alguien borra
  // solo las cookies, el servidor lo reconoce igual por esa cabecera, porque la firma no se puede falsificar.
  const FORMATO = /^[a-f0-9]{32}\.\d{10,16}\.[A-Za-z0-9_-]{43}$/;
  function parsear(valor) {
    if (typeof valor !== 'string' || !FORMATO.test(valor)) return null;
    const [id, ts, firma] = valor.split('.');
    if (!iguales(firma, firmar(`${id}.${ts}`))) return null;
    return { id, desde: Number(ts), valor };
  }

  function leerDispositivo(req) {
    const c = parsear(leerCookies(req)[COOKIE]);
    if (c) return { ...c, origen: 'cookie' };
    const h = parsear(req.headers['x-dispositivo']);
    if (h) return { ...h, origen: 'cabecera' };
    return null;
  }

  function cookieDe(valor, esHttps) {
    const attrs = [`${COOKIE}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${UN_ANIO}`];
    if (esHttps) attrs.push('Secure');
    return attrs.join('; ');
  }

  function nuevaCookie(esHttps) {
    const id = randomBytes(16).toString('hex');
    const ts = Date.now();
    const valor = `${id}.${ts}.${firmar(`${id}.${ts}`)}`;
    return { id, desde: ts, valor, header: cookieDe(valor, esHttps) };
  }

  return { hashIp, ipDe, leerDispositivo, nuevaCookie, cookieDe, firmar, iguales, leerCookies };
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
