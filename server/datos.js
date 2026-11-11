// Datos del evento y definición de las encuestas.
// Para cambiar fecha, lugar o menú basta con editar este archivo.

export const EVENTO = {
  titulo: 'Fiesta de Fin de Año 2026',
  organiza: 'DGTIC',
  // Formato ISO con zona horaria, p. ej. '2026-12-12T15:00:00-06:00'.
  // Si se deja en null se muestra "Fecha por confirmar" y se oculta la cuenta regresiva.
  fecha: null,
  lugar: 'Banquetes Yahad',
  direccion: '',
  mapa: '',
  recepcion: '3:00 pm',
  incluye: [
    'Pan',
    'Agua natural',
    'Refresco (Coca-Cola, Squirt, Manzana, Tehuacán)',
    'Agua de sabor (horchata o jamaica)',
    'Hielo',
    'Capitán de meseros y 1 mesero por cada 20 comensales',
    'Café'
  ],
  programa: [
    { hora: '3:00 pm', titulo: 'Recepción', icono: 'users', texto: 'Llegada y acomodo en mesas, con música de fondo. Sin servicio de meseros ni bebidas.' },
    { hora: '3:30 pm', titulo: 'Inicia el servicio', icono: 'glass', texto: 'Meseros y bebidas. Apertura de la pista de baile.' },
    { hora: '4:00 pm', titulo: 'Comida', icono: 'utensils', texto: 'Menú a dos tiempos con guarnición.' },
    { hora: '5:00 pm', titulo: 'Cabina fotográfica', icono: 'camera', texto: 'Horario por confirmar.' },
    { hora: '7:00 pm', titulo: 'Dinámicas', icono: 'sparkles', texto: 'Juegos y convivencia.' },
    { hora: '8:00 pm', titulo: 'Rifa', icono: 'gift', texto: 'Mucha suerte a todos.' },
    { hora: '9:00 pm', titulo: 'Karaoke', icono: 'mic', texto: 'Saca la estrella que llevas dentro.' },
    { hora: '11:30 pm', titulo: 'Batucada', icono: 'drum', texto: 'Con entrada de Pikachu y robot LED.' },
    { hora: '12:30 am', titulo: 'Salida', icono: 'door', texto: 'Hasta la próxima, equipo.' }
  ]
};

// tipo: 'unica' (una opción) | 'multiple' (hasta "max") | 'texto' (respuesta libre opcional)
export const ENCUESTAS = [
  {
    id: 'entrada',
    titulo: 'Primer tiempo',
    descripcion: '¿Qué te gustaría que sirvan de entrada?',
    icono: 'soup',
    tipo: 'unica',
    opciones: [
      { id: 'crema-brocoli', label: 'Crema de brócoli' },
      { id: 'crema-cilantro', label: 'Crema de cilantro' },
      { id: 'crema-zanahoria', label: 'Crema de zanahoria' },
      { id: 'espagueti-perejil', label: 'Espagueti al perejil' },
      { id: 'espagueti-pomodoro', label: 'Espagueti pomodoro' },
      { id: 'espagueti-crema', label: 'Espagueti a la crema' }
    ]
  },
  {
    id: 'fuerte',
    titulo: 'Segundo tiempo',
    descripcion: 'Elige tu plato fuerte favorito.',
    icono: 'utensils',
    tipo: 'unica',
    opciones: [
      { id: 'lomo-3-chiles', label: 'Lomo a los 3 chiles' },
      { id: 'lomo-jugo', label: 'Lomo en su jugo' },
      { id: 'pechuga-3-chiles', label: 'Pechuga cordón blue a los 3 chiles' },
      { id: 'pechuga-tamarindo', label: 'Pechuga cordón blue en salsa de tamarindo' },
      { id: 'pierna-crema', label: 'Pierna o muslo a la crema con elote y rajas' }
    ]
  },
  {
    id: 'guarnicion',
    titulo: 'Guarnición',
    descripcion: '¿Con qué lo acompañamos?',
    icono: 'leaf',
    tipo: 'unica',
    opciones: [
      { id: 'verduras', label: 'Verduras a la mantequilla', desc: 'Brócoli y zanahoria' },
      { id: 'pure', label: 'Puré de papa' }
    ]
  },
  {
    id: 'musica-comida',
    titulo: 'Música para la comida',
    descripcion: 'Ambiente mientras comemos.',
    icono: 'headphones',
    tipo: 'unica',
    opciones: [
      { id: 'instrumental', label: 'Instrumental / Jazz suave' },
      { id: 'baladas', label: 'Baladas románticas' },
      { id: 'pop-acustico', label: 'Pop acústico' },
      { id: 'bossa', label: 'Bossa nova y lounge' },
      { id: 'clasicos', label: 'Clásicos en español' },
      { id: 'mariachi', label: 'Mariachi y trova' }
    ]
  },
  {
    id: 'musica-baile',
    titulo: 'Música para bailar',
    descripcion: '¿Qué géneros quieres en la pista?',
    icono: 'music',
    tipo: 'multiple',
    max: 3,
    opciones: [
      { id: 'cumbia', label: 'Cumbia' },
      { id: 'salsa', label: 'Salsa' },
      { id: 'merengue', label: 'Merengue y bachata' },
      { id: 'banda', label: 'Banda' },
      { id: 'norteno', label: 'Norteño' },
      { id: 'reggaeton', label: 'Reggaetón' },
      { id: 'pop', label: 'Pop en español' },
      { id: 'rock', label: 'Rock en español' },
      { id: 'electronica', label: 'Electrónica / House' },
      { id: 'ochentas-noventas', label: 'Éxitos 80s y 90s' },
      { id: 'tropical', label: 'Tropical / Sonidero' },
      { id: 'urbano', label: 'Urbano / Hip hop' }
    ]
  },
  {
    id: 'musica-no',
    titulo: 'Música que NO quieres',
    descripcion: 'Para que el DJ sepa qué evitar.',
    icono: 'ban',
    tipo: 'multiple',
    max: 3,
    opciones: [
      { id: 'no-banda', label: 'Banda' },
      { id: 'no-norteno', label: 'Norteño' },
      { id: 'no-reggaeton', label: 'Reggaetón' },
      { id: 'no-electronica', label: 'Electrónica' },
      { id: 'no-rock', label: 'Rock' },
      { id: 'no-baladas', label: 'Baladas' },
      { id: 'no-cumbia', label: 'Cumbia' },
      { id: 'no-urbano', label: 'Urbano / Hip hop' },
      { id: 'ninguna', label: 'Me gusta todo' }
    ]
  },
  {
    id: 'cancion',
    titulo: 'Canción para abrir la pista',
    descripcion: 'Opcional: escribe una canción y su artista.',
    icono: 'disc',
    tipo: 'texto',
    maxLength: 80,
    placeholder: 'Ej. Mayonesa - Chocolate Khan'
  }
];

export const ENCUESTAS_POR_ID = new Map(ENCUESTAS.map((e) => [e.id, e]));
