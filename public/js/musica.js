// Reproductor de la música de la invitación.
//
// 1) Principal: el mix en assets/musica/mix-navideno.mp3, en bucle infinito con <audio>
//    (streaming: casi no usa memoria ni procesador, suena igual en cualquier celular).
// 2) Respaldo: si ese archivo no está en el servidor, se usa una pista de campanas sintetizada
//    una sola vez en un Worker (musica-render.js) y reproducida en bucle.

const URL_MIX = new URL('../assets/musica/mix-navideno.mp3', import.meta.url).href;

let audio = null; // <audio> del mix
let modo = null; // 'mix' | 'campanas'
let sonando = false;
let cargando = false;
const oyentes = new Set();

// ---------- respaldo: campanas sintetizadas ----------
let vivo = null;
let fuente = null;
let pista = null; // { izq, der, sr }
let promesaPista = null;

function sintetizar() {
  return new Promise((ok, fallo) => {
    const w = new Worker(new URL('./musica-render.js', import.meta.url));
    w.onmessage = (e) => {
      w.terminate();
      if (e.data.error) fallo(new Error(e.data.error));
      else ok(e.data);
    };
    w.onerror = (e) => {
      w.terminate();
      fallo(new Error(e.message || 'No se pudo preparar la música'));
    };
    w.postMessage('sintetizar');
  });
}

function prepararCampanas() {
  if (!promesaPista) {
    promesaPista = sintetizar().then((p) => { pista = p; }).catch((err) => {
      promesaPista = null;
      throw err;
    });
  }
  return promesaPista;
}

function crearVivo(sr) {
  if (vivo) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  try {
    vivo = new AC({ sampleRate: sr, latencyHint: 'playback' });
  } catch {
    vivo = new AC();
  }
}

function arrancarCampanas() {
  if (fuente || !pista) return;
  const buf = vivo.createBuffer(2, pista.izq.length, pista.sr);
  buf.copyToChannel(pista.izq, 0);
  buf.copyToChannel(pista.der, 1);
  fuente = vivo.createBufferSource();
  fuente.buffer = buf;
  fuente.loop = true;
  fuente.connect(vivo.destination);
  fuente.start();
}

async function iniciarCampanas() {
  modo = 'campanas';
  crearVivo(32000);
  await vivo.resume();
  if (!pista) {
    cargando = true;
    avisar();
    await prepararCampanas();
    cargando = false;
  }
  if (sonando) arrancarCampanas();
}

// ---------- mix principal ----------
function crearAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.loop = true; // nunca se acaba
  audio.preload = 'auto';
  audio.volume = 1;
  audio.src = URL_MIX;
  // Si el archivo no existe en el servidor, se prepara el respaldo en segundo plano.
  audio.addEventListener('error', () => { prepararCampanas().catch(() => {}); });
  return audio;
}

function avisar() {
  for (const fn of oyentes) fn(sonando, cargando);
}

export const alCambiar = (fn) => { oyentes.add(fn); };
export const estaSonando = () => sonando;

// Se puede llamar al cargar la página: empieza a descargar el mix sin reproducirlo.
export function precargar() {
  crearAudio();
  return Promise.resolve();
}

// Debe llamarse desde un gesto del usuario (clic o toque) para que el navegador lo permita.
export async function iniciar() {
  sonando = true;
  cargando = true;
  avisar();
  try {
    crearAudio();
    await audio.play();
    modo = 'mix';
  } catch (err) {
    if (err && err.name === 'NotAllowedError') {
      sonando = false;
    } else {
      try {
        await iniciarCampanas(); // el mix no está disponible: respaldo
      } catch {
        sonando = false;
      }
    }
  }
  cargando = false;
  avisar();
}

export async function alternar() {
  if (!sonando) return iniciar();
  sonando = false;
  if (modo === 'mix') audio.pause();
  else if (vivo) await vivo.suspend();
  avisar();
}

// La música no se detiene sola: si el sistema la interrumpe (llamada, bloqueo, otra pestaña),
// se reanuda al volver o con el siguiente toque.
const reanudar = () => {
  if (!sonando) return;
  if (modo === 'mix' && audio && audio.paused) audio.play().catch(() => {});
  if (modo === 'campanas' && vivo && vivo.state !== 'running') vivo.resume().catch(() => {});
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) reanudar(); });
document.addEventListener('pointerdown', reanudar, true);
