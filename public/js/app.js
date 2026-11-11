import { lanzarConfeti } from './fondo.js';
import { obtenerHuella } from './huella.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const MARCA_LOCAL = 'dgtic2026:voto';

// ---------- utilidades ----------
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

const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const vibrar = (ms = 12) => navigator.vibrate?.(ms);

async function pedir(ruta, opciones = {}) {
  const huella = await obtenerHuella();
  const res = await fetch(ruta, {
    credentials: 'same-origin',
    ...opciones,
    headers: { 'X-Huella': huella, ...(opciones.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos.error ?? 'Error de red'), { estado: res.status, datos });
  return datos;
}

// ---------- invitación ----------
function pintarEvento(ev) {
  const fecha = ev.fecha ? new Date(ev.fecha) : null;
  const larga = fecha
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(fecha)
    : 'Fecha por confirmar';
  const hora = fecha ? new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(fecha) : '';
  $('fechaTexto').textContent = fecha ? `${larga} · ${ev.lugar}` : `${ev.lugar} · fecha por confirmar`;
  $('det-fecha').textContent = fecha ? `${larga}${hora ? ` · ${hora}` : ''}` : 'Por confirmar';
  $('det-lugar').textContent = ev.direccion ? `${ev.lugar} — ${ev.direccion}` : ev.lugar;
  $('det-recepcion').textContent = ev.recepcion;
  if (ev.mapa && /^https:\/\//.test(ev.mapa)) {
    const a = $('det-mapa');
    a.href = ev.mapa;
    a.hidden = false;
  }
  $('lista-incluye').replaceChildren(...ev.incluye.map((t) => h('li', {}, t)));
  $('linea').replaceChildren(
    ...ev.programa.map((p) =>
      h('li', {},
        h('span', { class: 'punto' }, icono(p.icono)),
        h('div', {}, h('span', { class: 'hora' }, p.hora), h('h3', {}, p.titulo), h('p', {}, p.texto))
      )
    )
  );
  observarLinea();
  if (fecha) iniciarCuenta(fecha);
}

function iniciarCuenta(fecha) {
  const caja = $('cuenta');
  const tic = () => {
    const falta = fecha - Date.now();
    if (falta <= 0) { caja.hidden = true; return; }
    caja.hidden = false;
    const s = Math.floor(falta / 1000);
    $('cd-d').textContent = Math.floor(s / 86400);
    $('cd-h').textContent = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
    $('cd-m').textContent = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    $('cd-s').textContent = String(s % 60).padStart(2, '0');
  };
  tic();
  setInterval(tic, 1000);
}

function observarLinea() {
  const items = document.querySelectorAll('.linea li');
  if (!('IntersectionObserver' in window)) return items.forEach((i) => i.classList.add('visible'));
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
  }, { threshold: 0.2 });
  items.forEach((i) => obs.observe(i));
}

// ---------- encuesta ----------
const caja = $('encuesta-caja');
let encuestas = [];
let paso = 0;
let respuestas = {};
let error = '';
let enviando = false;
let atras = false;

const textoRespuesta = (enc, valor) => {
  if (enc.tipo === 'texto') return valor || 'Sin respuesta';
  const etiqueta = (id) => enc.opciones.find((o) => o.id === id)?.label ?? id;
  return Array.isArray(valor) ? valor.map(etiqueta).join(', ') : etiqueta(valor);
};

function completa(enc) {
  const v = respuestas[enc.id];
  if (enc.tipo === 'texto') return true;
  return enc.tipo === 'unica' ? Boolean(v) : Array.isArray(v) && v.length > 0;
}

function alternar(enc, opcion) {
  vibrar();
  error = '';
  if (enc.tipo === 'unica') {
    respuestas[enc.id] = opcion.id;
    dibujar();
    // Avanza solo al elegir en preguntas de opción única.
    setTimeout(() => { if (respuestas[enc.id] === opcion.id) ir(1); }, 320);
    return;
  }
  let lista = respuestas[enc.id] ?? [];
  if (lista.includes(opcion.id)) lista = lista.filter((x) => x !== opcion.id);
  else if (opcion.id === 'ninguna') lista = ['ninguna'];
  else if (lista.length < enc.max) lista = [...lista.filter((x) => x !== 'ninguna'), opcion.id];
  respuestas[enc.id] = lista;
  dibujar();
}

function ir(delta) {
  atras = delta < 0;
  paso = Math.max(0, Math.min(encuestas.length, paso + delta));
  error = '';
  dibujar();
  caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function dibujar() {
  const total = encuestas.length;
  const enResumen = paso >= total;
  const progreso = h('div', { class: 'progreso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': Math.min(paso, total) }, h('i'));
  progreso.firstChild.style.width = `${(Math.min(paso + 1, total + 1) / (total + 1)) * 100}%`;

  const contenido = enResumen ? vistaResumen() : vistaPregunta(encuestas[paso]);
  const marco = h('div', { class: `paso${atras ? ' paso--atras' : ''}` }, contenido);
  caja.replaceChildren(
    progreso,
    h('div', { class: 'paso__contador' }, enResumen ? 'Revisa tus respuestas' : `Pregunta ${paso + 1} de ${total}`),
    marco
  );
  atras = false;
}

function vistaPregunta(enc) {
  const valor = respuestas[enc.id];
  const ayuda =
    enc.tipo === 'unica' ? 'Elige 1 opción' :
    enc.tipo === 'multiple' ? `Elige hasta ${enc.max} · ${(valor ?? []).length}/${enc.max}` : 'Opcional';

  let cuerpo;
  if (enc.tipo === 'texto') {
    cuerpo = h('input', {
      class: 'campo', type: 'text', maxlength: enc.maxLength, placeholder: enc.placeholder,
      value: valor ?? '', autocomplete: 'off', 'aria-label': enc.titulo,
      oninput: (e) => { respuestas[enc.id] = e.target.value; },
      onkeydown: (e) => { if (e.key === 'Enter') ir(1); }
    });
  } else {
    const llena = enc.tipo === 'multiple' && (valor ?? []).length >= enc.max;
    cuerpo = h('div', { class: `opciones${enc.opciones.length > 6 ? ' opciones--dos' : ''}${enc.tipo === 'multiple' ? ' multi' : ''}`, role: enc.tipo === 'unica' ? 'radiogroup' : 'group', 'aria-label': enc.titulo },
      enc.opciones.map((o) => {
        const marcada = enc.tipo === 'unica' ? valor === o.id : (valor ?? []).includes(o.id);
        return h('button', {
          type: 'button', class: 'opcion', role: enc.tipo === 'unica' ? 'radio' : 'checkbox',
          'aria-checked': String(marcada), disabled: llena && !marcada,
          onclick: () => alternar(enc, o)
        },
          h('span', { class: 'marca' }, icono('check')),
          h('span', {}, o.label, o.desc ? h('small', {}, o.desc) : null)
        );
      })
    );
  }

  const esUltima = paso === encuestas.length - 1;
  return [
    h('div', { class: 'paso__cab' },
      h('div', { class: 'paso__icono' }, icono(enc.icono)),
      h('div', {}, h('h3', {}, enc.titulo), h('p', { class: 'paso__desc' }, enc.descripcion))
    ),
    h('span', { class: 'paso__ayuda' }, ayuda),
    cuerpo,
    error ? h('p', { class: 'error', role: 'alert' }, error) : null,
    h('div', { class: 'acciones' },
      paso > 0 ? h('button', { type: 'button', class: 'boton boton--fantasma', onclick: () => ir(-1), 'aria-label': 'Anterior' }, icono('arrow-l')) : null,
      h('button', { type: 'button', class: 'boton', disabled: !completa(enc), onclick: () => ir(1) },
        esUltima ? 'Revisar' : 'Siguiente', icono('arrow-r'))
    )
  ];
}

function vistaResumen() {
  return [
    h('div', { class: 'paso__cab' },
      h('div', { class: 'paso__icono' }, icono('star')),
      h('div', {}, h('h3', {}, 'Todo listo'), h('p', { class: 'paso__desc' }, 'Una vez enviadas no se podrán cambiar.'))
    ),
    h('ul', { class: 'resumen' },
      encuestas.map((enc, i) =>
        h('li', {}, icono(enc.icono),
          h('div', {}, h('b', {}, enc.titulo), textoRespuesta(enc, respuestas[enc.id])),
        )
      )
    ),
    // Campo trampa para bots: las personas no lo ven ni lo llenan.
    h('input', { class: 'trampa', type: 'text', name: 'sitio', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', id: 'trampa' }),
    error ? h('p', { class: 'error', role: 'alert' }, error) : null,
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'boton boton--fantasma', onclick: () => ir(-1), 'aria-label': 'Anterior' }, icono('arrow-l')),
      h('button', { type: 'button', class: 'boton', disabled: enviando, onclick: enviar },
        icono('send'), enviando ? 'Enviando…' : 'Enviar mis votos')
    )
  ];
}

async function enviar() {
  if (enviando) return;
  enviando = true;
  error = '';
  dibujar();
  try {
    const limpias = { ...respuestas };
    if (typeof limpias.cancion === 'string') limpias.cancion = limpias.cancion.trim();
    await pedir('/api/votar', {
      method: 'POST',
      body: JSON.stringify({ respuestas: limpias, sitio: $('trampa')?.value ?? '' })
    });
    guardar(MARCA_LOCAL, '1');
    vibrar([20, 40, 20]);
    await mostrarResultados(true);
  } catch (e) {
    if (e.estado === 409 || e.datos?.yaVoto) {
      guardar(MARCA_LOCAL, '1');
      await mostrarResultados(false);
    } else {
      error = e.message || 'No se pudo enviar. Intenta de nuevo.';
      enviando = false;
      dibujar();
    }
  } finally {
    enviando = false;
  }
}

async function mostrarResultados(recienVotado) {
  let datos;
  try {
    datos = await pedir('/api/resultados');
  } catch (e) {
    caja.replaceChildren(h('p', { class: 'error', role: 'alert' }, e.message));
    return;
  }
  const mensaje = recienVotado
    ? ['¡Gracias por votar!', 'Tus respuestas ya cuentan. Así van los resultados:']
    : ['Ya participaste', 'Este celular ya registró sus respuestas. Así van los resultados:'];

  const bloques = datos.preguntas.map((p) => {
    const maximo = Math.max(1, ...p.opciones.map((o) => o.votos));
    return h('div', { class: 'resultado' },
      h('h4', {}, icono(p.icono), p.titulo),
      p.opciones.map((o) => {
        const pct = datos.total ? Math.round((o.votos / datos.total) * 100) : 0;
        const barra = h('div', { class: `barra-res${o.mio ? ' mio' : ''}` },
          h('i'), h('div', {}, h('span', {}, o.label), h('em', {}, `${o.votos} · ${pct}%`)));
        requestAnimationFrame(() => requestAnimationFrame(() => { barra.firstChild.style.width = `${(o.votos / maximo) * 100}%`; }));
        return barra;
      })
    );
  });

  caja.replaceChildren(
    h('div', { class: 'gracias' },
      h('div', { class: 'sello' }, icono('check')),
      h('h3', {}, mensaje[0]),
      h('p', {}, mensaje[1])
    ),
    ...bloques,
    h('p', { class: 'total' }, `${datos.total} ${datos.total === 1 ? 'persona ha' : 'personas han'} participado`)
  );
  if (recienVotado) lanzarConfeti();
}

// ---------- arranque ----------
async function iniciar() {
  try {
    const datos = await pedir('/api/evento');
    pintarEvento(datos.evento);
    encuestas = datos.encuestas;
    if (datos.yaVoto) {
      await mostrarResultados(false);
    } else {
      if (leer(MARCA_LOCAL)) {
        // La marca local existe pero el servidor no reconoce el voto (p. ej. se reinició la base):
        // se limpia y se deja participar.
        try { localStorage.removeItem(MARCA_LOCAL); } catch {}
      }
      dibujar();
    }
  } catch (e) {
    caja.replaceChildren(h('p', { class: 'error', role: 'alert' }, 'No pudimos cargar la encuesta. Recarga la página.'));
    console.error(e);
  }
}

iniciar();
