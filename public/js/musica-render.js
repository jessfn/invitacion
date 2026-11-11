// Sintetizador de la música navideña (campanas y cascabeles de trineo).
// Corre en un Worker: calcula la pista completa UNA vez como muestras de audio y la devuelve;
// la página solo la reproduce en bucle. Así ningún celular tiene que sintetizar en tiempo real
// (lo que provocaba sonido borroso o entrecortado en algunos Android).
'use strict';

const SR = 32000;

const SEMITONOS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function frecuencia(nota) {
  const m = /^([A-G])(#?)(\d)$/.exec(nota);
  return 440 * Math.pow(2, (SEMITONOS[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12) / 12);
}

// Melodías de dominio público. Cada nota: NOTA/duración en tiempos
const JINGLE =
  'E4/1 E4/1 E4/2 E4/1 E4/1 E4/2 E4/1 G4/1 C4/1.5 D4/.5 E4/4 ' +
  'F4/1 F4/1 F4/1.5 F4/.5 F4/1 E4/1 E4/1 E4/.5 E4/.5 E4/1 D4/1 D4/1 E4/1 D4/2 G4/2 ' +
  'E4/1 E4/1 E4/2 E4/1 E4/1 E4/2 E4/1 G4/1 C4/1.5 D4/.5 E4/4 ' +
  'F4/1 F4/1 F4/1.5 F4/.5 F4/1 E4/1 E4/1 E4/.5 E4/.5 G4/1 G4/1 F4/1 D4/1 C4/4';
const WE_WISH =
  'D4/1 G4/1 G4/.5 A4/.5 G4/.5 F#4/.5 E4/1 E4/1 E4/1 A4/1 A4/.5 B4/.5 A4/.5 G4/.5 F#4/1 D4/1 D4/1 ' +
  'B4/1 B4/.5 C5/.5 B4/.5 A4/.5 G4/1 E4/1 D4/.5 D4/.5 E4/1 A4/1 F#4/1 G4/2';

const CANCIONES = [
  { notas: JINGLE, bpm: 176, octava: 1 },
  { notas: WE_WISH, bpm: 150, octava: 1 },
  { notas: JINGLE, bpm: 188, octava: 2 }
];

function parsear(notas) {
  return notas.split(' ').map((x) => {
    const [n, d] = x.split('/');
    return [n, Number(d)];
  });
}

function renderizar() {
  const duraciones = CANCIONES.map((c) => parsear(c.notas).reduce((a, [, d]) => a + d, 0) * (60 / c.bpm) + 0.6);
  const total = duraciones.reduce((a, d) => a + d, 0);
  const cola = 3.2; // el final de las campanas se pliega al inicio: bucle sin costura
  const N = Math.ceil((total + cola) * SR);
  const izq = new Float32Array(N);
  const der = new Float32Array(N);
  const envio = new Float32Array(N); // hacia la reverberación

  // Campana tipo glockenspiel: fundamental + armónicos con caída exponencial
  const PARCIALES = [[1, 1], [2, 0.5], [3.01, 0.22], [5.4, 0.08]];
  function campana(f, t, dur, vol, pan) {
    const T = Math.max(0.35, dur * 1.7);
    const ini = Math.floor(t * SR);
    const n = Math.min(N - ini, Math.floor(T * SR));
    if (n <= 0) return;
    const att = Math.max(1, Math.floor(0.006 * SR));
    const d = Math.exp(-Math.log(vol / 0.0001) / ((T - 0.006) * SR));
    const l = 1 - pan;
    const r = pan;
    const w = [];
    const g = [];
    const a = [];
    const b = [];
    for (const [mult, gan] of PARCIALES) {
      const fr = f * mult;
      const om = (2 * Math.PI * fr) / SR;
      w.push(2 * Math.cos(om));
      g.push(fr < SR * 0.45 ? gan : 0);
      a.push(-Math.sin(om));
      b.push(0);
    }
    const [c0, c1, c2, c3] = w;
    const [g0, g1, g2, g3] = g;
    let a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    let e = 0;
    for (let i = 0; i < n; i++) {
      if (i < att) e = (vol * (i + 1)) / att;
      else if (i === att) e = vol;
      else e *= d;
      const v = e * (g0 * b0 + g1 * b1 + g2 * b2 + g3 * b3);
      const k = ini + i;
      izq[k] += v * l * 1.6;
      der[k] += v * r * 1.6;
      envio[k] += v * 0.5;
      // osciladores por recurrencia: sin(n·w) sin llamar a Math.sin en cada muestra
      let x = c0 * b0 - a0; a0 = b0; b0 = x;
      x = c1 * b1 - a1; a1 = b1; b1 = x;
      x = c2 * b2 - a2; a2 = b2; b2 = x;
      x = c3 * b3 - a3; a3 = b3; b3 = x;
    }
  }

  // Cascabeles de trineo: ráfagas cortas de ruido filtrado (pasa-banda ~7.2 kHz)
  function cascabel(t, vol, pan) {
    const ini = Math.floor(t * SR);
    const n = Math.min(N - ini, Math.floor(0.12 * SR));
    if (n <= 0) return;
    const om = (2 * Math.PI * 7200) / SR;
    const alfa = Math.sin(om) / (2 * 1.2);
    const b0 = alfa;
    const a0 = 1 + alfa;
    const a1 = -2 * Math.cos(om);
    const a2 = 1 - alfa;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const d = Math.exp(-Math.log(vol / 0.0001) / (0.09 * SR));
    let e = vol;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1;
      const y = (b0 * x - b0 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const v = y * e * 1.6;
      izq[ini + i] += v * (1 - pan);
      der[ini + i] += v * pan;
      envio[ini + i] += v * 0.4;
      e *= d;
    }
  }

  let t0 = 0;
  for (const { notas, bpm, octava } of CANCIONES) {
    const tiempo = 60 / bpm;
    let acumulado = 0;
    for (const [nota, dur] of parsear(notas)) {
      const f = frecuencia(nota) * octava;
      const ini = t0 + acumulado;
      const d = dur * tiempo;
      const pan = 0.38 + Math.random() * 0.24;
      campana(f, ini, d, 0.5, pan);
      campana(f * 2, ini, d, 0.18, 0.5); // brillo
      campana(f / 2, ini, d, 0.16, 0.5); // cuerpo
      acumulado += d;
    }
    for (let k = 0; k * (tiempo / 2) < acumulado; k++) cascabel(t0 + k * (tiempo / 2), k % 2 ? 0.1 : 0.2, 0.3 + Math.random() * 0.4);
    t0 += acumulado + 0.6;
  }

  // Reverberación tipo sala (peines + pasa-todo, estilo Freeverb) sobre el envío
  function reverb(entrada, ajuste) {
    const esc = SR / 44100;
    const peines = [1116, 1188, 1277, 1356, 1422, 1491].map((x) => ({
      buf: new Float32Array(Math.round((x + ajuste) * esc)),
      i: 0,
      lp: 0
    }));
    const pasa = [556, 441].map((x) => ({ buf: new Float32Array(Math.round((x + ajuste) * esc)), i: 0 }));
    const sal = new Float32Array(entrada.length);
    const fb = 0.84;
    const am = 0.25;
    for (let n = 0; n < entrada.length; n++) {
      const x = entrada[n] * 0.02;
      let y = 0;
      for (const c of peines) {
        const o = c.buf[c.i];
        c.lp = o * (1 - am) + c.lp * am;
        c.buf[c.i] = x + c.lp * fb;
        if (++c.i >= c.buf.length) c.i = 0;
        y += o;
      }
      for (const p of pasa) {
        const o = p.buf[p.i];
        const z = y + o * 0.5;
        p.buf[p.i] = z;
        y = o - y * 0.5;
        if (++p.i >= p.buf.length) p.i = 0;
      }
      sal[n] = y;
    }
    return sal;
  }
  const humL = reverb(envio, 0);
  const humR = reverb(envio, 23);
  for (let n = 0; n < N; n++) {
    izq[n] += humL[n] * 5;
    der[n] += humR[n] * 5;
  }

  // Pasa-altos a 170 Hz: las bocinas de celular no reproducen graves y los distorsionan
  function pasaAltos(d) {
    const om = (2 * Math.PI * 170) / SR;
    const alfa = Math.sin(om) / (2 * 0.707);
    const cs = Math.cos(om);
    const b0 = (1 + cs) / 2, b1 = -(1 + cs), b2 = (1 + cs) / 2;
    const a0 = 1 + alfa, a1 = -2 * cs, a2 = 1 - alfa;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      d[i] = y;
    }
  }
  pasaAltos(izq);
  pasaAltos(der);

  // Pliega la cola sobre el inicio y recorta al largo del bucle
  const largo = Math.round(total * SR);
  const salida = [new Float32Array(largo), new Float32Array(largo)];
  [izq, der].forEach((src, ch) => {
    const dst = salida[ch];
    for (let i = 0; i < N; i++) dst[i % largo] += src[i];
  });

  // Normaliza y suaviza los picos (volumen alto y parejo, sin saturar)
  let pico = 0;
  for (const dst of salida) for (let i = 0; i < largo; i++) pico = Math.max(pico, Math.abs(dst[i]));
  const k = pico > 0 ? 1 / pico : 1;
  const norm = 1 / Math.tanh(2.4);
  for (const dst of salida) {
    for (let i = 0; i < largo; i++) dst[i] = 0.92 * Math.tanh(2.4 * dst[i] * k) * norm;
  }
  return { izq: salida[0], der: salida[1], sr: SR };
}

self.onmessage = () => {
  try {
    const r = renderizar();
    self.postMessage(r, [r.izq.buffer, r.der.buffer]);
  } catch (err) {
    self.postMessage({ error: String(err && err.message ? err.message : err) });
  }
};
