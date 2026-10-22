/* LECTORTIE, la parte que se ve.

   Seis vistas sobre la misma pagina: inicio, deslizar, ruta, comunidad,
   estante y buscar. No hay ruteo ni recarga, se enciende una y se apagan las
   otras, como en cualquier red social.

   El motor, el gusto y la comunidad viven en el navegador (motor.js y
   comunidad.js). No hay servidor ni base de datos, asi que la app se abre
   igual desde una computadora, un Android o un iPhone. */

(function () {

  const $ = s => document.querySelector(s);
  const RED = Motor.RED;
  const TOCA = matchMedia('(hover: none)').matches;

  const estado = {
    tendencias: [],
    filtro: null,
    vista: 'feed',
    estante: cargarLista('lectortie.estante'),
    gusta: cargarLista('lectortie.gusta'),
    armada: localStorage.getItem('lectortie.para') === 'yo',
    vistos: new Set(),
    pendiente: false
  };

  function cargarLista(llave) {
    try { return new Set(JSON.parse(localStorage.getItem(llave) || '[]')); }
    catch (e) { return new Set(); }
  }
  function guardarLista(llave, conjunto) {
    try { localStorage.setItem(llave, JSON.stringify([...conjunto])); } catch (e) { /* modo privado */ }
  }

  /* ── piezas chicas ───────────────────────────────────────────────────── */

  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function icono(nombre, clase) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', clase || 'ico');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + nombre);
    svg.appendChild(use);
    return svg;
  }
  function cifra(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' M';
    if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '') + ' mil';
    return Number(n).toLocaleString('es-GT');
  }
  function avatar(alias, color, clase) {
    const a = el('span', clase || 'ava', (alias || '?').replace(/[^a-z0-9]/gi, '').charAt(0).toUpperCase() || 'T');
    a.style.background = color;
    return a;
  }
  function boton(texto, clase, alTocar) {
    const b = el('button', clase, texto);
    b.type = 'button';
    if (alTocar) b.addEventListener('click', alTocar);
    return b;
  }

  let avisoTimer = null;
  function avisar(texto) {
    const a = $('#aviso');
    a.textContent = texto;
    a.hidden = false;
    a.style.animation = 'none'; void a.offsetWidth; a.style.animation = '';
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { a.hidden = true; }, 2200);
  }
  function vibrar(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* no hay */ } }

  /* Sonidos cortos hechos aqui mismo, sin archivos. Suenan solo despues de un
     toque, que es lo que piden los navegadores del telefono. */
  let AC = null;
  function nota(f, t0, dur, vol, tipo) {
    if (!AC) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = tipo || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, AC.currentTime + t0);
    g.gain.linearRampToValueAtTime(vol, AC.currentTime + t0 + .01);
    g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + t0 + dur);
    o.connect(g).connect(AC.destination);
    o.start(AC.currentTime + t0); o.stop(AC.currentTime + t0 + dur + .05);
  }
  function sonar(que) {
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state !== 'running') AC.resume();
    } catch (e) { return; }
    if (que === 'pop') { nota(660, 0, .12, .08); nota(990, .05, .14, .05); }
    if (que === 'tic') nota(1200, 0, .05, .03, 'triangle');
    if (que === 'logro') [523, 659, 784, 1046].forEach((f, i) => nota(f, i * .09, .5, .07, 'triangle'));
    if (que === 'llama') { nota(392, 0, .3, .06, 'triangle'); nota(587, .12, .45, .06, 'triangle'); nota(784, .24, .6, .06, 'triangle'); }
  }

  /* ── fiesta: libros y corazones que saltan ───────────────────────────── */

  const lienzo = $('#fiesta'), pincel = lienzo.getContext('2d');
  let chispas = [], corriendo = false;
  const TONOS = ['#8B6BFF', '#2AE58C', '#FF3D6E', '#FFC66B', '#59D6FF', '#F4F2FA'];
  function fiesta(x, y, cuantas, tipo) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    lienzo.width = innerWidth * dpr; lienzo.height = innerHeight * dpr;
    pincel.setTransform(dpr, 0, 0, dpr, 0, 0);
    x = x === undefined ? innerWidth / 2 : x; y = y === undefined ? innerHeight * .45 : y;
    for (let i = 0; i < (cuantas || 70); i++) {
      const an = Math.random() * Math.PI * 2, v = 250 + Math.random() * 650;
      chispas.push({
        x, y, vx: Math.cos(an) * v * (tipo === 'lluvia' ? .3 : 1), vy: Math.sin(an) * v - 420,
        r: Math.random() * 6, vr: (Math.random() - .5) * 12, w: 9 + Math.random() * 9,
        c: TONOS[Math.floor(Math.random() * TONOS.length)], vida: 1.8 + Math.random() * 1.2,
        f: tipo === 'corazon' || Math.random() < .2 ? 'c' : 'l'
      });
    }
    if (!corriendo) { corriendo = true; requestAnimationFrame(cuadro); }
  }
  let antes = 0;
  function cuadro(ms) {
    const dt = antes ? Math.min(.04, (ms - antes) / 1000) : .016; antes = ms;
    pincel.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of chispas) {
      p.vida -= dt; p.vy += 1100 * dt; p.vx *= .99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      pincel.save(); pincel.globalAlpha = Math.max(0, Math.min(1, p.vida)); pincel.translate(p.x, p.y); pincel.rotate(p.r);
      pincel.fillStyle = p.c;
      if (p.f === 'c') {
        const s = p.w / 14;
        pincel.scale(s, s); pincel.beginPath();
        pincel.moveTo(0, 5); pincel.bezierCurveTo(-9, -1, -6, -9, 0, -4); pincel.bezierCurveTo(6, -9, 9, -1, 0, 5); pincel.fill();
      } else {
        pincel.fillRect(-p.w / 2, -p.w * .7, p.w, p.w * 1.4);
        pincel.fillStyle = 'rgba(255,255,255,.55)'; pincel.fillRect(-p.w / 2 + 2, -p.w * .7, 2, p.w * 1.4);
      }
      pincel.restore();
    }
    chispas = chispas.filter(p => p.vida > 0 && p.y < innerHeight + 80);
    if (chispas.length) requestAnimationFrame(cuadro);
    else { corriendo = false; antes = 0; pincel.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ── aviso de la red, arriba, como una notificacion ──────────────────── */

  let notiTimer = null;
  function noti(s, alTocar) {
    if (!$('#lector').hidden || !$('#entrada').hidden) return;
    const n = $('#noti');
    n.textContent = '';
    if (s.alias === 'lectortie') n.appendChild(icono('logo', 'ava noti-logo'));
    else n.appendChild(avatar(s.alias, s.color));
    n.appendChild(el('span', 'noti-txt'));
    const t = n.querySelector('.noti-txt');
    t.append(el('b', '', s.alias), ' ' + s.texto);
    if (s.libro) { const m = el('span', 'noti-tapa'); m.style.backgroundImage = 'url(img/portadas/' + s.libro.id + '.jpg)'; n.appendChild(m); }
    n.onclick = () => { n.hidden = true; if (alTocar) alTocar(); else if (s.libro) abrirFicha(s.libro.id); };
    n.hidden = false;
    n.classList.remove('sale'); void n.offsetWidth;
    clearTimeout(notiTimer);
    notiTimer = setTimeout(() => { n.classList.add('sale'); setTimeout(() => { n.hidden = true; }, 380); }, 4600);
  }

  /* ── historias y lateral ─────────────────────────────────────────────── */

  function pintarHistorias() {
    const caja = $('#historias');
    caja.textContent = '';
    caja.appendChild(historia({ id: 'todas', titulo: 'Para ti', fuente: 'tuyo' }, !estado.filtro));
    estado.tendencias.forEach((t, i) => caja.appendChild(historia(t, estado.filtro === t.id, i < 2)));
  }
  function historia(t, puesta, sube) {
    const b = el('button', 'historia' + (puesta ? ' puesta' : ''));
    b.type = 'button';
    b.dataset.red = t.fuente;
    const aro = el('div', 'aro'), disco = el('div', 'disco'), glifo = el('div', 'glifo');
    glifo.appendChild(icono(t.id === 'todas' ? 'tuyo' : t.fuente));
    disco.appendChild(glifo); aro.appendChild(disco);
    if (sube) aro.appendChild(el('i', 'en-llamas', 'sube'));
    b.append(aro, el('b', '', t.titulo));
    b.addEventListener('click', () => filtrar(t.id === 'todas' ? null : t.id));
    return b;
  }

  function pintarRanking() {
    const ul = $('#ranking');
    ul.textContent = '';
    const tope = Math.max(...estado.tendencias.map(t => t.momento), 1);
    for (const t of estado.tendencias.slice(0, 6)) {
      const li = el('li'); li.dataset.red = t.fuente;
      const b = el('button'); b.type = 'button';
      const fila = el('div', 'fila');
      fila.append(el('b', '', t.titulo), el('em', '', RED[t.fuente]));
      const barra = el('div', 'barrita'), relleno = el('i');
      relleno.style.width = Math.round((t.momento / tope) * 100) + '%';
      barra.appendChild(relleno);
      b.append(fila, barra);
      b.addEventListener('click', () => { filtrar(t.id); scrollTo({ top: 0, behavior: 'smooth' }); });
      li.appendChild(b); ul.appendChild(li);
    }
  }

  function pintarYo() {
    const yo = Comunidad.yo;
    const r = Comunidad.racha();
    $('#racha-num').textContent = r;
    $('#racha-pill').classList.toggle('prendida', Comunidad.leyoHoy());
    $('#letra-yo').textContent = (yo.alias || 'L').charAt(0).toUpperCase();
    $('#nombre-yo').textContent = yo.alias || 'Tu lectura';
    const sem = Comunidad.paginasSemana();
    $('#resumen-yo').textContent = (r ? r + (r === 1 ? ' día' : ' días') + ' de racha, ' : '') + sem + ' páginas esta semana';
    const g = $('#contador');
    g.textContent = estado.estante.size;
    g.hidden = estado.estante.size === 0;
  }

  /* ── inicio ──────────────────────────────────────────────────────────── */

  function filtrar(id) {
    estado.filtro = id;
    pintarHistorias();
    const caja = $('#filtro');
    if (!id) caja.hidden = true;
    else {
      const t = estado.tendencias.find(x => x.id === id);
      caja.hidden = false;
      const txt = $('#filtro-txt'); txt.textContent = '';
      txt.append('Viendo ', el('b', '', t.titulo), ' en ' + RED[t.fuente] + ', ' + cifra(t.vistas) + ' vistas');
      senal('ver', null, null, id);
    }
    ir('feed');
    cargarFeed();
  }

  function publicaciones(limite) {
    if (estado.filtro) {
      const t = estado.tendencias.find(x => x.id === estado.filtro);
      return Motor.porTendencia(t, { limite, minimo: 25 });
    }
    const pesos = Gusto.pesos();
    if (Object.keys(pesos).length) return Motor.paraTi(pesos, { limite, excluir: Gusto.perfil().guardados });
    return Motor.feed({ limite });
  }

  function cargarFeed() {
    const caja = $('#vista-feed');
    caja.textContent = '';
    pintarHoy();
    const pubs = publicaciones(24);
    if (!pubs.length) { caja.appendChild(el('p', 'cargando', 'Todavía no hay libros para esa tendencia')); return; }
    pubs.forEach((p, i) => {
      caja.appendChild(tarjeta(p));
      if (!estado.filtro && i === 3) caja.appendChild(tarjetaPausa());
      if (!estado.filtro && i === 7) caja.appendChild(tarjetaPromo(pubs.length > 12 ? pubs[12].libro : pubs[0].libro));
      if (!estado.filtro && i === 12) caja.appendChild(tarjetaAmigos());
    });
    pintarTuyo();
  }

  /* Que cada tarjeta entre con un empujoncito cuando aparece. */
  const entra = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add('dentro'); entra.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function animar(n) { n.classList.add('animada'); if (entra) entra.observe(n); else n.classList.add('dentro'); }

  function tarjeta(pub) {
    const libro = pub.libro;
    const art = el('article', 'pub');
    art.dataset.libro = libro.id;
    art.dataset.tendencia = pub.tendencia.id;
    art.dataset.red = pub.tendencia.fuente;
    if (pub.tuyo) art.dataset.tuyo = pub.tuyo;
    mirar(art); animar(art);

    const cab = el('div', 'pub-cab');
    const av = el('div', 'avatar'); av.dataset.red = pub.tendencia.fuente;
    const dentro = el('div'); dentro.appendChild(icono(pub.tendencia.fuente === 'tuyo' ? 'tuyo' : pub.tendencia.fuente)); av.appendChild(dentro);
    const quien = el('div', 'pub-quien');
    quien.append(el('b', '', pub.tendencia.titulo),
      el('span', '', (RED[pub.tendencia.fuente] || 'Para ti') + '  ' + pub.tendencia.etiqueta + (pub.tendencia.vistas ? '  ' + cifra(pub.tendencia.vistas) + ' vistas' : '')));
    const nivel = el('span', 'pub-nivel', 'Nivel ' + libro.nivel);
    cab.append(av, quien, nivel);

    const medio = el('div', 'pub-medio');
    Portada.pintar(medio, libro, 'L');
    medio.appendChild(el('span', 'chip', 'afinidad ' + pub.afinidad));
    const golpe = el('div', 'golpe'); golpe.appendChild(icono('corazon')); medio.appendChild(golpe);

    const acc = el('div', 'pub-acc');
    const corazon = botonAcc('corazon', 'Me gusta');
    corazon.classList.add('acc-corazon');
    if (estado.gusta.has(libro.id)) corazon.classList.add('querido');
    corazon.addEventListener('click', () => marcarGusta(libro.id, corazon, !estado.gusta.has(libro.id)));
    const comentar = botonAcc('comentar', 'Comentarios');
    comentar.addEventListener('click', () => abrirFicha(libro.id, pub.tendencia.id, true));
    const compartir = botonAcc('compartir', 'Compartir');
    compartir.addEventListener('click', () => repartir(libro));
    const leer = boton('Leer', 'pub-leer', () => abrirLector(libro.id));
    leer.prepend(icono('libro'));
    const marcador = botonAcc('marca', 'Guardar');
    marcador.classList.add('acc-marca', 'derecha');
    if (estado.estante.has(libro.id)) marcador.classList.add('marcado');
    marcador.addEventListener('click', () => alternarEstante(libro.id, marcador));
    acc.append(corazon, comentar, compartir, leer, marcador);

    let toque = null;
    medio.addEventListener('click', () => { clearTimeout(toque); toque = setTimeout(() => abrirFicha(libro.id, pub.tendencia.id), 240); });
    medio.addEventListener('dblclick', ev => {
      ev.preventDefault(); clearTimeout(toque);
      if (!estado.gusta.has(libro.id)) marcarGusta(libro.id, corazon, true);
      golpe.classList.remove('late'); void golpe.offsetWidth; golpe.classList.add('late');
    });

    const txt = el('div', 'pub-txt');
    const cuenta = el('p', 'pub-cuenta');
    cuenta.append(el('b', '', cifra(Comunidad.corazones(libro.id) + (estado.gusta.has(libro.id) ? 1 : 0)) + ' me gusta'),
      '  ' + Comunidad.lectoresDe(libro.id) + ' lo están leyendo');
    const h = el('h3', '', libro.titulo);
    const autor = el('div', 'autor', libro.autor + ', ' + libro.paginas + ' páginas');
    const gancho = el('p', '', libro.gancho);
    const porque = el('p', 'porque', pub.porque);
    const tags = el('div', 'etiquetas');
    for (const t of libro.temas.slice(0, 4)) tags.appendChild(el('span', 'etiqueta', '#' + Motor.tema(t).replace(/ /g, '')));
    const c = Comunidad.comentarios(libro.id)[0];
    const com = el('button', 'pub-com');
    com.type = 'button';
    com.append(el('b', '', c.alias), ' ' + c.texto, el('span', '', 'Ver los ' + Comunidad.cuantosComentarios(libro.id) + ' comentarios'));
    com.addEventListener('click', () => abrirFicha(libro.id, pub.tendencia.id, true));
    txt.append(cuenta, h, autor, gancho, porque, tags, com);
    art.append(cab, medio, acc, txt);
    return art;
  }

  function botonAcc(nombre, etiqueta) {
    const b = el('button', 'acc'); b.type = 'button';
    b.setAttribute('aria-label', etiqueta);
    b.appendChild(icono(nombre));
    return b;
  }

  /* La tarjeta que corta el scroll y lo vuelve lectura. Es la idea del pitch
     puesta en el feed, entre una publicacion y otra. */
  function tarjetaPausa() {
    const r = Comunidad.ruta();
    const paso = r.pasos[Math.max(0, r.actual)];
    const art = el('article', 'pub pausa');
    animar(art);
    art.append(el('p', 'pausa-ceja', 'Llevas un rato deslizando'),
      el('h3', '', '¿Y si lo conviertes en 5 minutos de lectura?'));
    const fila = el('div', 'pausa-fila');
    const tapa = el('div', 'pausa-tapa'); Portada.pintar(tapa, paso.libro, 'M');
    const t = el('div');
    t.append(el('b', '', paso.libro.titulo), el('span', '', 'Siguiente en tu ruta, nivel ' + paso.libro.nivel));
    fila.append(tapa, t);
    const b = boton('Leer 5 minutos', 'grande', () => abrirLector(paso.libro.id));
    art.append(fila, b);
    return art;
  }
  function tarjetaPromo(libro) {
    const art = el('article', 'pub promo');
    art.dataset.libro = libro.id;
    animar(art);
    const cab = el('div', 'pub-cab');
    const av = el('div', 'avatar promo-av'); const d = el('div'); d.appendChild(icono('libro')); av.appendChild(d);
    const q = el('div', 'pub-quien'); q.append(el('b', '', 'Editorial aliada'), el('span', '', 'Promocionado'));
    cab.append(av, q);
    const cuerpo = el('div', 'promo-cuerpo');
    const tapa = el('div', 'promo-tapa'); Portada.pintar(tapa, libro, 'M');
    const t = el('div', 'promo-txt');
    t.append(el('p', 'promo-ceja', 'Nuevo en librerías'), el('h3', '', libro.titulo), el('p', '', libro.gancho));
    cuerpo.append(tapa, t);
    const b = boton('Conseguirlo desde Q' + Comunidad.precio(libro), 'grande', () => abrirFicha(libro.id, null, false, true));
    b.prepend(icono('bolsa'));
    art.append(cab, cuerpo, b);
    return art;
  }
  function tarjetaAmigos() {
    const art = el('article', 'pub amigos-pub');
    animar(art);
    art.append(el('p', 'pausa-ceja', 'Tus amigos esta semana'));
    const lista = el('div', 'amigos-tira');
    for (const a of Comunidad.amigos()) {
      const f = el('button', 'amigo-mini'); f.type = 'button';
      const tapa = el('div', 'amigo-tapa'); Portada.pintar(tapa, a.libro, 'M');
      tapa.appendChild(avatar(a.alias, a.color, 'ava ava-sobre'));
      const barra = el('i', 'mini-barra'); const rel = el('i'); rel.style.width = Math.round(a.pct * 100) + '%'; barra.appendChild(rel);
      f.append(tapa, el('b', '', a.alias), barra);
      f.addEventListener('click', () => abrirFicha(a.libro.id));
      lista.appendChild(f);
    }
    art.appendChild(lista);
    art.appendChild(boton('Ver la comunidad', 'flojo ancho', () => ir('comunidad')));
    return art;
  }

  /* Tu dia, arriba del feed. Lo que vas leyendo, la racha de la semana y un
     boton que lleva directo a leer. */
  function pintarHoy() {
    const caja = $('#hoy');
    if (estado.filtro || !Comunidad.yo.ruta.length) { caja.hidden = true; return; }
    caja.hidden = false;
    caja.textContent = '';
    const lee = Comunidad.leyendo()[0];
    const r = Comunidad.ruta();
    const libro = lee ? lee.libro : r.pasos[Math.max(0, r.actual)].libro;
    const pagina = lee ? lee.pagina : 0;

    const tapa = el('div', 'hoy-tapa'); Portada.pintar(tapa, libro, 'M');
    const txt = el('div', 'hoy-txt');
    txt.append(el('p', 'hoy-ceja', lee ? 'Sigues leyendo' : 'Tu siguiente libro'), el('h3', '', libro.titulo));
    if (lee) {
      const barra = el('div', 'hoy-barra'); const i = el('i'); i.style.width = Math.max(3, pagina / libro.paginas * 100) + '%'; barra.appendChild(i);
      txt.append(barra, el('span', 'hoy-pag', 'Página ' + pagina + ' de ' + libro.paginas));
    } else txt.append(el('span', 'hoy-pag', 'Nivel ' + libro.nivel + ' de tu ruta, ' + libro.paginas + ' páginas'));
    const b = boton(lee ? 'Seguir' : 'Empezar', 'hoy-leer', () => abrirLector(libro.id));
    b.prepend(icono('play'));
    txt.appendChild(b);

    const semana = el('div', 'hoy-semana');
    const llama = el('div', 'hoy-llama' + (Comunidad.leyoHoy() ? ' prendida' : ''));
    llama.append(icono('llama'), el('b', '', Comunidad.racha()));
    const dias = el('div', 'hoy-dias');
    for (const d of Comunidad.semanaDias()) dias.appendChild(el('i', (d.leyo ? 'si' : '') + (d.hoy ? ' hoy' : '') + (d.futuro ? ' luego' : ''), d.letra));
    semana.append(llama, dias, el('span', 'hoy-nota', Comunidad.leyoHoy() ? 'Hoy ya leíste' : 'Lee hoy y prende tu racha'));
    tapa.addEventListener('click', () => abrirFicha(libro.id));
    caja.append(tapa, txt, semana);
  }

  /* ── gustos, estante y compartir ─────────────────────────────────────── */

  function marcarGusta(id, b, si) {
    if (si) estado.gusta.add(id); else estado.gusta.delete(id);
    guardarLista('lectortie.gusta', estado.gusta);
    document.querySelectorAll('[data-libro="' + id + '"] .acc-corazon').forEach(x => x.classList.toggle('querido', si));
    if (b) { b.classList.toggle('querido', si); if (si) { b.classList.remove('salta'); void b.offsetWidth; b.classList.add('salta'); } }
    if (si) { sonar('pop'); vibrar(12); }
    senal(si ? 'corazon' : 'desquerer', id, b);
  }

  function alternarEstante(id, b) {
    const si = !estado.estante.has(id);
    if (si) estado.estante.add(id); else estado.estante.delete(id);
    guardarLista('lectortie.estante', estado.estante);
    if (b) { b.classList.toggle('marcado', si); if (si) { b.classList.remove('salta'); void b.offsetWidth; b.classList.add('salta'); } }
    document.querySelectorAll('[data-libro="' + id + '"] .acc-marca').forEach(x => x.classList.toggle('marcado', si));
    pintarYo();
    if (si) sonar('pop');
    senal(si ? 'guardar' : 'quitar', id, b);
    avisar(si ? 'Guardado en tu estante' : 'Fuera del estante');
    if (estado.vista === 'estante') pintarEstante();
  }

  async function repartir(libro, texto) {
    const t = texto || (libro.titulo + ' de ' + libro.autor + ', lo encontré en lectortie');
    if (navigator.share) { try { await navigator.share({ title: 'lectortie', text: t, url: location.href.split('#')[0] }); } catch (e) { /* cancelado */ } return; }
    try { await navigator.clipboard.writeText(t + ' ' + location.href.split('#')[0]); avisar('Copiado, pégalo donde quieras'); }
    catch (e) { avisar(t); }
  }

  /* ── ficha ───────────────────────────────────────────────────────────── */

  function mini(libro, extra) {
    const a = el('div', 'mini');
    const caja = el('div', 'caja');
    Portada.pintar(caja, libro, 'M');
    if (Comunidad.terminado(libro.id)) caja.appendChild(el('span', 'mini-hecho', 'Leído'));
    caja.addEventListener('click', () => abrirFicha(libro.id));
    a.append(caja, el('b', '', libro.titulo), el('span', '', extra || libro.autor));
    return a;
  }

  function abrirFicha(id, desde, aComentarios, aComprar) {
    senal('abrir', id, null, desde);
    const l = Motor.libro(id);
    const velo = $('#velo'), cuerpo = $('#hoja-cuerpo');
    cuerpo.textContent = '';
    velo.hidden = false;
    document.body.classList.add('con-velo');

    const ficha = el('div', 'ficha');
    const arriba = el('div', 'ficha-arriba');
    const tapa = el('div', 'ficha-tapa'); Portada.pintar(tapa, l, 'M');
    const cab = el('div', 'ficha-cab');
    const t = Motor.deDonde(l);
    if (t) { const chip = el('span', 'ficha-red', RED[t.fuente] + '  ' + t.etiqueta); chip.dataset.red = t.fuente; cab.appendChild(chip); }
    cab.append(el('h2', '', l.titulo), el('div', 'autor', l.autor));
    const lec = el('p', 'ficha-lectores');
    lec.append(el('i', 'en-vivo'), Comunidad.lectoresDe(l.id) + ' lo están leyendo');
    cab.appendChild(lec);
    arriba.append(tapa, cab);

    const gancho = el('p', 'gancho', l.gancho);
    const datos = el('div', 'datos');
    for (const d of [l.anio, l.paginas + ' páginas', 'desde ' + l.edad, 'nivel ' + l.nivel]) datos.appendChild(el('span', 'dato', d));

    const lee = Comunidad.leyendo().find(x => x.libro.id === l.id);
    const hecho = Comunidad.terminado(l.id);
    const botones = el('div', 'ficha-botones');
    const leer = boton(hecho ? 'Volver a leerlo' : lee ? 'Seguir leyendo, página ' + lee.pagina : 'Empezar a leer', 'guardar', () => { cerrarFicha(); abrirLector(l.id); });
    leer.prepend(icono('play'));
    const guardar = boton('', 'guardar puesto chico');
    const pinta = () => { const si = estado.estante.has(l.id); guardar.textContent = ''; guardar.append(icono('marca'), si ? 'Guardado' : 'Guardar'); guardar.classList.toggle('marcado', si); };
    pinta();
    guardar.addEventListener('click', () => { alternarEstante(l.id); pinta(); });
    botones.append(leer, guardar);
    ficha.append(arriba, gancho, datos, botones);

    /* Conseguirlo. Aqui vive el modelo, la comision por libro vendido, sin
       cobrar nada en la demo. */
    ficha.appendChild(el('h3', '', 'Conseguirlo'));
    const conseguir = el('div', 'conseguir');
    const comprar = opcion('bolsa', 'Comprar en una librería aliada', 'Desde Q' + Comunidad.precio(l) + ', entrega en 2 días', 'Apartarlo', b => {
      b.disabled = true; b.textContent = 'Apartado'; sonar('logro'); fiesta(innerWidth / 2, innerHeight * .6, 40);
      avisar('Listo, te avisamos cuando esté en la librería');
    });
    const prestado = opcion('biblio', 'Pedirlo prestado', (2 + Math.floor(Motor.semilla(l.id) * 4)) + ' bibliotecas lo tienen en la ciudad', 'Pedirlo', b => {
      b.disabled = true; b.textContent = 'Pedido'; sonar('pop');
      avisar('Te lo guardan tres días en la biblioteca más cercana');
    });
    conseguir.append(comprar, prestado);
    if (window.TEXTOS[l.id]) {
      conseguir.prepend(opcion('libro', 'Leerlo aquí', 'Gratis, es de dominio público', 'Leer', () => { cerrarFicha(); abrirLector(l.id); }));
    }
    ficha.appendChild(conseguir);

    /* Comentarios. Lo que dicen los demas, y tu respuesta que alguien contesta. */
    const rotC = el('h3', '', Comunidad.cuantosComentarios(l.id) + ' comentarios');
    const lista = el('div', 'comentarios');
    const pintarComentarios = () => {
      lista.textContent = '';
      for (const c of Comunidad.comentarios(l.id)) {
        lista.appendChild(comentario(c));
        if (c.respuesta) { const r = comentario(Object.assign({ hace: 'ahora', likes: 0 }, c.respuesta)); r.classList.add('respuesta'); lista.appendChild(r); }
      }
    };
    pintarComentarios();
    const escribe = el('form', 'escribe');
    const campo = el('input'); campo.placeholder = 'Comenta algo, sin spoilers'; campo.maxLength = 140; campo.enterKeyHint = 'send';
    const manda = el('button', '', 'Publicar'); manda.type = 'submit';
    escribe.append(avatar(Comunidad.yo.alias || 'tú', '#2AE58C'), campo, manda);
    escribe.addEventListener('submit', ev => {
      ev.preventDefault();
      const texto = campo.value.trim();
      if (!texto) return;
      const c = Comunidad.comentar(l.id, texto);
      const resp = c.respuesta; delete c.respuesta;
      campo.value = '';
      pintarComentarios();
      sonar('pop');
      senal('corazon', l.id);
      const escribiendo = el('p', 'escribiendo', resp.alias + ' está escribiendo');
      lista.appendChild(escribiendo);
      setTimeout(() => { c.respuesta = resp; Comunidad.guardar(); escribiendo.remove(); pintarComentarios(); sonar('tic'); }, 2600);
    });
    ficha.append(rotC, lista, escribe);

    const parecidos = Motor.parecidos(l.id, 8);
    if (parecidos.length) {
      const tira = el('div', 'tira');
      for (const p of parecidos) tira.appendChild(mini(p));
      ficha.append(el('h3', '', 'Si te gusta este'), tira);
    }

    cuerpo.appendChild(ficha);
    $('#hoja').scrollTop = 0;
    if (aComentarios) setTimeout(() => rotC.scrollIntoView({ block: 'start', behavior: 'smooth' }), 260);
    if (aComprar) setTimeout(() => conseguir.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260);
  }
  function opcion(ico, titulo, detalle, accion, alTocar) {
    const f = el('div', 'opcion');
    const i = el('span', 'opcion-ico'); i.appendChild(icono(ico));
    const t = el('div', 'opcion-txt'); t.append(el('b', '', titulo), el('span', '', detalle));
    const b = boton(accion, 'opcion-btn'); b.addEventListener('click', () => alTocar(b));
    f.append(i, t, b);
    return f;
  }
  function comentario(c) {
    const f = el('div', 'comentario' + (c.tu ? ' mio' : ''));
    const t = el('div', 'com-txt');
    t.append(el('b', '', c.alias), ' ' + c.texto, el('span', '', c.hace + (c.likes ? ', ' + c.likes + ' me gusta' : '')));
    f.append(avatar(c.alias, c.color), t);
    return f;
  }
  function cerrarFicha() { $('#velo').hidden = true; document.body.classList.remove('con-velo'); }

  /* ── la sesion de lectura ────────────────────────────────────────────── */

  let reloj = null;
  function abrirLector(id) {
    const l = Motor.libro(id);
    Comunidad.empezar(id);
    senal('leer', id);
    const caja = $('#lector'), cuerpo = $('#lector-cuerpo');
    caja.hidden = false;
    document.body.classList.add('con-lector');
    cuerpo.textContent = '';
    caja.style.setProperty('--tono', l.tono);
    const fondo = el('div', 'lector-fondo'); fondo.style.backgroundImage = 'url(img/portadas/' + l.id + '.jpg)';
    caja.querySelector('.lector-fondo') && caja.querySelector('.lector-fondo').remove();
    caja.prepend(fondo);

    const texto = window.TEXTOS[l.id];
    const pagina = (Comunidad.yo.leyendo[l.id] || {}).pagina || 0;
    const cab = el('div', 'lector-cab');
    const tapa = el('div', 'lector-tapa'); Portada.pintar(tapa, l, 'M');
    const t = el('div');
    t.append(el('p', 'lector-ceja', 'Sesión de lectura'), el('h2', '', l.titulo), el('span', '', 'Vas en la página ' + pagina + ' de ' + l.paginas));
    cab.append(tapa, t);

    const META = 300;
    const aro = el('div', 'lector-aro');
    aro.innerHTML = '<svg viewBox="0 0 120 120"><circle class="pista" cx="60" cy="60" r="52"/><circle class="lleno" cx="60" cy="60" r="52" pathLength="1"/></svg>';
    const tiempo = el('b', 'lector-tiempo', '0:00');
    const meta = el('span', 'lector-meta', 'meta 5 minutos');
    aro.append(tiempo, meta);

    const centro = el('div', 'lector-centro');
    if (texto) {
      const hoja = el('div', 'lector-texto');
      hoja.appendChild(el('p', 'lector-cap', texto.capitulo));
      texto.parrafos.forEach(p => hoja.appendChild(el('p', '', p)));
      hoja.appendChild(el('p', 'lector-sigue', 'Sigue en la siguiente sesión'));
      centro.append(aro, hoja);
      centro.classList.add('con-texto');
    } else {
      centro.append(aro, el('p', 'lector-pide', 'Abre tu libro en la página ' + (pagina + 1) + '. Nosotros llevamos el tiempo.'));
    }
    const fin = boton('Terminé por hoy', 'grande', () => cuantas(l, Math.floor((Date.now() - inicio) / 1000), !!texto));
    cuerpo.append(cab, centro, fin);

    const inicio = Date.now();
    clearInterval(reloj);
    let ultimoMin = 0;
    reloj = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      tiempo.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      aro.style.setProperty('--avance', Math.min(1, s / META));
      if (s >= META && !aro.classList.contains('cumplido')) { aro.classList.add('cumplido'); meta.textContent = 'meta cumplida'; sonar('logro'); vibrar(30); }
      if (Math.floor(s / 60) > ultimoMin) { ultimoMin = Math.floor(s / 60); sonar('tic'); }
    }, 250);
  }

  function cuantas(l, segundos, conTexto) {
    clearInterval(reloj);
    const cuerpo = $('#lector-cuerpo');
    cuerpo.textContent = '';
    const pagina = (Comunidad.yo.leyendo[l.id] || {}).pagina || 0;
    const falta = Math.max(1, l.paginas - pagina);
    let n = Math.min(falta, conTexto ? 3 : Math.max(5, Math.round(segundos / 60 * 1.3)));
    const caja = el('div', 'cuantas');
    caja.append(el('p', 'lector-ceja', Math.max(1, Math.round(segundos / 60)) + (segundos < 90 ? ' minuto' : ' minutos') + ' leyendo'),
      el('h2', '', '¿Cuántas páginas leíste?'));
    const num = el('div', 'contador');
    const menos = boton('−', 'paso', () => poner(n - 1));
    const valor = el('b', '', n);
    const mas = boton('+', 'paso', () => poner(n + 1));
    num.append(menos, valor, mas);
    const rapidos = el('div', 'rapidos');
    for (const k of [5, 10, 20]) rapidos.appendChild(boton('+' + k, '', () => poner(n + k)));
    rapidos.appendChild(boton('Lo terminé', 'acabe', () => poner(falta)));
    function poner(v) { n = Math.max(1, Math.min(falta, v)); valor.textContent = n; valor.classList.remove('salta'); void valor.offsetWidth; valor.classList.add('salta'); sonar('tic'); }
    const listo = boton('Anotar', 'grande', () => festejar(l, n, segundos));
    caja.append(num, rapidos, el('p', 'cuantas-nota', 'Página ' + pagina + ' de ' + l.paginas), listo);
    cuerpo.appendChild(caja);
  }

  function festejar(l, paginas, segundos) {
    const r = Comunidad.anotarLectura(l.id, paginas, segundos / 60);
    const cuerpo = $('#lector-cuerpo');
    cuerpo.textContent = '';
    const caja = el('div', 'festejo');
    const llama = el('div', 'gran-llama');
    llama.append(icono('llama'), el('b', '', r.antes.racha));
    caja.appendChild(llama);
    const tit = el('h2', '', r.acabo ? 'Terminaste ' + l.titulo : r.despues.racha > r.antes.racha ? 'Racha encendida' : 'Sumaste páginas');
    caja.appendChild(tit);
    const datos = el('div', 'festejo-datos');
    const d1 = el('div'); d1.append(el('b', '', '+' + paginas), el('span', '', 'páginas'));
    const d2 = el('div'); d2.append(el('b', '', r.despues.semana), el('span', '', 'esta semana'));
    const d3 = el('div'); d3.append(el('b', '', '#' + r.despues.puesto), el('span', '', 'con tus amigos'));
    datos.append(d1, d2, d3);
    caja.appendChild(datos);
    if (r.despues.puesto < r.antes.puesto) caja.appendChild(el('p', 'festejo-sube', 'Pasaste del puesto ' + r.antes.puesto + ' al ' + r.despues.puesto + ' entre tus amigos'));
    if (r.acabo) {
      const rr = Comunidad.ruta();
      const sig = rr.pasos[rr.actual];
      if (sig) caja.appendChild(el('p', 'festejo-sube', 'Se abrió el siguiente escalón de tu ruta, ' + sig.libro.titulo));
    }
    const botones = el('div', 'festejo-botones');
    botones.append(
      boton('Seguir', 'grande', () => { cerrarLector(); if (r.acabo) ir('ruta'); }),
      boton('Presumirlo', 'flojo', () => repartir(l, 'Llevo ' + Math.max(1, r.despues.racha) + ' días de racha leyendo ' + l.titulo + ' en lectortie'))
    );
    caja.appendChild(botones);
    cuerpo.appendChild(caja);

    sonar(r.acabo ? 'logro' : 'llama'); vibrar([20, 40, 20]);
    fiesta(innerWidth / 2, innerHeight * .32, r.acabo ? 140 : 80);
    setTimeout(() => {
      const b = llama.querySelector('b');
      b.textContent = r.despues.racha;
      llama.classList.add('prende');
    }, 650);
    pintarYo();
  }
  function cerrarLector() {
    clearInterval(reloj);
    $('#lector').hidden = true;
    document.body.classList.remove('con-lector');
    pintarYo();
    if (estado.vista === 'feed') pintarHoy();
    if (estado.vista === 'ruta') pintarRuta();
    if (estado.vista === 'comunidad') pintarComunidad();
    if (estado.vista === 'estante') pintarEstante();
    if (estado.pendiente) { estado.pendiente = false; rearmar(); }
  }

  /* ── la ruta ─────────────────────────────────────────────────────────── */

  function pintarRuta() {
    const caja = $('#vista-ruta');
    caja.textContent = '';
    const r = Comunidad.ruta();
    const cab = el('div', 'ruta-cab');
    cab.append(el('p', 'ceja', 'Tu ruta'), el('h2', 'gran-tit', 'De lo fácil a los grandes clásicos'));
    const prog = el('div', 'ruta-prog');
    const barra = el('div', 'ruta-barra'); const i = el('i'); i.style.width = Math.max(4, r.hechos / r.pasos.length * 100) + '%'; barra.appendChild(i);
    prog.append(barra, el('span', '', r.hechos + ' de ' + r.pasos.length + ' libros'));
    cab.appendChild(prog);
    caja.appendChild(cab);

    const camino = el('ol', 'camino');
    r.pasos.forEach((p, k) => {
      const li = el('li', 'escalon' + (p.hecho ? ' hecho' : '') + (p.actual ? ' actual' : '') + (p.cerrado ? ' cerrado' : '') + (k === r.pasos.length - 1 ? ' cima' : ''));
      li.style.setProperty('--k', k);
      const nodo = el('button', 'nodo'); nodo.type = 'button';
      const tapa = el('div', 'nodo-tapa'); Portada.pintar(tapa, p.libro, 'M');
      nodo.appendChild(tapa);
      if (p.hecho) { const c = el('span', 'nodo-marca'); c.appendChild(icono('check')); nodo.appendChild(c); }
      else if (p.cerrado) { const c = el('span', 'nodo-marca'); c.appendChild(icono('candado')); nodo.appendChild(c); }
      nodo.addEventListener('click', () => abrirFicha(p.libro.id));
      const txt = el('div', 'escalon-txt');
      txt.append(el('span', 'escalon-nivel', k === r.pasos.length - 1 ? 'La cima' : 'Nivel ' + p.nivel),
        el('b', '', p.libro.titulo), el('span', '', p.libro.autor + ', ' + p.libro.paginas + ' páginas'));
      if (p.actual) {
        if (p.pagina) {
          const b = el('div', 'hoy-barra'); const ii = el('i'); ii.style.width = Math.max(3, p.pagina / p.libro.paginas * 100) + '%'; b.appendChild(ii);
          txt.append(b);
        }
        const leer = boton(p.pagina ? 'Seguir, página ' + p.pagina : 'Empezar', 'hoy-leer', () => abrirLector(p.libro.id));
        leer.prepend(icono('play'));
        txt.appendChild(leer);
      }
      if (k === r.pasos.length - 1 && !p.hecho) txt.appendChild(el('span', 'escalon-espera', 'En un par de meses te está esperando'));
      li.append(nodo, txt);
      camino.appendChild(li);
    });
    caja.appendChild(camino);

    const rehacer = boton('Rehacer mi ruta con lo que me gusta', 'flojo ancho', () => {
      Comunidad.armarRuta(Gusto.pesos());
      pintarRuta(); sonar('logro'); fiesta(innerWidth / 2, innerHeight * .4, 50);
      avisar('Tu ruta se armó con lo que te gusta ahora');
    });
    caja.appendChild(rehacer);
  }

  /* ── comunidad ───────────────────────────────────────────────────────── */

  function pintarComunidad() {
    const caja = $('#vista-comunidad');
    caja.textContent = '';
    caja.append(el('p', 'ceja', 'Comunidad'), el('h2', 'gran-tit', 'No lo haces solo'));

    const semana = el('section', 'bloque semana');
    const llama = el('div', 'gran-llama chica' + (Comunidad.leyoHoy() ? ' prende' : ''));
    llama.append(icono('llama'), el('b', '', Comunidad.racha()));
    const txt = el('div', 'semana-txt');
    txt.append(el('b', '', Comunidad.racha() === 1 ? '1 día de racha' : Comunidad.racha() + ' días de racha'),
      el('span', '', Comunidad.paginasSemana() + ' páginas esta semana, puesto ' + Comunidad.puesto() + ' entre tus amigos'));
    const dias = el('div', 'hoy-dias');
    for (const d of Comunidad.semanaDias()) dias.appendChild(el('i', (d.leyo ? 'si' : '') + (d.hoy ? ' hoy' : '') + (d.futuro ? ' luego' : ''), d.letra));
    txt.appendChild(dias);
    semana.append(llama, txt);
    caja.appendChild(semana);

    const rk = el('section', 'bloque');
    const rkCab = el('div', 'bloque-cab'); rkCab.append(el('h3', '', 'Ranking de la semana'), el('span', '', 'páginas'));
    rk.appendChild(rkCab);
    const filas = el('ol', 'tabla');
    const t = Comunidad.tabla();
    const tope = Math.max(1, t[0].paginas);
    const yoEn = t.findIndex(f => f.tu);
    t.forEach((f, i) => {
      if (i >= 7 && !f.tu) return;
      if (f.tu && i >= 7) filas.appendChild(el('li', 'tabla-salto', '...'));
      const li = el('li', f.tu ? 'tu' : '');
      li.style.setProperty('--d', i * 60 + 'ms');
      const barra = el('i', 'tabla-barra'); barra.style.width = Math.max(4, f.paginas / tope * 100) + '%';
      const nom = el('span', 'tabla-nom'); nom.append(el('b', '', f.tu ? (f.alias + ', tú') : f.alias), el('small', '', f.tu ? 'Lee para subir' : (f.libro ? f.libro.titulo : f.ciudad)));
      li.append(el('b', 'tabla-pos', i + 1), avatar(f.alias, f.color), nom, el('span', 'tabla-pag', f.paginas), barra);
      filas.appendChild(li);
    });
    rk.appendChild(filas);
    if (yoEn > 0) rk.appendChild(boton('Leer y subir', 'grande', () => abrirLector((Comunidad.leyendo()[0] || { libro: Comunidad.ruta().pasos[Math.max(0, Comunidad.ruta().actual)].libro }).libro.id)));
    caja.appendChild(rk);

    const prom = el('section', 'bloque');
    const pCab = el('div', 'bloque-cab'); pCab.append(el('h3', '', 'Tu promedio'), el('span', '', 'páginas al día'));
    prom.appendChild(pCab);
    const barras = el('div', 'barras');
    const ps = Comunidad.promedios();
    const techo = Math.max(1, ...ps.map(p => p.valor));
    for (const p of ps) {
      const b = el('div', 'col-prom' + (p.tu ? ' tu' : '') + (p.pais ? ' pais' : ''));
      const col = el('i'); col.style.setProperty('--h', Math.max(.04, p.valor / techo));
      b.append(el('b', '', p.valor), col, el('span', '', p.nombre));
      barras.appendChild(b);
    }
    prom.append(barras, el('p', 'bloque-nota', 'Hoy nadie sabe cuánto leen los jóvenes del país. Este promedio se arma con cada página que anotamos entre todos.'));
    caja.appendChild(prom);

    const am = el('section', 'bloque');
    am.appendChild(el('h3', '', 'Así van tus amigos'));
    for (const a of Comunidad.amigos()) {
      const f = el('button', 'amigo-fila'); f.type = 'button';
      const tapa = el('div', 'amigo-tapa chica'); Portada.pintar(tapa, a.libro, 'M');
      const tx = el('div', 'amigo-txt');
      const barra = el('i', 'mini-barra'); const rel = el('i'); rel.style.width = Math.round(a.pct * 100) + '%'; barra.appendChild(rel);
      tx.append(el('b', '', a.alias), el('span', '', a.libro.titulo + ', página ' + a.pagina), barra);
      f.append(avatar(a.alias, a.color), tx, tapa);
      f.addEventListener('click', () => abrirFicha(a.libro.id));
      am.appendChild(f);
    }
    caja.appendChild(am);

    const cl = el('section', 'bloque');
    cl.appendChild(el('h3', '', 'Clubes de lectura'));
    const tira = el('div', 'clubes');
    for (const c of Comunidad.clubes()) {
      const k = el('div', 'club');
      k.style.setProperty('--club', c.color);
      const tapa = el('div', 'club-tapa'); Portada.pintar(tapa, c.libro, 'M');
      const b = boton(c.dentro ? 'Dentro' : 'Unirme', 'club-btn' + (c.dentro ? ' dentro' : ''));
      b.addEventListener('click', () => {
        const si = Comunidad.alternarClub(c.id);
        b.textContent = si ? 'Dentro' : 'Unirme'; b.classList.toggle('dentro', si);
        miembros.textContent = (c.miembros + (si ? 1 : 0)) + ' lectores';
        if (si) { sonar('pop'); avisar('Te uniste a ' + c.nombre); }
      });
      const miembros = el('span', '', (c.miembros + (c.dentro ? 1 : 0)) + ' lectores');
      k.append(tapa, el('b', '', c.nombre), el('span', 'club-lee', 'Leen ' + c.libro.titulo), miembros, b);
      tira.appendChild(k);
    }
    cl.appendChild(tira);
    caja.appendChild(cl);

    const vivo = el('section', 'bloque');
    const vCab = el('div', 'bloque-cab'); vCab.append(el('h3', '', 'Ahora mismo'), el('span', 'vivo-cuenta', Comunidad.leyendoAhora() + ' leyendo'));
    vCab.querySelector('.vivo-cuenta').prepend(el('i', 'en-vivo'));
    vivo.append(vCab);
    const ul = el('ul', 'suceden'); ul.id = 'suceden-com';
    vivo.appendChild(ul);
    caja.appendChild(vivo);
    for (let k = 0; k < 5; k++) sumarSuceso(ul, Comunidad.suceso(), false);

    caja.appendChild(boton('Empezar de cero', 'flojo ancho tenue', () => {
      if (!confirmarCero()) return;
      ['lectortie.lectura', 'lectortie.gusto', 'lectortie.estante', 'lectortie.gusta', 'lectortie.para', 'lectortie.piel', 'lectortie.variante', 'lectortie.entro']
        .forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } });
      location.reload();
    }));
  }
  /* Sin dialogo del navegador. El primer toque avisa y el segundo borra. */
  let ceroArmado = 0;
  function confirmarCero() {
    if (Date.now() - ceroArmado < 4000) return true;
    ceroArmado = Date.now();
    avisar('Toca otra vez para borrar todo lo tuyo');
    return false;
  }

  function sumarSuceso(ul, s, nuevo) {
    if (!ul) return;
    const li = el('li', nuevo ? 'nuevo' : '');
    const t = el('span'); t.append(el('b', '', s.alias), ' ' + s.texto);
    li.append(avatar(s.alias, s.color), t);
    if (s.libro) li.addEventListener('click', () => abrirFicha(s.libro.id));
    ul.prepend(li);
    while (ul.children.length > 6) ul.lastChild.remove();
  }

  /* ── estante ─────────────────────────────────────────────────────────── */

  function pintarEstante() {
    const lee = $('#estante-leyendo');
    lee.textContent = '';
    const lista = Comunidad.leyendo();
    if (lista.length) {
      lee.appendChild(el('h3', 'rotulo-vista', 'Leyendo'));
      for (const x of lista) {
        const f = el('div', 'leyendo-fila');
        const tapa = el('div', 'amigo-tapa chica'); Portada.pintar(tapa, x.libro, 'M');
        tapa.addEventListener('click', () => abrirFicha(x.libro.id));
        const t = el('div', 'amigo-txt');
        const barra = el('i', 'mini-barra'); const rel = el('i'); rel.style.width = Math.max(3, x.pagina / x.libro.paginas * 100) + '%'; barra.appendChild(rel);
        t.append(el('b', '', x.libro.titulo), el('span', '', 'Página ' + x.pagina + ' de ' + x.libro.paginas), barra);
        const b = boton('Leer', 'opcion-btn', () => abrirLector(x.libro.id));
        f.append(tapa, t, b);
        lee.appendChild(f);
      }
    }
    const caja = $('#guardados');
    caja.textContent = '';
    $('#pista-estante').hidden = !!estado.estante.size;
    $('#rot-guardados').hidden = !estado.estante.size;
    for (const id of estado.estante) { const l = Motor.libro(id); if (l) caja.appendChild(mini(l)); }
    const hechos = $('#estante-hechos');
    hechos.textContent = '';
    /* Con el estante casi vacio, abajo van libros para empezarlo. Sin esto
       media pantalla del telefono quedaba en negro. */
    if (estado.estante.size < 4) {
      hechos.appendChild(el('h3', 'rotulo-vista', estado.estante.size ? 'Para seguir llenándolo' : 'Para empezar tu estante'));
      const rej = el('div', 'rejilla');
      publicaciones(12).filter(p => !estado.estante.has(p.libro.id)).slice(0, 6).forEach(p => rej.appendChild(mini(p.libro, 'Nivel ' + p.libro.nivel)));
      hechos.appendChild(rej);
    }
    if (Comunidad.yo.terminados.length) {
      hechos.appendChild(el('h3', 'rotulo-vista', 'Leídos'));
      const rej = el('div', 'rejilla');
      for (const t of Comunidad.yo.terminados) { const l = Motor.libro(t.id); if (l) rej.appendChild(mini(l, 'Terminado')); }
      hechos.appendChild(rej);
    }
  }

  /* ── deslizar ────────────────────────────────────────────────────────── */

  let reelsUsados = new Set(), reelsCuenta = 0, reelsVistos = 0;
  function llenarReels() {
    const pista = $('#reels-pista');
    let pubs = publicacionesReels();
    if (!pubs.length) { reelsUsados.clear(); pubs = publicacionesReels(); }
    for (const p of pubs) {
      reelsUsados.add(p.libro.id);
      pista.appendChild(reel(p));
      reelsCuenta++;
      if (reelsCuenta % 6 === 0) pista.appendChild(reelPausa());
      if (reelsCuenta % 9 === 0) pista.appendChild(reel(Object.assign({}, p, { promo: true, libro: Motor.libros()[Math.floor(Math.random() * Motor.libros().length)] })));
    }
  }
  function publicacionesReels() {
    const pesos = Gusto.pesos();
    const lista = Object.keys(pesos).length ? Motor.paraTi(pesos, { limite: 10, excluir: [...reelsUsados] }) : Motor.feed({ limite: 10, excluir: [...reelsUsados] });
    return lista;
  }
  const ojoReel = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    for (const e of es) {
      e.target.classList.toggle('en-vista', e.isIntersecting);
      if (!e.isIntersecting) continue;
      const id = e.target.dataset.libro;
      if (id && !e.target._visto) { e.target._visto = true; reelsVistos++; senal('ver', id, null, e.target.dataset.tendencia); }
      const pista = $('#reels-pista');
      if (e.target === pista.lastElementChild || e.target === pista.children[pista.children.length - 3]) llenarReels();
    }
  }, { threshold: .6 }) : null;

  function reel(p) {
    const l = p.libro;
    const r = el('article', 'reel' + (p.promo ? ' promo' : ''));
    r.dataset.libro = l.id;
    r.dataset.red = p.promo ? 'tuyo' : p.tendencia.fuente;
    r.dataset.tendencia = p.tendencia.id;
    r.style.setProperty('--tono', l.tono);
    const fondo = el('div', 'reel-fondo'); fondo.style.backgroundImage = 'url(img/portadas/' + l.id + '.jpg)';
    const luz = el('div', 'reel-luz');
    const clip = el('div', 'reel-clip');
    const pill = el('span', 'reel-red');
    pill.appendChild(icono(p.promo ? 'libro' : p.tendencia.fuente));
    pill.append(p.promo ? 'Promocionado por una editorial aliada' : RED[p.tendencia.fuente] + '  ' + p.tendencia.etiqueta);
    clip.appendChild(pill);
    if (!p.promo && p.tendencia.vistas) clip.appendChild(el('span', 'reel-vistas', cifra(p.tendencia.vistas) + ' vistas esta semana'));

    const tapa = el('div', 'reel-tapa');
    const img = new Image(); img.alt = 'Portada de ' + l.titulo; img.decoding = 'async'; img.loading = 'lazy'; img.src = 'img/portadas/' + l.id + '.jpg';
    tapa.appendChild(img);
    const golpe = el('div', 'golpe'); golpe.appendChild(icono('corazon'));

    const gancho = el('p', 'reel-gancho', l.gancho);
    const pie = el('div', 'reel-pie');
    pie.append(el('h3', '', l.titulo), el('span', 'reel-autor', l.autor + ', nivel ' + l.nivel + ', ' + l.paginas + ' páginas'));
    if (!p.promo) pie.appendChild(el('p', 'reel-porque', p.porque));
    const btns = el('div', 'reel-btns');
    const leer = boton(p.promo ? 'Conseguirlo desde Q' + Comunidad.precio(l) : 'Leer 5 minutos', 'grande', () => p.promo ? abrirFicha(l.id, null, false, true) : abrirLector(l.id));
    leer.prepend(icono(p.promo ? 'bolsa' : 'play'));
    btns.append(leer, boton('Ver el libro', 'flojo', () => abrirFicha(l.id, p.tendencia.id)));
    pie.appendChild(btns);

    const lado = el('div', 'reel-lado');
    const cor = ladoBtn('corazon', cifra(Comunidad.corazones(l.id)), 'acc-corazon');
    if (estado.gusta.has(l.id)) cor.classList.add('querido');
    cor.addEventListener('click', () => marcarGusta(l.id, cor, !estado.gusta.has(l.id)));
    const com = ladoBtn('comentar', cifra(Comunidad.cuantosComentarios(l.id)));
    com.addEventListener('click', () => abrirFicha(l.id, p.tendencia.id, true));
    const mar = ladoBtn('marca', 'Guardar', 'acc-marca');
    if (estado.estante.has(l.id)) mar.classList.add('marcado');
    mar.addEventListener('click', () => alternarEstante(l.id, mar));
    const com2 = ladoBtn('compartir', 'Enviar');
    com2.addEventListener('click', () => repartir(l));
    lado.append(cor, com, mar, com2);

    let toque = null, ultimo = 0;
    tapa.addEventListener('click', ev => {
      const ahora = Date.now();
      if (ahora - ultimo < 300) {
        clearTimeout(toque);
        if (!estado.gusta.has(l.id)) marcarGusta(l.id, cor, true);
        golpe.classList.remove('late'); void golpe.offsetWidth; golpe.classList.add('late');
        fiesta(ev.clientX, ev.clientY, 14, 'corazon');
      } else toque = setTimeout(() => abrirFicha(l.id, p.tendencia.id), 300);
      ultimo = ahora;
    });

    r.append(fondo, luz, clip, tapa, golpe, gancho, pie, lado);
    if (ojoReel) ojoReel.observe(r);
    return r;
  }
  function ladoBtn(ico, texto, clase) {
    const b = el('button', 'lado-btn ' + (clase || '')); b.type = 'button';
    b.append(icono(ico), el('span', '', texto));
    return b;
  }
  function reelPausa() {
    const r = el('article', 'reel pausa-reel');
    r.dataset.red = 'tuyo';
    const rr = Comunidad.ruta();
    const paso = rr.pasos[Math.max(0, rr.actual)];
    const c = el('div', 'pausa-reel-caja');
    const mano = el('div', 'mano-libro');
    mano.append(icono('deslizar'), el('i', 'flecha', ''), icono('libro'));
    c.append(mano, el('p', 'pausa-ceja', 'Llevas ' + Math.max(6, reelsVistos) + ' deslizones'),
      el('h2', '', 'Convierte este movimiento en este otro'),
      el('p', 'pausa-sub', '5 minutos de ' + paso.libro.titulo + ' y prendes tu racha'));
    const b = boton('Leer 5 minutos', 'grande', () => abrirLector(paso.libro.id));
    b.prepend(icono('play'));
    c.append(b, el('span', 'pausa-sigue', 'o sigue deslizando'));
    r.appendChild(c);
    if (ojoReel) ojoReel.observe(r);
    return r;
  }

  /* ── lo tuyo: senales y panel ────────────────────────────────────────── */

  function deDonde(b, desde) {
    if (desde) return desde;
    const pub = b && b.closest && b.closest('[data-tendencia]');
    return pub ? pub.dataset.tendencia : null;
  }
  function senal(que, libro, b, desde, texto) {
    const t = deDonde(b, desde);
    Gusto.registrar(que, { libro: libro || undefined, tendencia: t && t !== 'tuyo' ? t : undefined, texto: texto || undefined });
  }

  let ojo = null;
  function mirar(art) {
    if (!('IntersectionObserver' in window)) return;
    if (!ojo) {
      ojo = new IntersectionObserver(es => {
        for (const e of es) {
          if (e.intersectionRatio < .6) continue;
          const id = e.target.dataset.libro;
          ojo.unobserve(e.target);
          if (estado.vistos.has(id)) continue;
          estado.vistos.add(id);
          senal('ver', id, null, e.target.dataset.tendencia);
        }
      }, { threshold: [.6] });
    }
    ojo.observe(art);
  }

  function relojTxt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function pintarTuyo() {
    const caja = $('#tuyo');
    const perfil = Gusto.perfil();
    vestirSegunPerfil();
    if (!perfil || estado.vista !== 'feed' || estado.filtro) { caja.hidden = true; return; }
    caja.hidden = false;
    const mia = estado.armada && perfil.listo;
    caja.classList.toggle('puesta', mia);
    caja.querySelector('.tuyo-botones').hidden = !mia;
    const temas = $('#tuyo-temas');
    temas.textContent = '';
    for (const t of perfil.temas.slice(0, 5)) temas.appendChild(el('span', '', t.tema));
    temas.hidden = !perfil.temas.length;
    const vestida = perfil.piel && perfil.piel !== 'noche';
    const avance = $('#tuyo-avance');
    if (mia) {
      $('#tuyo-titulo').textContent = vestida ? 'Tu página, en ' + perfil.pielNombre : 'Tu página';
      $('#tuyo-porque').textContent = perfil.porque || 'Armada con lo que fuiste tocando.';
      $('#tuyo-reloj').textContent = 'se rearma en ' + relojTxt(Gusto.restante());
      avance.style.width = (100 - Gusto.restante() / Gusto.CICLO_MS * 100).toFixed(1) + '%';
    } else if (perfil.listo) {
      $('#tuyo-titulo').textContent = 'Ya sé qué te gusta';
      $('#tuyo-porque').textContent = perfil.porque || 'Hay con qué armar tu página.';
      $('#tuyo-reloj').textContent = 'armando';
      avance.style.width = '100%';
    } else {
      $('#tuyo-titulo').textContent = 'Aprendiendo de lo que haces';
      const f = perfil.faltan;
      $('#tuyo-porque').textContent = f
        ? 'Abre, guarda o dale corazón a ' + f + (f === 1 ? ' libro más' : ' libros más') + ' y la página cambia contigo.'
        : 'Ya casi.';
      $('#tuyo-reloj').textContent = perfil.fuertes + ' de 5';
      avance.style.width = Math.min(100, perfil.fuertes / 5 * 100) + '%';
    }
  }

  function vestir(nombre) {
    const piel = nombre && nombre !== 'noche' ? nombre : '';
    if (piel) document.documentElement.dataset.piel = piel;
    else delete document.documentElement.dataset.piel;
    try { if (piel) localStorage.setItem('lectortie.piel', piel); else localStorage.removeItem('lectortie.piel'); } catch (e) { /* modo privado */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--noche').trim() || '#0A0912';
  }
  function variar(n) {
    const v = String(Number(n) || 0);
    document.documentElement.dataset.variante = v;
    try { localStorage.setItem('lectortie.variante', v); } catch (e) { /* modo privado */ }
  }
  function vestirSegunPerfil() {
    const perfil = Gusto.perfil();
    vestir(estado.armada && perfil.listo ? perfil.piel : null);
  }

  /* El rearme ya no recarga la pagina. Pasa una cortina, cambia la piel y el
     feed vuelve armado, sin perder lo que estabas haciendo. Si estas leyendo o
     con una ficha abierta, espera a que vuelvas al inicio. */
  function rearmar() {
    const perfil = Gusto.perfil();
    if (!perfil.listo) return;
    if (estado.vista !== 'feed' || !$('#velo').hidden || !$('#lector').hidden || !$('#entrada').hidden) { estado.pendiente = true; return; }
    const primera = !estado.armada;
    estado.armada = true;
    Gusto.marcarArmada(true);
    try { localStorage.setItem('lectortie.para', 'yo'); } catch (e) { /* modo privado */ }
    document.body.classList.add('rearmando');
    setTimeout(() => {
      variar(Gusto.vuelta());
      vestirSegunPerfil();
      scrollTo({ top: 0 });
      cargarFeed();
    }, 420);
    setTimeout(() => {
      document.body.classList.remove('rearmando');
      sonar('logro');
      if (primera) fiesta(innerWidth / 2, innerHeight * .3, 60);
      avisar(perfil.piel !== 'noche' ? 'Tu página cambió contigo, ahora es ' + perfil.pielNombre : 'Tu página se armó contigo');
    }, 980);
  }

  function olvidarTodo() {
    estado.armada = false;
    try { localStorage.setItem('lectortie.para', 'todos'); localStorage.removeItem('lectortie.variante'); } catch (e) { /* modo privado */ }
    Gusto.marcarArmada(false);
    vestir(null);
    delete document.documentElement.dataset.variante;
    estado.vistos.clear();
    Gusto.olvidar().then(() => { cargarFeed(); avisar('Olvidado, vuelve a empezar'); });
  }

  /* ── vistas ──────────────────────────────────────────────────────────── */

  function ir(vista) {
    const antes = estado.vista;
    estado.vista = vista;
    for (const v of ['feed', 'buscar', 'estante', 'ruta', 'comunidad']) $('#vista-' + v).hidden = vista !== v;
    $('#historias').hidden = vista !== 'feed';
    $('#filtro').hidden = vista !== 'feed' || !estado.filtro;
    $('#hoy').hidden = vista !== 'feed' || estado.filtro || !Comunidad.yo.ruta.length;
    document.body.classList.toggle('buscando', vista === 'buscar');
    document.body.classList.toggle('en-reels', vista === 'deslizar');
    $('#reels').hidden = vista !== 'deslizar';
    pintarTuyo();
    document.querySelectorAll('[data-ir]').forEach(b => {
      if (b.classList.contains('marca') || b.id === 'racha-pill') return;
      b.classList.toggle('activo', b.dataset.ir === vista);
    });
    if (vista === 'estante') pintarEstante();
    if (vista === 'ruta') pintarRuta();
    if (vista === 'comunidad') pintarComunidad();
    if (vista === 'deslizar' && !$('#reels-pista').children.length) llenarReels();
    if (vista === 'feed' && antes !== 'feed') { pintarHoy(); if (estado.pendiente) { estado.pendiente = false; setTimeout(rearmar, 400); } }
    if (vista === 'buscar') { const q = $('#q'); if (q && !TOCA) q.focus(); }
    if (vista !== antes && vista !== 'deslizar') scrollTo({ top: 0 });
  }

  function pintarSugerencias() {
    const caja = $('#sugerencias');
    caja.textContent = '';
    const vistos = new Set();
    for (const t of estado.tendencias) for (const tema of t.temas) {
      if (vistos.has(tema) || vistos.size >= 14) continue;
      vistos.add(tema);
      caja.appendChild(boton(Motor.tema(tema), '', () => { $('#q').value = Motor.tema(tema); buscar(Motor.tema(tema)); }));
    }
  }
  let tecla = null;
  function buscar(texto) {
    const caja = $('#resultados'), pista = $('#pista-buscar'), sug = $('#sugerencias');
    if (!texto.trim()) { caja.textContent = ''; pista.hidden = false; pista.textContent = 'Prueba con un tema'; sug.hidden = false; return; }
    const libros = Motor.buscar(texto);
    caja.textContent = '';
    if (!libros.length) { pista.hidden = false; pista.textContent = 'Nada con ' + texto + '. Prueba con uno de estos'; sug.hidden = false; return; }
    pista.hidden = true; sug.hidden = true;
    senal('buscar', null, null, null, texto);
    for (const l of libros) caja.appendChild(mini(l));
  }

  /* ── la entrada ──────────────────────────────────────────────────────── */

  function entrada() {
    const caja = $('#entrada');
    caja.hidden = false;
    document.body.classList.add('con-entrada');
    $('#ent-leyendo').textContent = Comunidad.leyendoAhora();

    /* portadas flotando detras del logo */
    const fondo = $('#ent-fondo');
    const libros = Motor.libros().slice().sort(() => Math.random() - .5).slice(0, 18);
    libros.forEach((l, i) => {
      const t = el('i');
      t.style.backgroundImage = 'url(img/portadas/' + l.id + '.jpg)';
      t.style.left = (i % 6) * 17 + Math.random() * 6 + '%';
      t.style.animationDelay = -(i * 1.7) + 's';
      t.style.animationDuration = 16 + (i % 5) * 3 + 's';
      fondo.appendChild(t);
    });

    const elegidas = new Set();
    let nivel = 0;
    const temas = $('#ent-temas');
    for (const t of estado.tendencias) {
      const b = el('button', 'ent-tema'); b.type = 'button'; b.dataset.red = t.fuente;
      const aro = el('span', 'ent-aro'); aro.appendChild(icono(t.fuente));
      b.append(aro, el('b', '', t.titulo), el('span', '', t.etiqueta));
      b.addEventListener('click', () => {
        if (elegidas.has(t.id)) elegidas.delete(t.id); else { elegidas.add(t.id); sonar('pop'); vibrar(8); }
        b.classList.toggle('puesta', elegidas.has(t.id));
        $('#ent-uno').disabled = !elegidas.size;
        $('#ent-uno').textContent = elegidas.size ? 'Sigue con ' + elegidas.size : 'Elige al menos una';
      });
      temas.appendChild(b);
    }
    $('#ent-uno').textContent = 'Elige al menos una';
    $('#ent-cuanto').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      $('#ent-cuanto').querySelectorAll('button').forEach(x => x.classList.toggle('puesta', x === b));
      nivel = Number(b.dataset.nivel); sonar('pop'); $('#ent-dos').disabled = false;
    }));

    const paso = n => {
      caja.querySelectorAll('.ent-paso').forEach(s => { s.hidden = Number(s.dataset.paso) !== n; });
      caja.classList.toggle('pasos', n > 0);
      caja.scrollTop = 0;
    };
    caja.querySelectorAll('[data-sigue]').forEach(b => b.addEventListener('click', () => {
      const n = Number(b.dataset.sigue);
      sonar('pop');
      if (n < 3) { paso(n); return; }
      paso(3);
      armando([...elegidas], nivel);
    }));
  }

  function armando(elegidas, nivel) {
    const yo = Comunidad.yo;
    yo.alias = ($('#ent-alias').value || '').trim().replace(/\s+/g, '.').toLowerCase().slice(0, 18) || 'lector' + Math.floor(100 + Math.random() * 900);
    yo.nivelInicio = nivel || 1;
    yo.elegidas = elegidas;
    for (const id of elegidas) {
      const t = estado.tendencias.find(x => x.id === id);
      Gusto.registrar('elegir', { temas: t.temas.slice(0, 3), tendencia: id });
    }
    Gusto.empujar().then(() => {
      const ruta = Comunidad.armarRuta(Gusto.pesos());
      const caja = $('#ent-armando');
      const libros = ruta.map(id => Motor.libro(id));
      libros.forEach((l, i) => {
        const t = el('i');
        t.style.backgroundImage = 'url(img/portadas/' + l.id + '.jpg)';
        t.style.setProperty('--i', i);
        caja.appendChild(t);
        setTimeout(() => sonar('tic'), 250 + i * 220);
      });
      const txt = $('#ent-armando-txt');
      setTimeout(() => { txt.textContent = 'Empiezas con ' + libros[0].titulo; }, 1300);
      setTimeout(() => { txt.textContent = 'Y en un par de meses, ' + libros[libros.length - 1].titulo; }, 2500);
      setTimeout(() => {
        try { localStorage.setItem('lectortie.entro', '1'); } catch (e) { /* modo privado */ }
        Comunidad.guardar();
        $('#entrada').classList.add('sale');
        sonar('logro');
        fiesta(innerWidth / 2, innerHeight * .35, 90);
        setTimeout(() => {
          $('#entrada').hidden = true;
          document.body.classList.remove('con-entrada');
          pintarYo(); cargarFeed(); ir('feed');
          setTimeout(() => noti({ alias: 'lectortie', color: '#5B3DF5', texto: 'tu ruta está lista, empieza por ' + libros[0].titulo, libro: libros[0] }, () => ir('ruta')), 2500);
        }, 600);
      }, 3700);
    });
  }

  /* ── arranque ────────────────────────────────────────────────────────── */

  function conectar() {
    document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', ev => {
      ev.preventDefault();
      if (b.dataset.ir === 'feed' && estado.vista === 'feed') scrollTo({ top: 0, behavior: 'smooth' });
      ir(b.dataset.ir);
    }));
    $('#filtro-quitar').addEventListener('click', () => filtrar(null));
    $('#cerrar').addEventListener('click', cerrarFicha);
    $('#lector-cerrar').addEventListener('click', cerrarLector);
    $('#velo').addEventListener('click', ev => { if (ev.target === $('#velo')) cerrarFicha(); });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { if (!$('#velo').hidden) cerrarFicha(); else if (!$('#lector').hidden) cerrarLector(); }
      if (estado.vista === 'deslizar' && $('#velo').hidden && $('#lector').hidden && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(ev.key)) {
        ev.preventDefault();
        const p = $('#reels-pista');
        p.scrollBy({ top: (ev.key === 'ArrowUp' || ev.key === 'PageUp' ? -1 : 1) * p.clientHeight, behavior: 'smooth' });
      }
    });
    $('#tuyo-olvidar').addEventListener('click', olvidarTodo);
    $('#buscador').addEventListener('submit', ev => { ev.preventDefault(); $('#q').blur(); });
    $('#q').addEventListener('input', ev => {
      const v = ev.target.value;
      if (estado.vista !== 'buscar') ir('buscar');
      clearTimeout(tecla);
      tecla = setTimeout(() => buscar(v), 200);
    });
    /* El primer toque despierta el audio en iPhone. */
    addEventListener('pointerdown', () => { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); } catch (e) { /* nada */ } }, { once: true });
  }

  async function arrancar() {
    try {
      if (estado.armada) {
        const p = localStorage.getItem('lectortie.piel'); if (p) vestir(p);
        const v = localStorage.getItem('lectortie.variante'); if (v) variar(v);
      }
    } catch (e) { /* modo privado */ }
    conectar();
    try { await Motor.cargar(); }
    catch (e) { $('#vista-feed').appendChild(el('p', 'cargando', 'No se pudieron leer los libros. Revisa la conexión y recarga.')); return; }

    estado.tendencias = Motor.tendencias();
    pintarHistorias(); pintarRanking(); pintarSugerencias(); pintarYo();

    let entro = false;
    try { entro = !!localStorage.getItem('lectortie.entro'); } catch (e) { /* modo privado */ }
    if (!entro) entrada();
    else cargarFeed();

    Gusto.marcarArmada(estado.armada);
    Gusto.empezar(() => pintarTuyo(), rearmar);
    setInterval(pintarTuyo, 1000);

    /* La red se mueve sola, un poco cada tanto. */
    setInterval(() => {
      const s = Comunidad.suceso();
      sumarSuceso($('#suceden-lado'), s, true);
      sumarSuceso(document.getElementById('suceden-com'), s, true);
      $('#reels-vivo').textContent = Comunidad.leyendoAhora();
      const vc = document.querySelector('.vivo-cuenta'); if (vc) vc.lastChild.textContent = Comunidad.leyendoAhora() + ' leyendo';
    }, 7000);
    for (let k = 0; k < 5; k++) sumarSuceso($('#suceden-lado'), Comunidad.suceso(), false);
    $('#reels-vivo').textContent = Comunidad.leyendoAhora();
    setInterval(() => { estado.tendencias = Motor.tendencias(); pintarRanking(); }, 60000);

    let pausaNoti = 0;
    setInterval(() => {
      if (!$('#entrada').hidden || ++pausaNoti % 2) return;
      const s = Comunidad.suceso();
      noti(s);
    }, 26000);
  }

  arrancar();

})();
