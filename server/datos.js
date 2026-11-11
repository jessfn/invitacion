// Datos del evento y definición de las encuestas.
// Para cambiar fecha, lugar o menú basta con editar este archivo.

export const EVENTO = {
  titulo: 'Fiesta de Fin de Año 2026',
  organiza: 'DGTIC',
  // Formato ISO con zona horaria, p. ej. '2026-12-12T15:00:00-06:00'.
  // (Viernes 4 de diciembre de 2026, 3:00 pm). Si se deja en null se muestra "Fecha por confirmar" y se oculta la cuenta regresiva.
  fecha: '2026-12-04T15:00:00-06:00',
  lugar: 'CENSODEP',
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
    desplegable: true,
    otro: true,
    opciones: [
      { id: 'instrumental', label: 'Instrumental / Jazz suave' },
      { id: 'baladas', label: 'Baladas románticas' },
      { id: 'pop-acustico', label: 'Pop acústico' },
      { id: 'bossa', label: 'Bossa nova y lounge' },
      { id: 'clasicos', label: 'Clásicos en español' },
      { id: 'clasicos-ingles', label: 'Clásicos en inglés' },
      { id: 'mariachi', label: 'Mariachi y trova' },
      { id: 'boleros', label: 'Boleros' },
      { id: 'navidenas', label: 'Música navideña' },
      { id: 'otro', label: 'Otro…', otro: true }
    ]
  },
  {
    id: 'musica-baile',
    titulo: 'Música para bailar',
    descripcion: '¿Qué géneros quieres en la pista?',
    icono: 'music',
    tipo: 'multiple',
    desplegable: true,
    otro: true,
    max: 5,
    opciones: [
      { id: 'cumbia', label: 'Cumbia' },
      { id: 'cumbia-sonidera', label: 'Cumbia sonidera' },
      { id: 'cumbia-nortena', label: 'Cumbia norteña' },
      { id: 'salsa', label: 'Salsa' },
      { id: 'merengue', label: 'Merengue' },
      { id: 'bachata', label: 'Bachata' },
      { id: 'vallenato', label: 'Vallenato' },
      { id: 'banda', label: 'Banda' },
      { id: 'norteno', label: 'Norteño' },
      { id: 'corridos', label: 'Corridos tumbados' },
      { id: 'regional', label: 'Regional mexicano' },
      { id: 'reggaeton', label: 'Reggaetón' },
      { id: 'reggaeton-old', label: 'Reggaetón old school' },
      { id: 'perreo', label: 'Perreo' },
      { id: 'trap', label: 'Trap' },
      { id: 'hiphop', label: 'Hip hop / Rap' },
      { id: 'urbano', label: 'Urbano latino' },
      { id: 'pop-es', label: 'Pop en español' },
      { id: 'pop-en', label: 'Pop en inglés' },
      { id: 'rock-es', label: 'Rock en español' },
      { id: 'rock-en', label: 'Rock en inglés' },
      { id: 'electronica', label: 'Electrónica / House' },
      { id: 'disco', label: 'Disco y funk' },
      { id: 'ochentas', label: 'Éxitos de los 80s' },
      { id: 'noventas', label: 'Éxitos de los 90s' },
      { id: 'dosmiles', label: 'Éxitos de los 2000s' },
      { id: 'tropical', label: 'Tropical / Sonidero' },
      { id: 'kpop', label: 'K-pop' },
      { id: 'otro', label: 'Otro…', otro: true }
    ]
  },
  {
    id: 'cancion',
    titulo: 'Pide tu canción',
    descripcion: 'Opcional: dinos qué canción quieres escuchar.',
    icono: 'disc',
    tipo: 'cancion',
    maxLength: 60
  }
];

export const ENCUESTAS_POR_ID = new Map(ENCUESTAS.map((e) => [e.id, e]));
