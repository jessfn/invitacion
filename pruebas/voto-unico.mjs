// Pruebas del voto único por dispositivo. Arranca un servidor LOCAL de pruebas con una base vacía:
//   TRUST_PROXY=1 MIN_SEGUNDOS=1 npm start   y luego:   node pruebas/voto-unico.mjs
// (con HUELLA_SOLA=1 en el servidor, ejecuta: node pruebas/voto-unico.mjs huella-sola)
// Para la prueba del panel define ADMIN_USER y ADMIN_PASS (si no, se omite). No lo uses contra producción.
const base = process.env.BASE ?? 'http://localhost:3000';
const MODO = process.argv[2] ?? 'normal'; // 'normal' o 'huella-sola'
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const ok = (cond, texto) => { console.log(`${cond ? 'OK  ' : 'FALLA'} ${texto}`); if (!cond) fallos++; };

const huella = (n) => n.toString(16).padStart(2, '0').repeat(16);
const cuerpo = (extra = {}) => JSON.stringify({
  respuestas: { entrada: 'crema-brocoli', fuerte: 'lomo-jugo', guarnicion: 'pure', 'musica-comida': 'baladas', 'musica-baile': ['trap'], ...extra }
});

// Cliente simulado: conserva (o no) cookie y token como lo haría un navegador
function cliente({ fp, ip }) {
  const est = { cookie: null, token: null, fp, ip };
  const cab = (conToken = true) => ({
    'x-huella': est.fp,
    'x-forwarded-for': est.ip,
    ...(est.cookie ? { cookie: est.cookie } : {}),
    ...(conToken && est.token ? { 'x-dispositivo': est.token } : {})
  });
  return {
    est,
    async evento() {
      const r = await fetch(`${base}/api/evento`, { headers: cab() });
      const sc = r.headers.get('set-cookie');
      if (sc) est.cookie = sc.split(';')[0];
      const j = await r.json();
      if (!est.token) est.token = j.token;
      return j;
    },
    async votar() {
      const r = await fetch(`${base}/api/votar`, { method: 'POST', headers: { ...cab(), 'content-type': 'application/json' }, body: cuerpo() });
      const sc = r.headers.get('set-cookie');
      if (sc) est.cookie = sc.split(';')[0];
      return r.status;
    },
    async mias() {
      const r = await fetch(`${base}/api/resultados`, { headers: cab() });
      return r.ok ? (await r.json()).preguntas.length : r.status;
    },
    borrarCookies() { est.cookie = null; },
    borrarTodo() { est.cookie = null; est.token = null; }
  };
}

console.log(`--- modo: ${MODO} ---`);
// 1) Primer voto
const A = cliente({ fp: huella(1), ip: '10.1.1.1' });
ok((await A.evento()).yaVoto === false, 'dispositivo nuevo aún no ha votado');
await dormir(1300);
ok((await A.votar()) === 201, 'primer voto aceptado');

// 2) Mismo teléfono, mismas credenciales
ok((await A.votar()) === 409, 'segundo voto con la misma cookie: bloqueado');
ok((await A.evento()).yaVoto === true, 'la página reconoce que ya votó');

// 3) Borra solo las cookies (conserva localStorage)
A.borrarCookies();
const j3 = await A.evento();
ok(j3.yaVoto === true, 'sin cookie pero con token de localStorage: reconocido');
ok((await A.votar()) === 409, 'sin cookie pero con token: voto bloqueado');
ok((await A.mias()) > 0, 'y se le muestran sus propias respuestas');

// 4) Borra TODO (cookies y localStorage), misma red
A.borrarTodo();
ok((await A.evento()).yaVoto === true, 'sin cookie ni token, misma huella y misma red: reconocido');
await dormir(1300);
ok((await A.votar()) === 409, 'sin cookie ni token, misma huella y misma red: bloqueado');
ok((await A.mias()) > 0, 'y se le muestran sus propias respuestas');

// 5) Borra todo Y cambia de red
const A2 = cliente({ fp: huella(1), ip: '10.9.9.9' });
const ya5 = (await A2.evento()).yaVoto;
await dormir(1300);
const st5 = await A2.votar();
if (MODO === 'huella-sola') {
  ok(ya5 === true && st5 === 409, 'cambia de red y borra todo: bloqueado por huella (HUELLA_SOLA=1)');
} else {
  console.log(`INFO  cambia de red y borra todo -> yaVoto=${ya5}, voto=${st5} (limitación conocida; HUELLA_SOLA=1 lo bloquea)`);
}

// 6) Otro teléfono distinto en la misma red (oficina)
const B = cliente({ fp: huella(2), ip: '10.1.1.1' });
await B.evento();
await dormir(1300);
ok((await B.votar()) === 201, 'otro teléfono distinto en la misma red: puede votar');

// 7) Token falsificado
const F = cliente({ fp: huella(3), ip: '10.1.1.1' });
F.est.token = `${'a'.repeat(32)}.1794000000000.${'A'.repeat(43)}`;
const j7 = await F.evento();
ok(j7.token !== F.est.token && j7.yaVoto === false, 'token falsificado: se ignora y se emite uno nuevo');

// 8) Carga de oficina: 40 teléfonos distintos desde la misma IP, todos votan
const lote = Array.from({ length: 40 }, (_, i) => cliente({ fp: huella(100 + i), ip: '10.1.1.1' }));
await Promise.all(lote.map((c) => c.evento()));
await dormir(1400);
const estados = await Promise.all(lote.map((c) => c.votar()));
ok(estados.every((s) => s === 201), `40 teléfonos distintos en la misma red: ${estados.filter((s) => s === 201).length}/40 aceptados`);

// 9) Carrera: 6 envíos simultáneos del mismo teléfono
const C = cliente({ fp: huella(200), ip: '10.2.2.2' });
await C.evento();
await dormir(1300);
const carrera = await Promise.all(Array.from({ length: 6 }, () => C.votar()));
ok(carrera.filter((s) => s === 201).length === 1, `6 envíos simultáneos: ${carrera.join(',')} (solo 1 aceptado)`);

// 10) Panel: bloqueos registrados (solo si se dan las credenciales del administrador)
if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: process.env.ADMIN_USER, clave: process.env.ADMIN_PASS }) });
  const cookieAdmin = login.headers.get('set-cookie')?.split(';')[0];
  const panel = await (await fetch(`${base}/api/admin/datos`, { headers: { cookie: cookieAdmin } })).json();
  const totalBl = Object.values(panel.bloqueos ?? {}).reduce((a, n) => a + n, 0);
  ok(totalBl > 0, `el panel registra los intentos bloqueados: ${JSON.stringify(panel.bloqueos)}`);
  ok(panel.total === panel.totalGlobal && panel.total >= 43, `total de votos guardados: ${panel.total}`);
} else {
  console.log('INFO  prueba del panel omitida (define ADMIN_USER y ADMIN_PASS)');
}

console.log(fallos ? `\n${fallos} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fallos ? 1 : 0);
