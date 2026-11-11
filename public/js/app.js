import { lanzarConfeti } from './fondo.js';
import { obtenerHuella } from './huella.js';
import * as musica from './musica.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);

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

const vibrar = (ms = 10) => navigator.vibrate?.(ms);
const limpio = (t) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '');

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
  const larga = fecha ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(fecha) : '';
  const hora = fecha ? new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(fecha) : '';
  $('fechaTexto').textContent = fecha ? `${larga} · ${ev.lugar}` : `${ev.lugar} · fecha por confirmar`;
  $('det-fecha').textContent = fecha ? `${larga} · ${hora}` : 'Por confirmar';
  $('det-lugar').textContent = ev.lugar;
  $('det-direccion').textContent = ev.direccion ?? '';
  $('det-recepcion').textContent = ev.recepcion;
  if (ev.mapa && /^https:\/\//.test(ev.mapa)) {
    const a = $('det-mapa');
    a.href = ev.mapa;
    a.hidden = false;
    // El nombre y la dirección también llevan al mapa al tocarlos.
    const lugar = $('det-lugar');
    lugar.replaceChildren(h('a', { href: ev.mapa, target: '_blank', rel: 'noopener noreferrer', class: 'enlace-lugar' }, ev.lugar));
    $('det-direccion').replaceChildren(h('a', { href: ev.mapa, target: '_blank', rel: 'noopener noreferrer', class: 'enlace-dir' }, ev.direccion ?? ''));
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
  observar('.linea li');
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

function observar(selector) {
  const items = document.querySelectorAll(selector);
  if (!('IntersectionObserver' in window)) return items.forEach((i) => i.classList.add('visible'));
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
  }, { threshold: 0.12 });
  items.forEach((i) => obs.observe(i));
}

// ---------- efectos ligeros ----------
function iniciarEfectos() {
  const luces = $('luces');
  const n = Math.max(8, Math.round(innerWidth / 56));
  luces.replaceChildren(...Array.from({ length: n }, () => h('b')));

  // Título letra por letra (solo opacidad y transform)
  let k = 0;
  const trocear = (nodo) => {
    for (const hijo of [...nodo.childNodes]) {
      if (hijo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        // Cada palabra va en un contenedor que no se parte, para que las letras no se separen.
        hijo.textContent.split(/(\s+)/).forEach((trozo) => {
          if (!trozo) return;
          if (/^\s+$/.test(trozo)) { frag.append(' '); return; }
          const palabra = h('span', { class: 'palabra' });
          if (nodo.tagName === 'EM') {
            // El degradado de texto no funciona con letras sueltas: se anima la palabra completa.
            const sp = h('span', { class: 'letra', 'aria-hidden': 'true' }, trozo);
            sp.style.animationDelay = `${0.15 + k++ * 0.03}s, 0s`;
            frag.append(sp);
            return;
          }
          for (const ch of trozo) {
            const sp = h('span', { class: 'letra', 'aria-hidden': 'true' }, ch);
            sp.style.animationDelay = `${0.15 + k++ * 0.03}s`;
            palabra.append(sp);
          }
          frag.append(palabra);
        });
        hijo.replaceWith(frag);
      } else trocear(hijo);
    }
  };
  trocear($('tituloCinetico'));

  // Scroll: un solo rAF por cuadro
  const barra = $('scrollBarra');
  const linea = $('linea');
  let pendiente = false;
  const pintar = () => {
    pendiente = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    barra.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    const r = linea.getBoundingClientRect();
    linea.style.setProperty('--prog', Math.max(0, Math.min(1, (innerHeight * 0.75 - r.top) / r.height)).toFixed(3));
  };
  addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } }, { passive: true });
  pintar();

  document.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--d', `${(i % 3) * 0.07}s`));
  observar('.reveal');

  // Foco de luz en tarjetas (solo con ratón)
  if (matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.tile').forEach((t) => {
      t.addEventListener('pointermove', (e) => {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        t.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      }, { passive: true });
    });
  }
}

// ---------- encuesta ----------
const caja = $('encuesta-caja');
let encuestas = [];
let paso = 0;
let respuestas = {};
let error = '';
let enviando = false;
let atras = false;
let modalActivo = null;

const OTRO = (enc) => `${enc.id}_otro`;

function seleccion(enc) {
  const v = respuestas[enc.id];
  if (enc.tipo === 'unica') return v ? [v] : [];
  return Array.isArray(v) ? v : [];
}

function completa(enc) {
  if (enc.tipo === 'texto') return true;
  if (enc.tipo === 'cancion') {
    const c = respuestas[enc.id] ?? {};
    const a = limpio(c.artista);
    const t = limpio(c.tema);
    return (!a && !t) || Boolean(a && t);
  }
  const sel = seleccion(enc);
  if (!sel.length) return false;
  return !(sel.includes('otro') && !limpio(respuestas[OTRO(enc)]));
}

function textoRespuesta(enc) {
  if (enc.tipo === 'cancion') {
    const c = respuestas[enc.id] ?? {};
    return limpio(c.artista) ? `${limpio(c.artista)} — ${limpio(c.tema)}` : 'Sin canción';
  }
  return seleccion(enc)
    .map((id) => (id === 'otro' ? `Otro: ${limpio(respuestas[OTRO(enc)])}` : enc.opciones.find((o) => o.id === id)?.label ?? id))
    .join(', ');
}

function ir(delta) {
  atras = delta < 0;
  paso = Math.max(0, Math.min(encuestas.length, paso + delta));
  error = '';
  dibujar();
  caja.closest('.encuesta-marco').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function dibujar() {
  const total = encuestas.length;
  const enResumen = paso >= total;
  const progreso = h('div', { class: 'progreso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': Math.min(paso, total) },
    Array.from({ length: total + 1 }, (_, i) => h('i', { class: i <= paso ? 'hecho' : '' })));
  caja.replaceChildren(
    progreso,
    h('div', { class: 'paso__contador' }, enResumen ? 'Revisa tus respuestas' : `Pregunta ${paso + 1} de ${total}`),
    h('div', { class: `paso${atras ? ' paso--atras' : ''}` }, enResumen ? vistaResumen() : vistaPregunta(encuestas[paso]))
  );
  atras = false;
}

// La pregunta de la canción retoma los géneros que la persona acaba de elegir.
function descripcionDe(enc) {
  if (enc.tipo !== 'cancion') return enc.descripcion;
  const gustos = encuestas.find((e) => e.id === 'musica-baile');
  const txt = gustos ? textoRespuesta(gustos) : '';
  return txt ? `Ya elegiste ${txt}. ¿Qué canción no puede faltar? (opcional)` : enc.descripcion;
}

function cabecera(icon, titulo, desc, enc) {
  return h('div', { class: 'paso__intro' },
    enc?.seccion ? h('span', { class: 'paso__seccion' }, enc.seccion) : null,
    h('div', { class: 'paso__cab' },
      h('div', { class: 'paso__icono' }, icono(icon)),
      h('div', {}, h('h3', {}, titulo), h('p', { class: 'paso__desc' }, desc))
    ),
    enc?.explica ? h('p', { class: 'explica' }, icono('info'), h('span', {}, h('b', {}, '¿Qué es? '), enc.explica)) : null
  );
}

// La pregunta se construye una sola vez; los toques solo actualizan atributos (sin re-render).
function vistaPregunta(enc) {
  const esUltima = paso === encuestas.length - 1;
  const btnSig = h('button', { type: 'button', class: 'boton', onclick: () => ir(1) }, esUltima ? 'Revisar' : 'Siguiente', icono('arrow-r'));
  const btnAtras = paso > 0
    ? h('button', { type: 'button', class: 'boton boton--fantasma', onclick: () => ir(-1), 'aria-label': 'Anterior' }, icono('arrow-l'))
    : null;
  const ayuda = h('span', { class: 'paso__ayuda' });
  let cuerpo;
  let refrescar = () => {};

  if (enc.tipo === 'cancion') {
    respuestas[enc.id] ??= { artista: '', tema: '' };
    const campo = (clave, etiqueta, ph) =>
      h('label', { class: 'etiqueta' }, etiqueta,
        h('input', {
          class: 'campo', type: 'text', maxlength: enc.maxLength, placeholder: ph, autocomplete: 'off', enterkeyhint: 'next',
          value: respuestas[enc.id][clave],
          oninput: (e) => { respuestas[enc.id][clave] = e.target.value; refrescar(); }
        }));
    cuerpo = h('div', { class: 'campos' }, campo('artista', 'Artista', 'Ej. Chocolate Khan'), campo('tema', 'Canción', 'Ej. Mayonesa'));
    refrescar = () => {
      btnSig.disabled = !completa(enc);
      ayuda.textContent = completa(enc) ? 'Opcional · puedes dejarlo vacío' : 'Escribe artista y canción';
    };
  } else {
    const botones = new Map();
    const lista = h('div', { class: `opciones${enc.tipo === 'multiple' ? ' multi' : ''}`, role: enc.tipo === 'unica' ? 'radiogroup' : 'group', 'aria-label': enc.titulo });
    for (const o of enc.opciones) {
      const b = h('button', { type: 'button', class: 'opcion', role: enc.tipo === 'unica' ? 'radio' : 'checkbox', 'aria-checked': 'false', onclick: () => elegir(o) },
        h('span', { class: 'marca' }, icono('check')),
        h('span', {}, o.label, o.desc ? h('small', {}, o.desc) : null));
      botones.set(o.id, b);
      lista.append(b);
    }

    const campoOtro = enc.otro
      ? h('input', {
          class: 'campo otro', type: 'text', maxlength: 60, placeholder: '¿Cuál? Escríbelo aquí', autocomplete: 'off', hidden: true,
          'aria-label': 'Otro', value: respuestas[OTRO(enc)] ?? '',
          oninput: (e) => { respuestas[OTRO(enc)] = e.target.value; refrescar(); }
        })
      : null;

    let etiquetaBoton;
    let subBoton;
    let contadorModal = null;
    let botonAbrir = null;
    let abrirModal = () => {};

    if (enc.desplegable) {
      etiquetaBoton = h('span', {});
      subBoton = h('small', {});
      botonAbrir = h('button', { type: 'button', class: 'desplegable__boton', 'aria-haspopup': 'dialog', onclick: () => abrirModal() },
        h('span', {}, etiquetaBoton, subBoton), icono('chevron'));
      cuerpo = h('div', { class: 'desplegable' }, botonAbrir);
    } else {
      cuerpo = h('div', {}, lista, campoOtro);
    }

    // Ventana modal: hoja inferior en celular y diálogo centrado en computadora, con scroll interno.
    abrirModal = () => {
      const dlg = h('dialog', { class: 'modal', 'aria-label': enc.titulo });
      const cerrarDlg = () => dlg.close();
      const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const vacio = h('p', { class: 'modal__vacio', hidden: true }, 'No encontramos ese estilo. Usa «Otro…» para escribirlo.');
      const buscador = enc.opciones.length > 10
        ? h('input', {
            class: 'campo modal__buscar', type: 'search', placeholder: 'Buscar…', autocomplete: 'off', 'aria-label': 'Buscar',
            oninput: (e) => {
              const q = norm(e.target.value.trim());
              let visibles = 0;
              for (const [id, b] of botones) {
                const o = enc.opciones.find((x) => x.id === id);
                const ok = !q || o.otro || norm(o.label).includes(q);
                b.hidden = !ok;
                if (ok) visibles++;
              }
              vacio.hidden = visibles > 0;
            }
          })
        : null;
      contadorModal = h('span', { class: 'paso__ayuda' });
      dlg.append(
        h('div', { class: 'modal__hoja' },
          h('div', { class: 'modal__cab' },
            h('div', {}, h('h3', {}, enc.titulo), contadorModal),
            h('button', { type: 'button', class: 'modal__x', 'aria-label': 'Cerrar', onclick: cerrarDlg }, icono('x'))),
          buscador,
          h('div', { class: 'modal__cuerpo' }, lista, vacio, campoOtro),
          h('div', { class: 'modal__pie' }, h('button', { type: 'button', class: 'boton', onclick: cerrarDlg }, icono('check'), 'Listo'))
        )
      );
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', () => {
        document.documentElement.classList.remove('modal-abierto');
        dlg.remove();
        contadorModal = null;
        modalActivo = null;
        refrescar();
        botonAbrir?.focus({ preventScroll: true });
      });
      document.body.append(dlg);
      document.documentElement.classList.add('modal-abierto');
      modalActivo = dlg;
      refrescar();
      dlg.showModal();
    };

    function elegir(o) {
      vibrar();
      error = '';
      if (enc.tipo === 'unica') {
        respuestas[enc.id] = o.id;
        refrescar();
        if (o.otro) campoOtro?.focus();
        else if (modalActivo) modalActivo.close(); // solo cierra la ventana; no avanza de pregunta
        return;
      }
      let sel = seleccion(enc);
      if (sel.includes(o.id)) sel = sel.filter((x) => x !== o.id);
      else if (sel.length < enc.max) sel = [...sel, o.id];
      respuestas[enc.id] = sel;
      refrescar();
      if (o.otro && sel.includes('otro')) campoOtro?.focus();
    }

    refrescar = () => {
      const sel = seleccion(enc);
      const llena = enc.tipo === 'multiple' && sel.length >= enc.max;
      for (const [id, b] of botones) {
        const on = sel.includes(id);
        b.setAttribute('aria-checked', String(on));
        b.disabled = llena && !on;
      }
      if (campoOtro) campoOtro.hidden = !sel.includes('otro');
      ayuda.textContent = enc.tipo === 'unica' ? 'Elige 1 opción' : `Elige hasta ${enc.max} · ${sel.length}/${enc.max}`;
      if (etiquetaBoton) {
        const nombres = sel.map((id) => (id === 'otro' ? limpio(respuestas[OTRO(enc)]) || 'Otro' : enc.opciones.find((o) => o.id === id)?.label));
        const falta = sel.includes('otro') && !limpio(respuestas[OTRO(enc)]);
        etiquetaBoton.textContent = nombres.length ? nombres.join(', ') : 'Toca para elegir';
        subBoton.textContent = falta ? 'Falta escribir cuál en «Otro»'
          : enc.tipo === 'multiple' ? `${sel.length} de ${enc.max} elegidas` : 'Toca para cambiar';
      }
      if (contadorModal) contadorModal.textContent = enc.tipo === 'unica' ? 'Elige 1 opción' : `Elige hasta ${enc.max} · ${sel.length}/${enc.max}`;
      btnSig.disabled = !completa(enc);
    };
  }

  refrescar();
  return [
    cabecera(enc.icono, enc.titulo, descripcionDe(enc), enc),
    ayuda,
    cuerpo,
    error ? h('p', { class: 'error', role: 'alert' }, error) : null,
    h('div', { class: 'acciones' }, btnAtras, btnSig)
  ];
}

function vistaResumen() {
  return [
    cabecera('star', 'Todo listo', 'Una vez enviadas no se podrán cambiar.'),
    h('ul', { class: 'resumen' },
      encuestas.map((enc) => h('li', {}, icono(enc.icono), h('div', {}, h('b', {}, enc.titulo), textoRespuesta(enc))))
    ),
    // Campo trampa para bots: las personas no lo ven ni lo llenan.
    h('input', { class: 'trampa', type: 'text', name: 'sitio', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', id: 'trampa' }),
    error ? h('p', { class: 'error', role: 'alert' }, error) : null,
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'boton boton--fantasma', onclick: () => ir(-1), 'aria-label': 'Anterior' }, icono('arrow-l')),
      h('button', { type: 'button', class: 'boton', disabled: enviando, onclick: enviar }, icono('send'), enviando ? 'Enviando…' : 'Enviar mis votos')
    )
  ];
}

function cargaUtil() {
  const out = {};
  for (const enc of encuestas) {
    if (enc.tipo === 'cancion') {
      const c = respuestas[enc.id] ?? {};
      if (limpio(c.artista) && limpio(c.tema)) out[enc.id] = { artista: limpio(c.artista), tema: limpio(c.tema) };
      continue;
    }
    const sel = seleccion(enc);
    out[enc.id] = enc.tipo === 'unica' ? sel[0] : sel;
    if (sel.includes('otro')) out[OTRO(enc)] = limpio(respuestas[OTRO(enc)]);
  }
  return out;
}

async function enviar() {
  if (enviando) return;
  enviando = true;
  error = '';
  dibujar();
  try {
    await pedir('/api/votar', { method: 'POST', body: JSON.stringify({ respuestas: cargaUtil(), sitio: $('trampa')?.value ?? '' }) });
    vibrar([20, 40, 20]);
    await mostrarResultados(true);
  } catch (e) {
    if (e.estado === 409 || e.datos?.yaVoto) await mostrarResultados(false);
    else {
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
  caja.replaceChildren(
    h('div', { class: 'gracias' },
      h('div', { class: 'sello' }, icono('check')),
      h('h3', {}, recienVotado ? '¡Gracias por ' : 'Ya ', h('em', {}, recienVotado ? 'votar!' : 'participaste')),
      h('p', {}, 'Este celular ya registró sus respuestas. Nos vemos en la fiesta.')
    ),
    h('ul', { class: 'resumen' },
      datos.preguntas.map((p) => h('li', {}, icono(p.icono), h('div', {}, h('b', {}, p.titulo), p.mias.join(', '))))
    )
  );
  if (recienVotado) lanzarConfeti();
}

// ---------- arranque ----------
async function iniciar() {
  try {
    const datos = await pedir('/api/evento');
    pintarEvento(datos.evento);
    encuestas = datos.encuestas;
    if (datos.yaVoto) await mostrarResultados(false);
    else dibujar();
  } catch (e) {
    caja.replaceChildren(h('p', { class: 'error', role: 'alert' }, 'No pudimos cargar la encuesta. Recarga la página.'));
    console.error(e);
  }
}

iniciarEfectos();
iniciar();

// ---------- portada y música ----------
const portada = $('portada');
const btnMusica = $('btnMusica');
document.documentElement.classList.add('portada-abierta');
btnMusica.hidden = true;

function pintarBotonMusica(suena, cargando = false) {
  btnMusica.classList.toggle('cargando', Boolean(cargando));
  btnMusica.classList.toggle('apagada', !suena);
  btnMusica.setAttribute('aria-pressed', String(suena));
  btnMusica.setAttribute('aria-label', suena ? 'Silenciar música' : 'Activar música');
  btnMusica.querySelector('use').setAttribute('href', suena ? '#i-volume' : '#i-volume-off');
}
musica.alCambiar(pintarBotonMusica);
btnMusica.addEventListener('click', () => musica.alternar());
// La pista se prepara una sola vez en segundo plano mientras se ve la portada.
setTimeout(() => musica.precargar().catch(() => {}), 700);

$('btnEntrar').addEventListener('click', async () => {
  await musica.iniciar(); // el clic es el gesto que permite reproducir sonido
  portada.classList.add('fuera');
  document.documentElement.classList.remove('portada-abierta');
  btnMusica.hidden = false;
  setTimeout(() => portada.remove(), 700);
});
$('btnEntrar').focus({ preventScroll: true });
