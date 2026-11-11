// Huella del dispositivo: señales estables del hardware y del navegador resumidas en un hash.
// Se usan solo señales que NO cambian entre visitas (se evitan zoom, orientación, tamaño de ventana
// y versión exacta del navegador). El servidor la combina con la cookie firmada, el token guardado
// en localStorage y la red (IP anonimizada).

function hashSimple(txt) {
  // FNV-1a doble, usado cuando crypto.subtle no está disponible (HTTP en red local).
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < txt.length; i++) {
    a = Math.imul(a ^ txt.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b + txt.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).repeat(2);
}

function señalCanvas() {
  try {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 60;
    const x = c.getContext('2d');
    x.textBaseline = 'top';
    x.font = '16px Arial';
    x.fillStyle = '#f60';
    x.fillRect(10, 5, 90, 25);
    x.fillStyle = '#069';
    x.fillText('DGTIC 2026 ✨🎄 áéñ', 4, 8);
    x.strokeStyle = 'rgba(102,204,0,.7)';
    x.beginPath();
    x.arc(170, 25, 18, 0, Math.PI * 2);
    x.stroke();
    const g = x.createLinearGradient(0, 0, 240, 0);
    g.addColorStop(0, '#f0a');
    g.addColorStop(1, '#0af');
    x.fillStyle = g;
    x.fillRect(0, 40, 240, 12);
    return c.toDataURL();
  } catch {
    return 'sin-canvas';
  }
}

function señalWebgl() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'sin-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const base = ext
      ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`
      : String(gl.getParameter(gl.VERSION));
    return [base, gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_VERTEX_ATTRIBS), gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.join('x')].join('|');
  } catch {
    return 'sin-webgl';
  }
}

// Huella de audio: la mezcla de un oscilador procesado varía ligeramente según el dispositivo.
async function señalAudio() {
  try {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return 'sin-audio';
    const ctx = new OAC(1, 5000, 44100);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 10000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -50;
    comp.knee.value = 40;
    comp.ratio.value = 12;
    comp.attack.value = 0;
    comp.release.value = 0.25;
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    const buf = await Promise.race([ctx.startRendering(), new Promise((r) => setTimeout(() => r(null), 1500))]);
    if (!buf) return 'audio-lento';
    const d = buf.getChannelData(0);
    let suma = 0;
    for (let i = 4500; i < 5000; i++) suma += Math.abs(d[i]);
    return suma.toFixed(6);
  } catch {
    return 'sin-audio';
  }
}

// Modelo y versión de sistema (Chrome en Android los entrega sin pedir permiso)
async function señalModelo() {
  try {
    const u = navigator.userAgentData;
    if (!u?.getHighEntropyValues) return 'sin-ch';
    const v = await u.getHighEntropyValues(['model', 'platformVersion', 'architecture', 'bitness']);
    return [u.platform, v.model, v.platformVersion, v.architecture, v.bitness].join('/');
  } catch {
    return 'sin-ch';
  }
}

const familiaSistema = () => (/Android|iPhone|iPad|iPod|Windows|Macintosh|Linux|CrOS/.exec(navigator.userAgent) ?? ['otro'])[0];

let cache;
export function obtenerHuella() {
  cache ??= (async () => {
    const n = navigator;
    const lado = [screen.width, screen.height].sort((a, b) => a - b); // no cambia al girar el teléfono
    const señales = [
      familiaSistema(),
      n.platform,
      n.hardwareConcurrency,
      n.deviceMemory,
      n.maxTouchPoints,
      lado.join('x'),
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      (n.languages?.length ? n.languages : [n.language]).join(','),
      señalCanvas(),
      señalWebgl(),
      await señalAudio(),
      await señalModelo()
    ].join('||');

    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(señales));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return hashSimple(señales);
  })();
  return cache;
}
