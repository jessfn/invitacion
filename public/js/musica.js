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
let finProgramado = 0;
let sonando = false;
let pausadoPorPestana = false;
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

function programar() {
  let t = ctx.currentTime + 0.15;
  for (const { notas, bpm, octava = 1 } of CANCIONES) {
    const tiempo = 60 / bpm;
    let acumulado = 0;
    for (const token of notas.split(' ')) {
      const [nota, d] = token.split('/');
      const dur = Number(d) * tiempo;
      const f = frecuencia(nota) * octava;
      const inicio = t + acumulado;
      campana(f, inicio, dur, 0.5);
      campana(f * 2, inicio, dur, 0.18); // brillo
      campana(f / 2, inicio, dur, 0.16); // cuerpo
      acumulado += dur;
    }
    // Cascabeles cada medio tiempo durante toda la canción
    for (let k = 0; k * (tiempo / 2) < acumulado; k++) cascabel(t + k * (tiempo / 2), k % 2 ? 0.1 : 0.2);
    t += acumulado + 0.8;
  }
  finProgramado = t;
  vigilar();
}

// El contexto de audio se detiene al pausar, así que se vigila su propio reloj
// (y no el del navegador) para saber cuándo repetir la lista.
function vigilar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    if (!ctx) return;
    if (ctx.state === 'running' && ctx.currentTime >= finProgramado - 1.5) programar();
    else vigilar();
  }, 1000);
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
    if (!sonando) {
      sonando = true;
      if (!finProgramado) programar();
    }
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

// Cortesía: se pausa si el usuario cambia de pestaña y se reanuda al volver.
document.addEventListener('visibilitychange', async () => {
  if (!ctx) return;
  if (document.hidden && sonando) {
    pausadoPorPestana = true;
    await ctx.suspend();
  } else if (!document.hidden && pausadoPorPestana) {
    pausadoPorPestana = false;
    if (sonando) await ctx.resume();
  }
});
