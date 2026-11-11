// Reproductor de la música de la invitación: el mix en assets/musica/mix-navideno.mp3,
// en bucle infinito con <audio> (streaming: casi no usa memoria ni procesador).

// El parámetro v cambia el nombre del recurso para que ningún navegador use una copia vieja.
const URL_MIX = new URL('../assets/musica/mix-navideno.mp3?v=3', import.meta.url).href;

let audio = null;
let sonando = false;
let cargando = false;
const oyentes = new Set();

function crearAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.loop = true; // nunca se acaba
  audio.preload = 'auto';
  audio.volume = 1;
  audio.src = URL_MIX;
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
    await crearAudio().play();
  } catch {
    sonando = false;
  }
  cargando = false;
  avisar();
}

export async function alternar() {
  if (!sonando) return iniciar();
  sonando = false;
  audio?.pause();
  avisar();
}

// La música no se detiene sola: si el sistema la interrumpe (llamada, bloqueo, otra pestaña),
// se reanuda al volver o con el siguiente toque.
const reanudar = () => {
  if (sonando && audio && audio.paused) audio.play().catch(() => {});
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) reanudar(); });
document.addEventListener('pointerdown', reanudar, true);
