// Huella del dispositivo: señales estables del navegador resumidas en un hash.
// Se combina en el servidor con la cookie firmada y la IP (anonimizada).

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
    c.width = 220;
    c.height = 40;
    const x = c.getContext('2d');
    x.textBaseline = 'top';
    x.font = '16px Arial';
    x.fillStyle = '#f60';
    x.fillRect(10, 5, 90, 25);
    x.fillStyle = '#069';
    x.fillText('DGTIC 2026 ✨🎄', 4, 8);
    x.strokeStyle = 'rgba(102,204,0,.7)';
    x.arc(150, 20, 14, 0, Math.PI * 2);
    x.stroke();
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
    return ext
      ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`
      : gl.getParameter(gl.VERSION);
  } catch {
    return 'sin-webgl';
  }
}

let cache;
export function obtenerHuella() {
  cache ??= (async () => {
    const n = navigator;
    const señales = [
      n.userAgent,
      n.language,
      (n.languages ?? []).join(','),
      n.platform,
      n.hardwareConcurrency,
      n.deviceMemory,
      n.maxTouchPoints,
      screen.width,
      screen.height,
      screen.colorDepth,
      devicePixelRatio,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      new Date().getTimezoneOffset(),
      señalCanvas(),
      señalWebgl()
    ].join('||');

    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(señales));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return hashSimple(señales);
  })();
  return cache;
}
