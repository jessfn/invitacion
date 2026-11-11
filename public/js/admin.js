const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);

function icono(nombre, clase = 'ico') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', clase);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#i-${nombre}`);
  svg.append(use);
  return svg;
}

function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat()) if (hijo != null) el.append(hijo);
  return el;
}

function s(tag, attrs = {}, ...hijos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const hijo of hijos.flat()) if (hijo != null) el.append(hijo);
  return el;
}

const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pct = (n, base) => (base ? Math.round((n / base) * 100) : 0);

// ---------- estado ----------
const est = { filtros: [], rango: 'todo', seccion: 'todas', dudosos: 'todos', busqueda: '', datos: null };
const tarjetas = new Map();
const paneles = new Map();
let kpis = null;
let fuente = null;
let temporizador = null;

// ---------- red ----------
async function api(ruta, opciones = {}) {
  const res = await fetch(ruta, {
    credentials: 'same-origin',
    ...opciones,
    headers: opciones.body ? { 'Content-Type': 'application/json' } : undefined
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos.error ?? 'Error'), { estado: res.status });
  return datos;
}

function desdeMs() {
  const ahora = new Date();
  if (est.rango === '24h') return Date.now() - 24 * 3600 * 1000;
  if (est.rango === 'hoy') return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  return 0;
}

async function cargar() {
  const q = new URLSearchParams();
  if (est.filtros.length) q.set('f', est.filtros.join(','));
  const d = desdeMs();
  if (d) q.set('desde', String(d));
  if (est.dudosos === 'sin') q.set('sd', '1');
  try {
    est.datos = await api(`/api/admin/datos?${q}`);
    pintar();
  } catch (e) {
    if (e.estado === 401) mostrarAcceso();
  }
}

function conectarVivo() {
  fuente?.close();
  const vivo = $('vivo');
  let espera;
  fuente = new EventSource('/api/admin/stream');
  fuente.addEventListener('open', () => { vivo.classList.remove('off'); vivo.querySelector('b').textContent = 'En vivo'; });
  fuente.addEventListener('error', () => { vivo.classList.add('off'); vivo.querySelector('b').textContent = 'Reconectando…'; });
  fuente.addEventListener('voto', () => { clearTimeout(espera); espera = setTimeout(cargar, 250); });
  clearInterval(temporizador);
  temporizador = setInterval(() => { if (!document.hidden) cargar(); }, 30000);
}

// ---------- acceso ----------
function mostrarAcceso() {
  fuente?.close();
  clearInterval(temporizador);
  $('panel').hidden = true;
  $('acceso').hidden = false;
  $('formLogin').elements.clave.value = '';
  $('formLogin').elements.usuario.focus();
}

async function iniciarPanel() {
  $('acceso').hidden = true;
  $('panel').hidden = false;
  await cargar();
  conectarVivo();
}

$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const err = $('loginError');
  err.hidden = true;
  $('btnLogin').disabled = true;
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ usuario: f.usuario.value.trim(), clave: f.clave.value }) });
    await iniciarPanel();
  } catch (x) {
    err.textContent = x.message || 'No se pudo iniciar sesión.';
    err.hidden = false;
  } finally {
    $('btnLogin').disabled = false;
  }
});

$('btnSalir').addEventListener('click', async () => {
  try { await api('/api/admin/salir', { method: 'POST', body: '{}' }); } catch {}
  mostrarAcceso();
});

// ---------- filtros ----------
function segmento(id, clave) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    est[clave] = b.dataset.v;
    $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (clave === 'rango' || clave === 'dudosos') cargar();
    else aplicarVista();
  });
}
segmento('segRango', 'rango');
segmento('segSeccion', 'seccion');
segmento('segDudosos', 'dudosos');

$('buscar').addEventListener('input', (e) => { est.busqueda = norm(e.target.value.trim()); aplicarVista(); });

function alternarFiltro(pregunta, opcion, tipo) {
  const clave = `${pregunta}:${opcion}`;
  if (est.filtros.includes(clave)) est.filtros = est.filtros.filter((x) => x !== clave);
  else {
    if (tipo === 'unica') est.filtros = est.filtros.filter((x) => !x.startsWith(`${pregunta}:`));
    est.filtros = [...est.filtros, clave];
  }
  cargar();
}

function pintarActivos() {
  const caja = $('activos');
  caja.hidden = est.filtros.length === 0;
  if (!est.datos || !est.filtros.length) return;
  const etiqueta = (clave) => {
    const [p, v] = [clave.slice(0, clave.indexOf(':')), clave.slice(clave.indexOf(':') + 1)];
    const pr = est.datos.preguntas.find((x) => x.id === p);
    return `${pr?.titulo ?? p}: ${pr?.opciones.find((o) => o.id === v)?.label ?? v}`;
  };
  caja.replaceChildren(
    h('span', {}, 'Mostrando solo a quienes eligieron:'),
    ...est.filtros.map((c) => h('span', { class: 'chip' }, etiqueta(c),
      h('button', { type: 'button', 'aria-label': 'Quitar filtro', onclick: () => { est.filtros = est.filtros.filter((x) => x !== c); cargar(); } }, icono('x')))),
    h('button', { type: 'button', class: 'limpiar', onclick: () => { est.filtros = []; cargar(); } }, 'Limpiar filtros')
  );
}

// ---------- KPIs ----------
const hace = (t) => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'hace unos segundos';
  if (m < 60) return `hace ${m} min`;
  const hr = Math.floor(m / 60);
  return hr < 24 ? `hace ${hr} h` : `hace ${Math.floor(hr / 24)} d`;
};

function construirKpis() {
  const def = [
    ['total', 'Participantes', 'users', true],
    ['entrada', 'Entrada favorita', 'soup'],
    ['fuerte', 'Plato fuerte favorito', 'utensils'],
    ['baile', 'Género #1 para bailar', 'music'],
    ['canciones', 'Canciones pedidas', 'disc'],
    ['ultima', 'Última respuesta', 'clock'],
    ['bloqueos', 'Repetidos bloqueados', 'shield'],
    ['dudosos', 'Votos dudosos', 'users']
  ];
  kpis = {};
  $('kpis').replaceChildren(...def.map(([id, titulo, ic, principal]) => {
    const v = h('div', { class: 'kpi__v' });
    const sub = h('div', { class: 'kpi__s' });
    kpis[id] = { v, sub };
    return h('div', { class: `kpi${principal ? ' kpi--principal' : ''}` }, h('div', { class: 'kpi__t' }, icono(ic), titulo), v, sub);
  }));
}

function contar(el, hasta) {
  const desde = Number(el.dataset.n ?? 0);
  el.dataset.n = hasta;
  if (desde === hasta || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = hasta; return; }
  const t0 = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / 600);
    el.textContent = Math.round(desde + (hasta - desde) * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function lider(d, id) {
  const p = d.preguntas.find((x) => x.id === id);
  const top = p?.opciones.reduce((a, o) => (o.votos > (a?.votos ?? 0) ? o : a), null);
  return top ? { label: top.label, votos: top.votos } : null;
}

function pintarKpis(d) {
  if (!kpis) construirKpis();
  contar(kpis.total.v, d.total);
  kpis.total.sub.textContent = d.filtros.length || est.rango !== 'todo' ? `de ${d.totalGlobal} en total` : 'personas han respondido';
  for (const [id, preg] of [['entrada', 'entrada'], ['fuerte', 'fuerte'], ['baile', 'musica-baile']]) {
    const l = lider(d, preg);
    const k = kpis[id];
    k.v.className = 'kpi__v texto';
    k.v.textContent = l ? l.label : '—';
    k.sub.textContent = l ? `${l.votos} ${l.votos === 1 ? 'voto' : 'votos'} · ${pct(l.votos, d.total)}%` : 'Sin datos';
  }
  const canc = d.textos.find((t) => t.id === 'cancion')?.respuestas ?? [];
  contar(kpis.canciones.v, canc.reduce((a, c) => a + c.n, 0));
  kpis.canciones.sub.textContent = `${canc.length} distintas`;
  const bl = d.bloqueos ?? {};
  contar(kpis.bloqueos.v, bl.dispositivo ?? 0);
  kpis.bloqueos.sub.textContent = (bl.dispositivo ?? 0)
    ? `Intentos desde el mismo navegador · avisos de teléfono parecido: ${bl.aviso ?? 0}`
    : `Nadie ha repetido su voto · avisos de teléfono parecido: ${bl.aviso ?? 0}`;
  contar(kpis.dudosos.v, d.dudososGlobal ?? 0);
  kpis.dudosos.sub.textContent = (d.dudososGlobal ?? 0)
    ? 'Teléfono parecido a otro voto, confirmado por la persona. Usa «Sin dudosos» para verlos aparte'
    : 'Ningún voto necesitó confirmación';
  const ult = d.tiempos.at(-1);
  kpis.ultima.v.className = 'kpi__v texto';
  kpis.ultima.v.textContent = ult ? hace(ult) : '—';
  kpis.ultima.sub.textContent = ult ? new Date(ult).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Aún no hay respuestas';
}

// ---------- línea de tiempo ----------
function pintarTiempo(d) {
  const caja = $('linea');
  if (!d.tiempos.length) {
    caja.replaceChildren(h('div', { class: 'vacio' }, 'Aún no hay respuestas en este periodo.'));
    $('tiempoNota').textContent = '';
    return;
  }
  const primero = d.tiempos[0];
  const porHora = Date.now() - primero <= 72 * 3600 * 1000;
  const unidad = porHora ? 3600 * 1000 : 86400 * 1000;
  const inicio = (t) => {
    const f = new Date(t);
    return porHora ? new Date(f.getFullYear(), f.getMonth(), f.getDate(), f.getHours()).getTime()
      : new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  };
  let desde = inicio(primero);
  const hasta = inicio(Date.now());
  const maxCubos = porHora ? 72 : 60;
  while ((hasta - desde) / unidad + 1 > maxCubos) desde += unidad;
  const cubos = [];
  for (let t = desde; t <= hasta; t += unidad) cubos.push({ t, n: 0 });
  let previos = 0;
  for (const t of d.tiempos) {
    const i = Math.floor((inicio(t) - desde) / unidad);
    if (i < 0) previos++;
    else if (cubos[i]) cubos[i].n++;
  }
  let acum = previos;
  for (const c of cubos) { acum += c.n; c.acum = acum; }
  $('tiempoNota').textContent = porHora ? 'Respuestas por hora' : 'Respuestas por día';

  const W = 800, H = 200, pl = 34, pr = 10, pt = 10, pb = 26;
  const maxA = Math.max(1, acum);
  const maxN = Math.max(1, ...cubos.map((c) => c.n));
  const x = (i) => pl + (cubos.length === 1 ? (W - pl - pr) / 2 : (i / (cubos.length - 1)) * (W - pl - pr));
  const yA = (v) => pt + (1 - v / maxA) * (H - pt - pb);
  const bw = Math.max(3, Math.min(26, (W - pl - pr) / cubos.length - 3));
  const fmt = (t) => new Date(t).toLocaleString('es-MX', porHora ? { day: 'numeric', month: 'short', hour: 'numeric' } : { day: 'numeric', month: 'short' });
  const linea = cubos.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yA(c.acum).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(cubos.length - 1).toFixed(1)},${H - pb} L${x(0).toFixed(1)},${H - pb} Z`;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Participación acumulada en el tiempo' },
    s('defs', {}, s('linearGradient', { id: 'gA', x1: 0, y1: 0, x2: 0, y2: 1 },
      s('stop', { offset: 0, 'stop-color': '#ffd45a', 'stop-opacity': .45 }), s('stop', { offset: 1, 'stop-color': '#ffd45a', 'stop-opacity': 0 }))),
    ...[0, .5, 1].map((f) => s('g', {},
      s('line', { x1: pl, x2: W - pr, y1: pt + f * (H - pt - pb), y2: pt + f * (H - pt - pb), stroke: 'rgba(255,255,255,.08)' }),
      s('text', { x: pl - 6, y: pt + f * (H - pt - pb) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#9fb5ab' }, String(Math.round(maxA * (1 - f)))))),
    ...cubos.map((c, i) => {
      const alto = (c.n / maxN) * (H - pt - pb) * 0.55;
      return s('rect', { x: x(i) - bw / 2, y: H - pb - alto, width: bw, height: alto, rx: 2, fill: 'rgba(37,211,162,.55)' },
        s('title', {}, `${fmt(c.t)}: ${c.n} nuevas · ${c.acum} acumuladas`));
    }),
    s('path', { d: area, fill: 'url(#gA)' }),
    s('path', { d: linea, fill: 'none', stroke: '#ffd45a', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
    s('text', { x: pl, y: H - 6, 'font-size': 11, fill: '#9fb5ab' }, fmt(cubos[0].t)),
    s('text', { x: W - pr, y: H - 6, 'text-anchor': 'end', 'font-size': 11, fill: '#9fb5ab' }, fmt(cubos.at(-1).t))
  );
  caja.replaceChildren(svg);
}

// ---------- preguntas ----------
const COLORES = ['#ffd45a', '#25d3a2', '#ff3b52', '#6db5ff', '#ff9ad5', '#9fb5ab'];

function dona(opciones) {
  const total = opciones.reduce((a, o) => a + o.votos, 0);
  const R = 54, C = 2 * Math.PI * R;
  const ordenadas = [...opciones].filter((o) => o.votos > 0).sort((a, b) => b.votos - a.votos);
  const top = ordenadas.slice(0, 5);
  const resto = ordenadas.slice(5).reduce((a, o) => a + o.votos, 0);
  const trozos = resto ? [...top, { label: 'Otras', votos: resto }] : top;
  let acum = 0;
  const arcos = trozos.map((t, i) => {
    const largo = (t.votos / total) * C;
    const el = s('circle', {
      cx: 75, cy: 75, r: R, fill: 'none', stroke: COLORES[i % COLORES.length], 'stroke-width': 18,
      'stroke-dasharray': `${Math.max(0, largo - 1.5)} ${C}`, 'stroke-dashoffset': -acum, transform: 'rotate(-90 75 75)'
    }, s('title', {}, `${t.label}: ${t.votos} (${pct(t.votos, total)}%)`));
    acum += largo;
    return el;
  });
  return s('svg', { viewBox: '0 0 150 150', role: 'img', 'aria-label': 'Distribución de respuestas' },
    s('circle', { cx: 75, cy: 75, r: R, fill: 'none', stroke: 'rgba(255,255,255,.08)', 'stroke-width': 18 }),
    ...arcos,
    s('text', { x: 75, y: 76, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 800 }, trozos.length ? `${pct(trozos[0].votos, total)}%` : '—'),
    s('text', { x: 75, y: 94, 'text-anchor': 'middle', 'font-size': 10, fill: '#9fb5ab' }, trozos.length ? 'líder' : 'sin datos')
  );
}

function construirTarjeta(p) {
  const filas = new Map();
  const lista = h('div', { class: 'filas' });
  for (const o of p.opciones) {
    const barra = h('i', { class: 'barra' });
    const num = h('em', {});
    const fila = h('button', { type: 'button', class: 'fila', onclick: () => alternarFiltro(p.id, o.id, p.tipo), 'aria-pressed': 'false', title: 'Filtrar por esta opción' },
      barra, h('span', { class: 'dato' }, h('span', {}, o.label), num));
    filas.set(o.id, { fila, barra, num, label: o.label });
    lista.append(fila);
  }
  const donaCaja = p.tipo === 'unica' ? h('div', { class: 'dona' }) : null;
  const cuerpo = h('div', { class: 'q__cuerpo' }, donaCaja, lista);
  const el = h('article', { class: 'q' },
    h('div', { class: 'q__cab' }, h('div', { class: 'q__ico' }, icono(p.icono)),
      h('div', {}, h('h3', {}, p.titulo), h('small', {}, `${p.seccion} · ${p.tipo === 'unica' ? 'Una opción' : `Hasta ${p.max} opciones`}`))),
    cuerpo);
  $('rejilla').append(el);
  tarjetas.set(p.id, { el, filas, donaCaja, p });
}

function pintarPreguntas(d) {
  for (const p of d.preguntas) {
    if (!tarjetas.has(p.id)) construirTarjeta(p);
    const t = tarjetas.get(p.id);
    const ordenadas = [...p.opciones].sort((a, b) => b.votos - a.votos);
    const maximo = Math.max(1, ...p.opciones.map((o) => o.votos));
    ordenadas.forEach((o, i) => {
      const f = t.filas.get(o.id);
      if (!f) return;
      f.fila.style.order = i;
      f.barra.style.width = `${(o.votos / maximo) * 100}%`;
      const porc = pct(o.votos, d.total);
      f.num.replaceChildren(`${o.votos}`, h('b', {}, `${porc}%`));
      f.fila.classList.toggle('cero', o.votos === 0);
      const on = est.filtros.includes(`${p.id}:${o.id}`);
      f.fila.classList.toggle('on', on);
      f.fila.setAttribute('aria-pressed', String(on));
    });
    if (t.donaCaja) t.donaCaja.replaceChildren(dona(p.opciones));
  }
}

// ---------- textos (otro y canciones) ----------
function pintarTextos(d) {
  for (const tx of d.textos) {
    let p = paneles.get(tx.id);
    if (!p) {
      const ul = h('ul', { class: 'lista' });
      const nota = h('span', {});
      const el = h('article', { class: 'q' },
        h('div', { class: 'q__cab' }, h('div', { class: 'q__ico' }, icono(tx.id === 'cancion' ? 'disc' : 'music')), h('div', {}, h('h3', {}, tx.titulo), nota)), ul);
      $('textos').append(el);
      p = { ul, nota, el };
      paneles.set(tx.id, p);
    }
    const lista = tx.respuestas.filter((r) => !est.busqueda || norm(r.valor).includes(est.busqueda));
    p.nota.textContent = `${tx.respuestas.reduce((a, r) => a + r.n, 0)} respuestas`;
    p.nota.className = '';
    p.ul.replaceChildren(...(lista.length
      ? lista.map((r) => h('li', {}, h('span', {}, r.valor), h('em', {}, r.n > 1 ? `×${r.n}` : '')))
      : [h('li', {}, h('span', {}, 'Sin respuestas todavía.'))]));
  }
}

// ---------- vista (sección y búsqueda) ----------
function aplicarVista() {
  if (!est.datos) return;
  for (const [id, t] of tarjetas) {
    const okSeccion = est.seccion === 'todas' || t.p.seccion === est.seccion;
    let visibles = 0;
    for (const [, f] of t.filas) {
      const ok = !est.busqueda || norm(f.label).includes(est.busqueda);
      f.fila.hidden = !ok;
      if (ok) visibles++;
    }
    t.el.hidden = !okSeccion || visibles === 0;
  }
  for (const [id, p] of paneles) {
    p.el.hidden = est.seccion === 'Menú';
  }
  pintarTextos(est.datos);
}

function pintar() {
  const d = est.datos;
  pintarKpis(d);
  pintarTiempo(d);
  pintarPreguntas(d);
  pintarActivos();
  aplicarVista();
}

// ---------- exportar ----------
$('btnCsv').addEventListener('click', () => {
  const d = est.datos;
  if (!d) return;
  const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;
  const filas = [['Pregunta', 'Opción', 'Votos', 'Porcentaje']];
  for (const p of d.preguntas) for (const o of [...p.opciones].sort((a, b) => b.votos - a.votos)) filas.push([p.titulo, o.label, o.votos, `${pct(o.votos, d.total)}%`]);
  for (const t of d.textos) for (const r of t.respuestas) filas.push([t.titulo, r.valor, r.n, '']);
  const csv = `﻿${filas.map((f) => f.map(esc).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: `resultados-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

setInterval(() => { if (est.datos && kpis && est.datos.tiempos.length) kpis.ultima.v.textContent = hace(est.datos.tiempos.at(-1)); }, 30000);

// ---------- arranque ----------
(async function () {
  try {
    await api('/api/admin/datos');
    await iniciarPanel();
  } catch {
    mostrarAcceso();
  }
})();
