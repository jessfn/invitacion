// Música navideña generada en el navegador con Web Audio (sin archivos de audio).
// Melodías de dominio público: "Jingle Bells" y "We Wish You a Merry Christmas".

const SEMITONOS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
const frecuencia = (nota) => {
  const m = /^([A-G])(#?)(\d)$/.exec(nota);
  const semis = SEMITONOS[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};

// Cada nota: NOTA/duración en tiempos
const JINGLE =
  'E4/1 E4/1 E4/2 E4/1 E4/1 E4/2 E4/1 G4/1 C4/1.5 D4/.5 E4/4 ' +
  'F4/1 F4/1 F4/1.5 F4/.5 F4/1 E4/1 E4/1 E4/.5 E4/.5 E4/1 D4/1 D4/1 E4/1 D4/2 G4/2 ' +
  'E4/1 E4/1 E4/2 E4/1 E4/1 E4/2 E4/1 G4/1 C4/1.5 D4/.5 E4/4 ' +
  'F4/1 F4/1 F4/1.5 F4/.5 F4/1 E4/1 E4/1 E4/.5 E4/.5 G4/1 G4/1 F4/1 D4/1 C4/4';
const WE_WISH =
  'D4/1 G4/1 G4/.5 A4/.5 G4/.5 F#4/.5 E4/1 E4/1 E4/1 A4/1 A4/.5 B4/.5 A4/.5 G4/.5 F#4/1 D4/1 D4/1 ' +
  'B4/1 B4/.5 C5/.5 B4/.5 A4/.5 G4/1 E4/1 D4/.5 D4/.5 E4/1 A4/1 F#4/1 G4/2';

const CANCIONES = [
  { notas: JINGLE, bpm: 176 },
  { notas: WE_WISH, bpm: 150 },
  { notas: JINGLE, bpm: 188, octava: 2 }
];

let ctx = null;
let maestro = null;
let reverb = null;
let ruido = null;
let temporizador = null;
let proximoInicio = 0;
let indice = 0;
let sonando = false;
const oyentes = new Set();

function impulso(c, segundos = 1.8) {
  const largo = Math.floor(c.sampleRate * segundos);
  const buf = c.createBuffer(2, largo, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 2.6;
  }
  return buf;
}

function preparar() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -12;
  compresor.ratio.value = 6;
  maestro = ctx.createGain();
  maestro.gain.value = 0.95; // volumen alto; el límite real lo pone el volumen del dispositivo
  maestro.connect(compresor).connect(ctx.destination);
  reverb = ctx.createConvolver();
  reverb.buffer = impulso(ctx);
  const mojado = ctx.createGain();
  mojado.gain.value = 0.32;
  reverb.connect(mojado).connect(maestro);
  const largo = ctx.sampleRate;
  ruido = ctx.createBuffer(1, largo, ctx.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < largo; i++) d[i] = Math.random() * 2 - 1;
}

// Campana tipo glockenspiel: fundamental + armónicos con caída exponencial.
function campana(f, t, dur, vol) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.35, dur * 1.7));
  for (const [mult, tipo, g] of [[1, 'sine', 1], [2, 'triangle', 0.5], [3.01, 'sine', 0.22], [5.4, 'sine', 0.08]]) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = tipo;
    o.frequency.value = f * mult;
    og.gain.value = g;
    o.connect(og).connect(env);
    o.start(t);
    o.stop(t + Math.max(0.4, dur * 1.8));
  }
  env.connect(maestro);
  env.connect(reverb);
}

// Cascabeles de trineo: ráfagas cortas de ruido filtrado.
function cascabel(t, vol) {
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruido;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = 7200;
  filtro.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  fuente.connect(filtro).connect(g);
  g.connect(maestro);
  g.connect(reverb);
  fuente.start(t, Math.random() * 0.5, 0.12);
}

// Agenda una canción completa desde t0 y devuelve su duración en segundos.
function programarCancion({ notas, bpm, octava = 1 }, t0) {
  const tiempo = 60 / bpm;
  let acumulado = 0;
  for (const token of notas.split(' ')) {
    const [nota, d] = token.split('/');
    const dur = Number(d) * tiempo;
    const f = frecuencia(nota) * octava;
    const inicio = t0 + acumulado;
    campana(f, inicio, dur, 0.5);
    campana(f * 2, inicio, dur, 0.18); // brillo
    campana(f / 2, inicio, dur, 0.16); // cuerpo
    acumulado += dur;
  }
  // Cascabeles cada medio tiempo durante toda la canción
  for (let k = 0; k * (tiempo / 2) < acumulado; k++) cascabel(t0 + k * (tiempo / 2), k % 2 ? 0.1 : 0.2);
  return acumulado + 0.6;
}

// Programador sin fin: mantiene siempre ~14 segundos de música agendados por delante,
// así que la lista se repite una y otra vez y nunca se acaba.
function tic() {
  if (!ctx || ctx.state !== 'running' || !sonando) return;
  if (!proximoInicio) proximoInicio = ctx.currentTime + 0.15;
  while (proximoInicio < ctx.currentTime + 14) {
    proximoInicio += programarCancion(CANCIONES[indice % CANCIONES.length], proximoInicio);
    indice++;
  }
}

function avisar() {
  for (const fn of oyentes) fn(sonando);
}

export const alCambiar = (fn) => { oyentes.add(fn); };
export const estaSonando = () => sonando;

// Debe llamarse desde un gesto del usuario (clic o toque) para que el navegador lo permita.
export async function iniciar() {
  try {
    preparar();
    await ctx.resume();
    sonando = true;
    tic();
    clearInterval(temporizador);
    temporizador = setInterval(tic, 500);
  } catch {
    sonando = false;
  }
  avisar();
}

export async function alternar() {
  if (!ctx || !sonando) return iniciar();
  sonando = false;
  await ctx.suspend();
  avisar();
}

// La música no se detiene sola: si el sistema la interrumpe (llamada, bloqueo, otra pestaña),
// se reanuda al volver o con el siguiente toque.
const reanudar = () => {
  if (ctx && sonando && ctx.state !== 'running') ctx.resume().catch(() => {});
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) reanudar(); });
document.addEventListener('pointerdown', reanudar, true);
