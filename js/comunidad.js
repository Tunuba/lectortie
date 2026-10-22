/* LA COMUNIDAD Y TU LECTURA.

   Todo lo que hace que leer se sienta como estar en una red: la racha, las
   paginas de la semana, el ranking con los amigos, los comentarios y la ruta
   que va de lo facil a los grandes clasicos.

   Es un prototipo sin base de datos. Lo tuyo se guarda en este navegador y
   los demas lectores se arman aqui mismo, con numeros que salen de la fecha
   para que no cambien con cada recarga. */

window.Comunidad = (function () {

  const LLAVE = 'lectortie.lectura';

  const PERSONAS = [
    { a: 'vale.lee', c: '#FF8AB8', ciudad: 'Zona 10', libro: 'alas-de-sangre', base: 128 },
    { a: 'diego_gt', c: '#7FD8FF', ciudad: 'Mixco', libro: 'conde-montecristo', base: 112 },
    { a: 'majo.reads', c: '#B9A6FF', ciudad: 'Zona 1', libro: 'el-principito', base: 96 },
    { a: 'kevin.ttz', c: '#FFC66B', ciudad: 'Villa Nueva', libro: 'diario-greg', base: 74 },
    { a: 'sofi_xela', c: '#7CE3B0', ciudad: 'Quetzaltenango', libro: 'matar-ruisenor', base: 88 },
    { a: 'andre.lectora', c: '#FF9A6B', ciudad: 'Antigua', libro: 'cien-anios', base: 140 },
    { a: 'pablo.z18', c: '#9AD0FF', ciudad: 'Zona 18', libro: 'dracula', base: 58 },
    { a: 'ximena.gt', c: '#F59BFF', ciudad: 'Zona 15', libro: 'bajo-misma-estrella', base: 81 },
    { a: 'josue_404', c: '#A6F0FF', ciudad: 'San Miguel Petapa', libro: 'ready-player-one', base: 47 },
    { a: 'luisa.lee', c: '#FFD0A6', ciudad: 'Zona 7', libro: 'coraline', base: 66 },
    { a: 'rodri.gamer', c: '#C2FF8A', ciudad: 'Mixco', libro: 'juegos-del-hambre', base: 52 },
    { a: 'cami.paginas', c: '#FFB3C7', ciudad: 'Zona 11', libro: 'el-viejo-y-el-mar', base: 104 },
    { a: 'fer.mixco', c: '#B3C7FF', ciudad: 'Mixco', libro: 'frankenstein', base: 39 },
    { a: 'nati.lee', c: '#FFE38A', ciudad: 'Zona 16', libro: 'wonder', base: 70 }
  ];
  const AMIGOS = 5;

  const CLUBES = [
    { id: 'terror', nombre: 'Terror de los viernes', lee: 'dracula', miembros: 214, color: '#E01F26' },
    { id: 'clasicos', nombre: 'Clásicos sin miedo', lee: 'el-viejo-y-el-mar', miembros: 389, color: '#C6A45C' },
    { id: 'romantasy', nombre: 'Romantasy GT', lee: 'alas-de-sangre', miembros: 532, color: '#FF4D8D' },
    { id: 'biblio', nombre: 'Lectores de la biblioteca', lee: 'el-principito', miembros: 147, color: '#2AE58C' }
  ];

  const COMENTA = {
    'el-patito-feo': ['lo leí de niño y ahora lo entendí de otra forma', 'cortito y te pega directo'],
    'el-principito': ['ya entendí lo de que lo esencial es invisible a los ojos', 'lo terminé en una tarde y lo volví a empezar'],
    'el-viejo-y-el-mar': ['nunca pensé que un libro de pesca me tuviera así', 'el viejo es un crack, no se rinde'],
    'conde-montecristo': ['es larguísimo pero cada capítulo es un edit de venganza', 'voy en la parte de la isla y no lo suelto'],
    'matar-ruisenor': ['no es de cazar pájaros jaja, es de mucho más', 'Atticus es el papá que todos quisiéramos'],
    'dracula': ['leerlo en octubre de noche fue mala idea', 'son puras cartas y diarios y eso lo hace más real'],
    'frankenstein': ['el monstruo no es el que uno cree', 'lo escribió a los 18, eso me voló la cabeza'],
    'coraline': ['lo de los botones me dio escalofríos', 'mejor que la película, y eso que la película es buena'],
    'diario-greg': ['me reí en el bus como loco', 'Rowley es el mejor amigo de la historia'],
    'alas-de-sangre': ['el capítulo 12 me dejó sin aire', 'necesito un dragón ya'],
    'bajo-misma-estrella': ['lloré en el capítulo 20, no digo más', 'okay? okay.']
  };
  const GENERICOS = [
    'lo empecé por un video y ya voy a la mitad', '¿alguien más lo está leyendo esta semana?',
    'no hagan spoilers porfa, ya casi llego', 'la app me lo recomendó por lo que veo en TikTok y le atinó',
    'más corto de lo que pensaba, lo terminé en dos tardes', 'el personaje principal me cae mal y aun así no lo suelto',
    'directo a mis favoritos', 'lo estoy leyendo con mi hermana y lo comentamos en la cena',
    'la página 40 cambia todo, de verdad', 'pensé que me iba a aburrir y fue al revés'
  ];
  const RESPUESTAS = ['jaja igual yo', '¿en qué parte vas?', 'este libro es otra cosa', 'ya lo agregué a mi estante',
    'cuando lo termines me dices', 'te sigo para ver qué lees después'];

  /* ── lo tuyo ───────────────────────────────────────────────────────── */

  const MI_COLOR = '#2AE58C';

  function vacio() {
    return { alias: '', nivelInicio: 1, elegidas: [], ruta: [], leyendo: {}, terminados: [], registro: [], clubes: [], comentarios: {}, logros: {} };
  }
  let yo = leer();
  function leer() {
    try { return Object.assign(vacio(), JSON.parse(localStorage.getItem(LLAVE) || '{}')); }
    catch (e) { return vacio(); }
  }
  function guardar() { try { localStorage.setItem(LLAVE, JSON.stringify(yo)); } catch (e) { /* modo privado */ } }
  function borrar() { yo = vacio(); guardar(); }

  const S = Motor.semilla;
  function dia(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lunes() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  /* Que tanto de la semana va pasando, de 0 el lunes temprano a 1 el domingo de noche. */
  function avanceSemana() { return Math.min(1, (Date.now() - lunes().getTime()) / (7 * 864e5)); }

  function paginasSemana() {
    const desde = dia(lunes());
    return yo.registro.filter(r => r.dia >= desde).reduce((s, r) => s + r.paginas, 0);
  }
  function racha() {
    const dias = new Set(yo.registro.map(r => r.dia));
    const d = new Date();
    if (!dias.has(dia(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (dias.has(dia(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function leyoHoy() { const h = dia(new Date()); return yo.registro.some(r => r.dia === h); }
  function semanaDias() {
    const l = lunes(), dias = new Set(yo.registro.map(r => r.dia)), hoyS = dia(new Date());
    return ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letra, i) => {
      const d = new Date(l); d.setDate(l.getDate() + i);
      const k = dia(d);
      return { letra, leyo: dias.has(k), hoy: k === hoyS, futuro: k > hoyS };
    });
  }

  function empezar(id) {
    if (!yo.leyendo[id]) yo.leyendo[id] = { pagina: 0, desde: Date.now() };
    guardar();
  }
  function leyendo() {
    return Object.entries(yo.leyendo).map(([id, x]) => ({ libro: Motor.libro(id), pagina: x.pagina, desde: x.desde }))
      .filter(x => x.libro).sort((a, b) => b.desde - a.desde);
  }
  function terminado(id) { return yo.terminados.some(t => t.id === id); }

  /* Anota una sesion. Devuelve lo que cambio, para que la pantalla lo festeje. */
  function anotarLectura(id, paginas, minutos) {
    const antes = { racha: racha(), puesto: puesto(), semana: paginasSemana() };
    const libro = Motor.libro(id);
    empezar(id);
    const x = yo.leyendo[id];
    x.pagina = Math.min(libro.paginas, x.pagina + paginas);
    yo.registro.push({ dia: dia(new Date()), paginas, minutos: Math.round(minutos || 0), id });
    let acabo = false;
    if (x.pagina >= libro.paginas && !terminado(id)) {
      yo.terminados.push({ id, cuando: Date.now() });
      delete yo.leyendo[id];
      acabo = true;
    }
    guardar();
    return { antes, despues: { racha: racha(), puesto: puesto(), semana: paginasSemana() }, acabo, pagina: x.pagina };
  }
  function terminar(id) {
    const libro = Motor.libro(id);
    const x = yo.leyendo[id] || { pagina: 0 };
    return anotarLectura(id, Math.max(1, libro.paginas - x.pagina), 0);
  }

  /* ── la ruta ───────────────────────────────────────────────────────────
     De lo facil a los grandes. Un escalon por nivel, dos en los primeros
     porque ahi es donde se engancha o se pierde, y arriba siempre espera El
     conde de Montecristo. Se elige con tu gusto, con un empujon a los libros
     que nombra el pitch para que la ruta de quien no sabe nada de libros sea
     la que se cuenta en voz alta. */
  const CUPO = { 1: 2, 2: 2, 3: 1, 4: 1 };
  const EMPUJE = { 'el-patito-feo': .5, 'el-principito': .55, 'el-viejo-y-el-mar': .5, 'matar-ruisenor': .35 };
  const CIMA = 'conde-montecristo';

  function armarRuta(pesos) {
    const libros = Motor.libros();
    const techo = Math.max(1, ...Object.values(pesos || {}));
    /* Los cuentos que se leen completos aqui mismo tienen un empujon: quien
       empieza la ruta puede terminar su primer libro hoy, sin salir de la app. */
    const nota = l => (l.temas || []).reduce((s, t) => s + (pesos[t] || 0), 0) / techo + (EMPUJE[l.id] || 0) + (l.libre ? .3 : 0);
    const ruta = [];
    for (let n = 1; n <= 4; n++) {
      const del = libros.filter(l => l.nivel === n && l.id !== CIMA).sort((a, b) => nota(b) - nota(a) || a.paginas - b.paginas);
      ruta.push(...del.slice(0, CUPO[n]).map(l => l.id));
    }
    ruta.push(CIMA);
    yo.ruta = ruta;
    guardar();
    return ruta;
  }
  function ruta() {
    if (!yo.ruta.length) armarRuta(Gusto.pesos());
    let actual = -1;
    const pasos = yo.ruta.map((id, i) => {
      const libro = Motor.libro(id);
      const hecho = terminado(id);
      return { libro, hecho, nivel: libro.nivel, pagina: (yo.leyendo[id] || {}).pagina || 0, i };
    });
    actual = pasos.findIndex(p => !p.hecho);
    pasos.forEach((p, i) => { p.actual = i === actual; p.cerrado = actual >= 0 && i > actual + 1; });
    return { pasos, actual, hechos: pasos.filter(p => p.hecho).length };
  }

  /* ── los demas ─────────────────────────────────────────────────────── */

  let vivos = {};   /* paginas que los demas van sumando mientras la app esta abierta */
  function paginasDe(p) {
    const semana = dia(lunes());
    const ritmo = .55 + S(semana + p.a) * .9;
    return Math.round(p.base * .4 * ritmo * (0.12 + avanceSemana() * 0.88) + S(p.a + 'o') * 9) + (vivos[p.a] || 0);
  }
  function tabla() {
    const filas = PERSONAS.map((p, i) => ({ alias: p.a, color: p.c, ciudad: p.ciudad, paginas: paginasDe(p), amigo: i < AMIGOS, libro: Motor.libro(p.libro), tu: false }));
    /* La gente de verdad que esta usando la app esta semana entra a la misma tabla. */
    if (window.Red) for (const x of Red.lectores()) {
      filas.push({ alias: x.alias, color: x.color || '#7FD8FF', ciudad: 'en lectortie', paginas: x.paginas || 0, amigo: false, libro: Motor.libro(x.libro), real: true });
    }
    filas.push({ alias: yo.alias || 'tú', color: '#2AE58C', ciudad: 'Ciudad de Guatemala', paginas: paginasSemana(), tu: true, amigo: true });
    return filas.sort((a, b) => b.paginas - a.paginas || (a.tu ? -1 : 1));
  }
  /* El puesto se cuenta entre tus amigos, que es donde se siente subir. */
  function puesto() { return tabla().filter(f => f.amigo).findIndex(f => f.tu) + 1; }

  function amigos() {
    return PERSONAS.slice(0, AMIGOS).map(p => {
      const libro = Motor.libro(p.libro);
      const pct = Math.min(.97, .18 + S(dia(lunes()) + p.a + 'x') * .55 + avanceSemana() * .2);
      return { alias: p.a, color: p.c, libro, pagina: Math.round(libro.paginas * pct), pct };
    });
  }

  /* Promedio de paginas por dia de esta semana, de los lectores de la app. */
  function promedios() {
    const dias = Math.max(1, Math.ceil(avanceSemana() * 7));
    const t = tabla();
    const media = f => Math.round((t.filter(f).reduce((s, x) => s + x.paginas, 0) / Math.max(1, t.filter(f).length)) / dias * 10) / 10;
    return [
      { nombre: 'tú', valor: Math.round(paginasSemana() / dias * 10) / 10, tu: true },
      { nombre: 'tus amigos', valor: media(x => x.amigo && !x.tu) },
      { nombre: 'tu ciudad', valor: media(x => !x.tu && !/Quetzaltenango|Antigua/.test(x.ciudad)) },
      { nombre: 'todo el país', valor: media(x => !x.tu), pais: true }
    ];
  }

  function lectoresDe(id) { return 40 + Math.round(S(id + 'lec') * 860); }
  function leyendoAhora() {
    const base = 120 + Math.round(S(Motor.hoy()) * 160);
    return base + (window.Red ? Red.activos() : 0) + Math.round(Math.sin(Date.now() / 90000) * 18 + S(String(Math.floor(Date.now() / 20000))) * 14);
  }
  function corazones(id) { return 180 + Math.round(S(id + 'cor') * 9400); }

  function comentarios(id) {
    const propios = COMENTA[id] || [];
    const n = 2 + Math.floor(S(id + 'n') * 2);
    const lista = [];
    const usados = new Set();
    for (let k = 0; k < n + propios.length && lista.length < n + 1; k++) {
      const texto = k < propios.length ? propios[k] : GENERICOS[Math.floor(S(id + k) * GENERICOS.length)];
      if (usados.has(texto)) continue;
      usados.add(texto);
      const p = PERSONAS[Math.floor(S(id + 'p' + k) * PERSONAS.length)];
      lista.push({ alias: p.a, color: p.c, texto, hace: 2 + Math.floor(S(id + 'h' + k) * 50) + ' min', likes: Math.floor(S(id + 'l' + k) * 40) });
    }
    const mios = (yo.comentarios[id] || []).map(c => ({ alias: yo.alias || 'tú', color: '#2AE58C', texto: c.texto, hace: 'ahora', likes: 0, tu: true, respuesta: c.respuesta }));
    return lista.concat(mios);
  }
  function comentar(id, texto) {
    const p = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    const c = { texto, cuando: Date.now(), respuesta: { alias: p.a, color: p.c, texto: RESPUESTAS[Math.floor(Math.random() * RESPUESTAS.length)] } };
    (yo.comentarios[id] = yo.comentarios[id] || []).push(c);
    guardar();
    return c;
  }
  function cuantosComentarios(id) { return 12 + Math.round(S(id + 'com') * 230) + (yo.comentarios[id] || []).length; }

  function clubes() { return CLUBES.map(c => Object.assign({}, c, { libro: Motor.libro(c.lee), dentro: yo.clubes.includes(c.id) })); }
  function alternarClub(id) {
    yo.clubes = yo.clubes.includes(id) ? yo.clubes.filter(x => x !== id) : yo.clubes.concat(id);
    guardar();
    return yo.clubes.includes(id);
  }

  /* Lo que pasa en la red mientras miras. Cada tanto alguien lee, termina o
     sube de nivel, y eso suma paginas de verdad en la tabla. */
  function suceso() {
    const p = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    const libro = Motor.libro(p.libro);
    const r = Math.random();
    if (r < .45) {
      const n = 3 + Math.floor(Math.random() * 14);
      vivos[p.a] = (vivos[p.a] || 0) + n;
      return { alias: p.a, color: p.c, texto: 'leyó ' + n + ' páginas de ' + libro.titulo, libro };
    }
    if (r < .65) return { alias: p.a, color: p.c, texto: 'empezó ' + libro.titulo, libro };
    if (r < .8) return { alias: p.a, color: p.c, texto: 'lleva ' + (3 + Math.floor(S(p.a) * 20)) + ' días de racha', libro };
    if (r < .92) return { alias: p.a, color: p.c, texto: 'comentó en ' + libro.titulo, libro };
    return { alias: p.a, color: p.c, texto: 'subió al nivel ' + (2 + Math.floor(Math.random() * 3)) + ' de su ruta', libro };
  }

  /* ── logros, puntos y nivel ────────────────────────────────────────────
     Medallas que se ganan leyendo, comentando y entrando a clubes. Cada una
     tiene su color. Los puntos suben con todo lo que haces y marcan el nivel. */
  const LOGROS = [
    { id: 'primera', nombre: 'Primera página', desc: 'Anota tu primera sesión', ico: 'libro', color: '#2AE58C', ok: (y, x) => y.registro.length >= 1 },
    { id: 'racha3', nombre: 'Tres al hilo', desc: 'Racha de 3 días', ico: 'llama', color: '#FF8A3C', ok: () => racha() >= 3 },
    { id: 'racha7', nombre: 'Semana en llamas', desc: 'Racha de 7 días', ico: 'llama', color: '#FF3D6E', ok: () => racha() >= 7 },
    { id: 'p50', nombre: '50 páginas', desc: 'Suma 50 páginas', ico: 'libro', color: '#59D6FF', ok: () => totalPaginas() >= 50 },
    { id: 'p200', nombre: '200 páginas', desc: 'Suma 200 páginas', ico: 'libro', color: '#8B6BFF', ok: () => totalPaginas() >= 200 },
    { id: 'fin', nombre: 'Lo terminé', desc: 'Termina tu primer libro', ico: 'check', color: '#FFC66B', ok: y => y.terminados.length >= 1 },
    { id: 'opina', nombre: 'Primera opinión', desc: 'Comenta un libro', ico: 'comentar', color: '#FF8AB8', ok: y => Object.keys(y.comentarios).length >= 1 },
    { id: 'club', nombre: 'En la banda', desc: 'Únete a un club', ico: 'gente', color: '#7CE3B0', ok: y => y.clubes.length >= 1 },
    { id: 'podio', nombre: 'Podio', desc: 'Entra al top 3 de tus amigos', ico: 'corona', color: '#FFD25A', ok: y => y.registro.length > 0 && puesto() <= 3 },
    { id: 'colec', nombre: 'Coleccionista', desc: 'Guarda 5 libros', ico: 'marca', color: '#B9A6FF', ok: (y, x) => (x && x.estante || 0) >= 5 }
  ];
  function totalPaginas() { return yo.registro.reduce((s, r) => s + r.paginas, 0); }
  function logros() { return LOGROS.map(l => Object.assign({}, l, { hecho: !!yo.logros[l.id] })); }
  /* Revisa y devuelve solo los que se acaban de ganar, para festejarlos. */
  function revisarLogros(extra) {
    const nuevos = [];
    for (const l of LOGROS) if (!yo.logros[l.id] && l.ok(yo, extra || {})) { yo.logros[l.id] = Date.now(); nuevos.push(l); }
    if (nuevos.length) guardar();
    return nuevos;
  }
  const NIVELES = [[0, 'Curioso'], [150, 'Hojeador'], [400, 'Lector'], [900, 'Devora páginas'], [1800, 'Bibliófilo'], [3500, 'Leyenda']];
  function puntos() {
    const coms = Object.values(yo.comentarios).reduce((s, l) => s + l.length, 0);
    return totalPaginas() * 10 + coms * 15 + yo.terminados.length * 100 + Object.keys(yo.logros).length * 50 + yo.clubes.length * 20;
  }
  function nivel() {
    const p = puntos();
    let i = 0;
    while (i < NIVELES.length - 1 && p >= NIVELES[i + 1][0]) i++;
    const desde = NIVELES[i][0], hasta = i < NIVELES.length - 1 ? NIVELES[i + 1][0] : desde + 2000;
    return { n: i + 1, nombre: NIVELES[i][1], puntos: p, avance: Math.min(1, (p - desde) / (hasta - desde)), faltan: Math.max(0, hasta - p), siguiente: (NIVELES[i + 1] || [0, 'Leyenda'])[1] };
  }

  /* Avisos para la campana, hechos con lo que de verdad tienes: tu ruta, tus
     comentarios, tu puesto y tu racha. Si no hay con que, sale algo de la red. */
  function aviso() {
    const r = ruta();
    const paso = r.pasos[Math.max(0, r.actual)];
    const p = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    const opciones = [];
    if (paso) opciones.push({ alias: p.a, color: p.c, texto: 'empezó ' + paso.libro.titulo + ', ¿lo leen juntos?', libro: paso.libro });
    const mios = Object.keys(yo.comentarios);
    if (mios.length) { const l = Motor.libro(mios[Math.floor(Math.random() * mios.length)]); opciones.push({ alias: p.a, color: p.c, texto: 'le dio corazón a tu comentario en ' + l.titulo, libro: l }); }
    const t = tabla(), i = t.findIndex(f => f.tu);
    if (i > 0) { const a = t[i - 1]; opciones.push({ alias: a.alias, color: a.color, texto: 'te lleva ' + Math.max(1, a.paginas - t[i].paginas) + ' páginas en el ranking, alcánzalo', ir: 'comunidad' }); }
    if (!leyoHoy()) opciones.push({ alias: 'lectortie', color: '#5B3DF5', texto: 'tu racha te está esperando, 5 minutos y la prendes', libro: paso && paso.libro });
    const tr = Motor.tendencias()[Math.floor(Math.random() * 4)];
    if (tr) { const pb = Motor.porTendencia(tr, { limite: 1 })[0]; if (pb) opciones.push({ alias: 'lectortie', color: '#5B3DF5', texto: tr.titulo + ' está subiendo en ' + Motor.RED[tr.fuente] + ', y tiene libro, ' + pb.libro.titulo, libro: pb.libro }); }
    const c = CLUBES[Math.floor(Math.random() * CLUBES.length)];
    opciones.push({ alias: p.a, color: p.c, texto: 'invitó a ' + c.nombre + ' a leer ' + Motor.libro(c.lee).titulo, libro: Motor.libro(c.lee) });
    const k = Math.floor(Math.random() * (opciones.length + 1));
    return k < opciones.length ? opciones[k] : suceso();
  }

  /* Un precio de referencia para el boton de conseguirlo. Sale de las paginas
     y se redondea a cinco, como en cualquier libreria. */
  function precio(libro) { return Math.round((55 + libro.paginas * .11) / 5) * 5; }

  return {
    get yo() { return yo; }, guardar, borrar, MI_COLOR,
    paginasSemana, racha, leyoHoy, semanaDias, empezar, leyendo, terminado, anotarLectura, terminar,
    armarRuta, ruta, tabla, puesto, amigos, promedios, lectoresDe, leyendoAhora, corazones,
    comentarios, comentar, cuantosComentarios, clubes, alternarClub, suceso, precio, PERSONAS,
    logros, revisarLogros, puntos, nivel, aviso, totalPaginas
  };
})();
