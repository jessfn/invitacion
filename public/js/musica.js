// Reproductor de la música navideña.
//
// La pista (campanas y cascabeles de trineo con "Jingle Bells" y "We Wish You a Merry Christmas")
// se sintetiza UNA sola vez en un Worker (musica-render.js) y aquí solo se reproduce en bucle.
// Reproducir un buffer casi no usa procesador, así que suena limpio incluso en Android modestos,
// y el bucle es continuo: nunca se acaba.

let vivo = null;
let fuente = null;
let pista = null; // { izq, der, sr }
let promesa = null;
let sonando = false;
let cargando = false;
const oyentes = new Set();

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

// Se puede llamar al cargar la página: no necesita permiso del usuario.
export function precargar() {
  if (!promesa) {
    promesa = sintetizar().then((p) => { pista = p; }).catch((err) => {
      promesa = null;
      throw err;
    });
  }
  return promesa;
}

function avisar() {
  for (const fn of oyentes) fn(sonando, cargando);
}

export const alCambiar = (fn) => { oyentes.add(fn); };
export const estaSonando = () => sonando;

function crearVivo(sr) {
  if (vivo) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  try {
    vivo = new AC({ sampleRate: sr, latencyHint: 'playback' });
  } catch {
    vivo = new AC();
  }
}

function arrancar() {
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

// Debe llamarse desde un gesto del usuario (clic o toque) para que el navegador lo permita.
export async function iniciar() {
  try {
    crearVivo(32000);
    await vivo.resume();
    sonando = true;
    if (!pista) {
      cargando = true;
      avisar();
      await precargar();
      cargando = false;
    }
    if (sonando) arrancar();
  } catch {
    sonando = false;
    cargando = false;
  }
  avisar();
}

export async function alternar() {
  if (!vivo || !sonando) return iniciar();
  sonando = false;
  await vivo.suspend();
  avisar();
}

// La música no se detiene sola: si el sistema la interrumpe (llamada, bloqueo, otra pestaña),
// se reanuda al volver o con el siguiente toque.
const reanudar = () => {
  if (vivo && sonando && vivo.state !== 'running') vivo.resume().catch(() => {});
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) reanudar(); });
document.addEventListener('pointerdown', reanudar, true);
