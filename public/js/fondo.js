// Fondo animado en canvas: nieve, destellos dorados y confeti.
const canvas = document.getElementById('fondo');
const ctx = canvas.getContext('2d');
const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

let w = 0;
let h = 0;
let dpr = 1;
let particulas = [];
let confeti = [];
let parallax = 0;
let activo = true;

const ORO = ['#ffd45a', '#f5b700', '#ffe9a3'];
const CONFETI = ['#ffd45a', '#ef233c', '#ffffff', '#2ec4b6', '#ff7b00'];
const rnd = (a, b) => a + Math.random() * (b - a);

function nueva(arriba = false) {
  const dorada = Math.random() < 0.22;
  return {
    x: rnd(0, w),
    y: arriba ? rnd(-40, -5) : rnd(0, h),
    r: dorada ? rnd(1.2, 2.6) : rnd(0.8, 3.2),
    v: rnd(0.25, 1.1),
    d: rnd(-0.3, 0.3),
    f: rnd(0, Math.PI * 2),
    c: dorada ? ORO[Math.floor(Math.random() * ORO.length)] : '#ffffff',
    o: dorada ? rnd(0.6, 1) : rnd(0.25, 0.8),
    dorada
  };
}

function ajustar() {
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  w = innerWidth;
  h = innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cantidad = Math.round(Math.min(70, (w * h) / 22000));
  particulas = Array.from({ length: cantidad }, () => nueva());
}

function destello(p, t) {
  ctx.globalAlpha = p.o * (0.55 + 0.45 * Math.sin(t / 380 + p.f));
  ctx.fillStyle = p.c;
  const s = p.r * 2.2;
  ctx.fillRect(p.x - 0.7, p.y - s, 1.4, s * 2);
  ctx.fillRect(p.x - s, p.y - 0.7, s * 2, 1.4);
}

let ultimo = 0;
function cuadro(t) {
  requestAnimationFrame(cuadro);
  if (!activo) return;
  if (t - ultimo < 22) return;
  const dt = Math.min((t - ultimo) / 16.7 || 1, 3);
  ultimo = t;
  ctx.clearRect(0, 0, w, h);

  for (const p of particulas) {
    p.y += p.v * dt;
    p.x += (p.d + Math.sin(t / 1800 + p.f) * 0.25 + parallax * 0.15) * dt;
    if (p.y > h + 10 || p.x < -20 || p.x > w + 20) Object.assign(p, nueva(true));
    if (p.dorada) destello(p, t);
    else {
      ctx.globalAlpha = p.o;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = confeti.length - 1; i >= 0; i--) {
    const c = confeti[i];
    c.vy += 0.12 * dt;
    c.vx *= 0.99;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    c.vida -= 0.006 * dt;
    if (c.vida <= 0 || c.y > h + 20) {
      confeti.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.vida * 1.6);
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.c;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function lanzarConfeti() {
  if (reducir) return;
  const origenes = [0.2, 0.5, 0.8];
  for (const ox of origenes) {
    for (let i = 0; i < 40; i++) {
      const ang = rnd(-Math.PI * 0.9, -Math.PI * 0.1);
      const fuerza = rnd(5, 13);
      confeti.push({
        x: w * ox,
        y: h * 0.62,
        vx: Math.cos(ang) * fuerza,
        vy: Math.sin(ang) * fuerza,
        w: rnd(5, 10),
        h: rnd(3, 6),
        rot: rnd(0, Math.PI),
        vr: rnd(-0.25, 0.25),
        vida: rnd(0.9, 1.6),
        c: CONFETI[Math.floor(Math.random() * CONFETI.length)]
      });
    }
  }
}

addEventListener('resize', ajustar);
addEventListener('pointermove', (e) => {
  parallax = (e.clientX / w - 0.5) * 2;
});
document.addEventListener('visibilitychange', () => {
  activo = !document.hidden;
});

ajustar();
if (reducir) {
  // Sin animación: un solo cuadro estático.
  for (const p of particulas) {
    ctx.globalAlpha = p.o;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
} else {
  requestAnimationFrame(cuadro);
}
