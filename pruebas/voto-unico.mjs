// Pruebas del voto único por dispositivo. Arranca un servidor LOCAL de pruebas con una base vacía:
//   TRUST_PROXY=1 MIN_SEGUNDOS=1 npm start   y luego:   node pruebas/voto-unico.mjs
// (con HUELLA_SOLA=1 en el servidor, ejecuta: node pruebas/voto-unico.mjs huella-sola)
// Para la prueba del panel define ADMIN_USER y ADMIN_PASS (si no, se omite). No lo uses contra producción.
//
// Reglas que se verifican:
//   - Mismo navegador (cookie o token firmado en localStorage): se BLOQUEA siempre.
//   - Misma huella pero sin identidad (borró todo / teléfono idéntico de otra persona): NO se bloquea,
//     se pide confirmación y el voto queda marcado como dudoso.
const base = process.env.BASE ?? 'http://localhost:3000';
const MODO = process.argv[2] ?? 'normal'; // 'normal' o 'huella-sola'
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const ok = (cond, texto) => { console.log(`${cond ? 'OK  ' : 'FALLA'} ${texto}`); if (!cond) fallos++; };

const huella = (n) => n.toString(16).padStart(2, '0').repeat(16);
const cuerpo = (confirmo = false) => JSON.stringify({
  respuestas: { entrada: 'crema-brocoli', fuerte: 'lomo-jugo', guarnicion: 'pure', 'musica-comida': 'baladas', 'musica-baile': ['trap'] },
  confirmo
});

// Cliente simulado: conserva (o no) cookie y token como lo haría un navegador
function cliente({ fp, ip }) {
  const est = { cookie: null, token: null, fp, ip };
  const cab = () => ({
    'x-huella': est.fp,
    'x-forwarded-for': est.ip,
    ...(est.cookie ? { cookie: est.cookie } : {}),
    ...(est.token ? { 'x-dispositivo': est.token } : {})
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
    async votar(confirmo = false) {
      const r = await fetch(`${base}/api/votar`, { method: 'POST', headers: { ...cab(), 'content-type': 'application/json' }, body: cuerpo(confirmo) });
      const sc = r.headers.get('set-cookie');
      if (sc) est.cookie = sc.split(';')[0];
      const j = await r.json().catch(() => ({}));
      return { estado: r.status, confirmar: j.confirmar === true };
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
ok((await A.votar()).estado === 201, 'primer voto aceptado (limpio, sin confirmación)');

// 2) Mismo navegador
ok((await A.votar()).estado === 409, 'segundo voto con la misma cookie: BLOQUEADO');
ok((await A.evento()).yaVoto === true, 'la página reconoce que ya votó');

// 3) Borra solo las cookies (conserva localStorage)
A.borrarCookies();
ok((await A.evento()).yaVoto === true, 'sin cookie pero con token de localStorage: reconocido');
const v3 = await A.votar();
ok(v3.estado === 409 && !v3.confirmar, 'sin cookie pero con token: BLOQUEADO (no se puede confirmar)');
ok((await A.mias()) > 0, 'y se le muestran sus propias respuestas');

// 4) Borra TODO y vuelve en la misma red con la misma huella: NO se bloquea
A.borrarTodo();
ok((await A.evento()).yaVoto === false, 'sin cookie ni token (misma huella y red): la página NO lo da por votado');
await dormir(1300);
const v4 = await A.votar();
ok(v4.estado === 409 && v4.confirmar, 'primero se le pide confirmar que es otra persona');
const v4b = await A.votar(true);
ok(v4b.estado === 201, 'si confirma, su voto se acepta (nadie queda bloqueado)');
ok((await A.votar()).estado === 409, 'y desde entonces su nueva identidad queda bloqueada');

// 5) Borra todo y cambia de red
const A2 = cliente({ fp: huella(1), ip: '10.9.9.9' });
await A2.evento();
await dormir(1300);
const v5 = await A2.votar();
if (MODO === 'huella-sola') ok(v5.estado === 409 && v5.confirmar, 'cambia de red (HUELLA_SOLA=1): se le pide confirmar');
else console.log(`INFO  cambia de red y borra todo -> ${v5.estado} (sin aviso; HUELLA_SOLA=1 pediría confirmación)`);

// 6) Otro teléfono distinto en la misma red
const B = cliente({ fp: huella(2), ip: '10.1.1.1' });
await B.evento();
await dormir(1300);
ok((await B.votar()).estado === 201, 'otro teléfono distinto en la misma red: vota sin ninguna fricción');

// 7) Token falsificado
const F = cliente({ fp: huella(3), ip: '10.1.1.1' });
F.est.token = `${'a'.repeat(32)}.1794000000000.${'A'.repeat(43)}`;
const j7 = await F.evento();
ok(j7.token !== F.est.token && j7.yaVoto === false, 'token falsificado: se ignora y se emite uno nuevo');

// 8) Oficina: 40 teléfonos distintos desde la misma IP
const lote = Array.from({ length: 40 }, (_, i) => cliente({ fp: huella(100 + i), ip: '10.1.1.1' }));
await Promise.all(lote.map((c) => c.evento()));
await dormir(1400);
const estados = await Promise.all(lote.map((c) => c.votar()));
ok(estados.every((s) => s.estado === 201), `40 teléfonos distintos en la misma red: ${estados.filter((s) => s.estado === 201).length}/40 aceptados`);

// 9) Teléfonos IDÉNTICOS (misma huella) de 15 personas distintas en la misma red: todas pueden votar
const gemelos = Array.from({ length: 15 }, () => cliente({ fp: huella(150), ip: '10.3.3.3' }));
await Promise.all(gemelos.map((c) => c.evento()));
await dormir(1400);
let aceptados = 0;
for (const c of gemelos) {
  let r = await c.votar();
  if (r.estado === 409 && r.confirmar) r = await c.votar(true);
  if (r.estado === 201) aceptados++;
}
ok(aceptados === 15, `15 teléfonos idénticos de personas distintas en la misma red: ${aceptados}/15 pudieron votar`);

// 10) Carrera: 6 envíos simultáneos del mismo teléfono
const C = cliente({ fp: huella(200), ip: '10.2.2.2' });
await C.evento();
await dormir(1300);
const carrera = await Promise.all(Array.from({ length: 6 }, () => C.votar()));
ok(carrera.filter((s) => s.estado === 201).length === 1, `6 envíos simultáneos: ${carrera.map((s) => s.estado).join(',')} (solo 1 aceptado)`);

// 11) Panel
if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: process.env.ADMIN_USER, clave: process.env.ADMIN_PASS }) });
  const cookieAdmin = login.headers.get('set-cookie')?.split(';')[0];
  const pedir = async (q = '') => (await fetch(`${base}/api/admin/datos${q}`, { headers: { cookie: cookieAdmin } })).json();
  const todos = await pedir();
  const sin = await pedir('?sd=1');
  ok((todos.bloqueos?.dispositivo ?? 0) > 0, `el panel cuenta los repetidos bloqueados: ${JSON.stringify(todos.bloqueos)}`);
  ok(todos.dudososGlobal === 15, `el panel cuenta los votos dudosos (1 que borró todo + 14 teléfonos idénticos): ${todos.dudososGlobal}`);
  ok(sin.total === todos.total - todos.dudososGlobal, `el filtro «Sin dudosos» los excluye: ${todos.total} -> ${sin.total}`);
} else {
  console.log('INFO  prueba del panel omitida (define ADMIN_USER y ADMIN_PASS)');
}

console.log(fallos ? `\n${fallos} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fallos ? 1 : 0);
