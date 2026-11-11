// Datos del evento y definición de las encuestas.
// Para cambiar fecha, lugar o menú basta con editar este archivo.

export const EVENTO = {
  titulo: 'Fiesta de Fin de Año 2026',
  organiza: 'DGTIC',
  // Formato ISO con zona horaria, p. ej. '2026-12-12T15:00:00-06:00'.
  // (Viernes 4 de diciembre de 2026, 3:00 pm). Si se deja en null se muestra "Fecha por confirmar" y se oculta la cuenta regresiva.
  fecha: '2026-12-04T15:00:00-06:00',
  lugar: 'CENSODEP',
  direccion: 'Av. Sta. Ana 750, San Francisco Culhuacan, Ex-Ejido de San Francisco Culhuacan, Coyoacán, 04470 Ciudad de México, CDMX',
  mapa: 'https://www.google.com/maps/search/?api=1&query=Av.%20Sta.%20Ana%20750%2C%20San%20Francisco%20Culhuacan%2C%20Ex-Ejido%20de%20San%20Francisco%20Culhuacan%2C%20Coyoac%C3%A1n%2C%2004470%20Ciudad%20de%20M%C3%A9xico%2C%20CDMX',
  recepcion: '3:00 pm',
  avisos: [
    { icono: 'ticket', titulo: 'Acceso', texto: 'La entrada será únicamente con el pase exclusivo de cada invitado.' },
    { icono: 'car', titulo: 'Estacionamiento', texto: 'Tiene un costo aproximado de $80 MXN.' },
    { icono: 'wine', titulo: 'Bebidas alcohólicas', texto: 'No están incluidas en el evento: cada invitado lleva las que desee consumir. ¡Brindemos con responsabilidad!', fiesta: true }
  ],
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
    { hora: '9:00 pm', titulo: 'Batucada', icono: 'drum', texto: 'Con entrada de Pikachu y robot LED.' },
    { hora: '10:30 pm', titulo: 'Karaoke', icono: 'mic', texto: 'Saca la estrella que llevas dentro.' },
    { hora: '12:30 am', titulo: 'Salida', icono: 'door', texto: 'Hasta la próxima, equipo.' }
  ]
};

// Estilos tranquilos para la comida y géneros de baile (la comida también permite todos los géneros).
const SUAVES = [
      { id: 'instrumental', label: 'Instrumental / Jazz suave' },
      { id: 'baladas', label: 'Baladas románticas' },
      { id: 'pop-acustico', label: 'Pop acústico' },
      { id: 'bossa', label: 'Bossa nova y lounge' },
      { id: 'clasicos', label: 'Clásicos en español' },
      { id: 'clasicos-ingles', label: 'Clásicos en inglés' },
      { id: 'mariachi', label: 'Mariachi y trova' },
      { id: 'boleros', label: 'Boleros' },
      { id: 'navidenas', label: 'Música navideña' }
];

const GENEROS = [
      { id: 'cumbia', label: 'Cumbia' },
      { id: 'cumbia-sonidera', label: 'Cumbia sonidera' },
      { id: 'cumbia-nortena', label: 'Cumbia norteña' },
      { id: 'cumbia-rebajada', label: 'Cumbia rebajada' },
      { id: 'cumbia-pop', label: 'Cumbia pop' },
      { id: 'salsa', label: 'Salsa' },
      { id: 'merengue', label: 'Merengue' },
      { id: 'bachata', label: 'Bachata' },
      { id: 'vallenato', label: 'Vallenato' },
      { id: 'tropical', label: 'Tropical / Sonidero' },
      { id: 'banda', label: 'Banda' },
      { id: 'norteno', label: 'Norteño' },
      { id: 'corridos', label: 'Corridos tumbados' },
      { id: 'regional', label: 'Regional mexicano' },
      { id: 'mariachi-baile', label: 'Mariachi' },
      { id: 'reggaeton', label: 'Reggaetón' },
      { id: 'reggaeton-old', label: 'Reggaetón old school' },
      { id: 'reggaeton-romantico', label: 'Reggaetón romántico' },
      { id: 'perreo', label: 'Perreo' },
      { id: 'dembow', label: 'Dembow' },
      { id: 'trap', label: 'Trap' },
      { id: 'trap-latino', label: 'Trap latino' },
      { id: 'hiphop', label: 'Hip hop / Rap' },
      { id: 'urbano', label: 'Urbano latino' },
      { id: 'pop-es', label: 'Pop en español' },
      { id: 'pop-en', label: 'Pop en inglés' },
      { id: 'baladas-baile', label: 'Baladas pop' },
      { id: 'rock-es', label: 'Rock en español' },
      { id: 'rock-en', label: 'Rock en inglés' },
      { id: 'electronica', label: 'Electrónica / House' },
      { id: 'techno', label: 'Techno' },
      { id: 'disco', label: 'Disco y funk' },
      { id: 'reggae', label: 'Reggae' },
      { id: 'ska', label: 'Ska' },
      { id: 'ochentas', label: 'Éxitos de los 80s' },
      { id: 'noventas', label: 'Éxitos de los 90s' },
      { id: 'dosmiles', label: 'Éxitos de los 2000s' },
      { id: 'kpop', label: 'K-pop' }
];

// tipo: 'unica' (una opción) | 'multiple' (hasta "max") | 'cancion' (artista y tema, opcional)
// seccion y explica se muestran arriba de cada pregunta para que se entienda de qué trata.
export const ENCUESTAS = [
  {
    id: 'entrada',
    seccion: 'Menú',
    titulo: 'Entrada',
    explica: 'Es el primer tiempo de la comida: se sirve antes del plato fuerte y puede ser una crema o un espagueti.',
    descripcion: 'Elige la que más te guste.',
    icono: 'soup',
    tipo: 'unica',
    opciones: [
      { id: 'crema-brocoli', label: 'Crema de brócoli', desc: 'Crema' },
      { id: 'crema-cilantro', label: 'Crema de cilantro', desc: 'Crema' },
      { id: 'crema-zanahoria', label: 'Crema de zanahoria', desc: 'Crema' },
      { id: 'espagueti-perejil', label: 'Espagueti al perejil', desc: 'Pasta' },
      { id: 'espagueti-pomodoro', label: 'Espagueti pomodoro', desc: 'Pasta con salsa de jitomate' },
      { id: 'espagueti-crema', label: 'Espagueti a la crema', desc: 'Pasta' }
    ]
  },
  {
    id: 'fuerte',
    seccion: 'Menú',
    titulo: 'Plato fuerte',
    explica: 'Es el segundo tiempo y el platillo principal de la comida: la carne o el pollo.',
    descripcion: 'Elige tu favorito.',
    icono: 'utensils',
    tipo: 'unica',
    opciones: [
      { id: 'lomo-3-chiles', label: 'Lomo a los 3 chiles', desc: 'Lomo de cerdo' },
      { id: 'lomo-jugo', label: 'Lomo en su jugo', desc: 'Lomo de cerdo' },
      { id: 'pechuga-3-chiles', label: 'Pechuga cordón blue a los 3 chiles', desc: 'Pollo relleno' },
      { id: 'pechuga-tamarindo', label: 'Pechuga cordón blue en salsa de tamarindo', desc: 'Pollo relleno' },
      { id: 'pierna-crema', label: 'Pierna o muslo a la crema con elote y rajas', desc: 'Pollo' }
    ]
  },
  {
    id: 'guarnicion',
    seccion: 'Menú',
    titulo: 'Guarnición',
    explica: 'Es lo que acompaña al plato fuerte en el mismo plato.',
    descripcion: 'Elige con qué lo acompañamos.',
    icono: 'leaf',
    tipo: 'unica',
    opciones: [
      { id: 'verduras', label: 'Verduras a la mantequilla', desc: 'Brócoli y zanahoria' },
      { id: 'pure', label: 'Puré de papa' }
    ]
  },
  {
    id: 'musica-comida',
    seccion: 'Música',
    titulo: 'Música para la comida',
    explica: 'Es la música de fondo mientras comemos, de 4:00 a 5:00 pm. No es para bailar.',
    descripcion: 'Elige el ambiente que prefieres.',
    icono: 'headphones',
    tipo: 'unica',
    desplegable: true,
    otro: true,
    opciones: [
      ...SUAVES,
      ...GENEROS,
      { id: 'otro', label: 'Otro…', otro: true }
    ]
  },
  {
    id: 'musica-baile',
    seccion: 'Música',
    titulo: 'Música para bailar',
    explica: 'Son los géneros que el DJ pondrá en la pista de baile durante la fiesta.',
    descripcion: 'Elige hasta 3 estilos. Si no está el tuyo, usa "Otro".',
    icono: 'music',
    tipo: 'multiple',
    desplegable: true,
    otro: true,
    max: 3,
    opciones: [
      ...GENEROS,
      { id: 'otro', label: 'Otro…', otro: true }
    ]
  },
  {
    id: 'cancion',
    seccion: 'Música',
    titulo: 'Pide tu canción',
    explica: 'Escribe el artista y el nombre de una canción que quieras escuchar en la fiesta. Es opcional.',
    descripcion: 'Primero el artista y después la canción.',
    icono: 'disc',
    tipo: 'cancion',
    maxLength: 60
  }
];

export const ENCUESTAS_POR_ID = new Map(ENCUESTAS.map((e) => [e.id, e]));
