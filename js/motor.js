/* El motor de LECTORTIE, ahora dentro del navegador.

   Antes vivia en servidor/ y la pagina le preguntaba por /api. Para que la
   app se pueda abrir desde cualquier telefono sin levantar nada, el mismo
   motor corre aqui: cruza tendencias con libros, aprende de lo que tocas y
   guarda todo en el navegador de cada quien. Para esto no hace falta servidor.

   La regla para recomendar sigue siendo una sola. Cada tendencia trae sus
   temas en orden, cada libro trae los suyos, y el puntaje es cuanto se cruzan
   pesando mas los primeros. Si el motivo no se puede escribir, no sale. */

window.Motor = (function () {

  let LIBROS = [], TENDENCIAS = [], POR_ID = new Map();

  function llano(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /* Un numero estable por texto. Sirve para que el dia de hoy y cada libro den
     siempre lo mismo, asi la app no cambia de cifras con cada recarga. */
  function semilla(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  function hoy() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function cargar() {
    const [l, t] = await Promise.all([
      fetch('datos/libros.json').then(r => r.json()),
      fetch('datos/tendencias.json').then(r => r.json())
    ]);
    LIBROS = l;
    POR_ID = new Map(l.map(x => [x.id, x]));
    TENDENCIAS = t;
  }

  /* El momento de cada tendencia. Lo guardado pesa 70 y el pulso del dia 30,
     y el pulso se mueve un poco cada minuto. Asi Sube ahora no es una lista
     muerta y aun asi no salta de un extremo al otro. */
  function tendencias() {
    const dia = hoy();
    const minuto = Math.floor(Date.now() / 60000);
    return TENDENCIAS.map(t => {
      const pulso = semilla(dia + t.id);
      const vaiven = Math.sin(minuto / 7 + semilla(t.id) * 6.28) * 0.08;
      const momento = Math.round(Math.max(1, (Number(t.subida) || 0) * 0.7 + (pulso + vaiven) * 30));
      return Object.assign({}, t, { momento });
    }).sort((a, b) => b.momento - a.momento);
  }

  function peso(i) { return 1 / (1 + i * 0.45); }

  function cruce(libro, t) {
    const temas = t.temas || [];
    const suyos = new Set(libro.temas || []);
    let puntos = 0;
    const coinciden = [];
    temas.forEach((tema, i) => { if (suyos.has(tema)) { puntos += peso(i); coinciden.push(tema); } });
    const techo = temas.reduce((s, _, i) => s + peso(i), 0);
    return { puntos, coinciden, afinidad: techo ? Math.round((puntos / techo) * 100) : 0 };
  }

  const RED = { tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram' };
  const TEMA = {
    'fantasia': 'fantasía', 'mitologia': 'mitología', 'clasico': 'clásicos', 'superacion': 'superación',
    'latinoamerica': 'Latinoamérica', 'gotico': 'gótico', 'distopia': 'distopía', 'tecnologia': 'tecnología',
    'inteligencia artificial': 'inteligencia artificial', 'ciencia ficcion': 'ciencia ficción',
    'habitos': 'hábitos', 'realismo magico': 'realismo mágico', 'corto': 'libros cortos', 'atraco': 'atracos'
  };
  function tema(t) { return TEMA[t] || t; }

  function motivo(coinciden, t) {
    const dos = coinciden.slice(0, 2).map(tema);
    const por = dos.length === 2 ? dos[0] + ' y ' + dos[1] : (dos[0] || t.titulo.toLowerCase());
    return 'Sale de ' + t.titulo + ' en ' + (RED[t.fuente] || t.fuente) + ' por ' + por;
  }

  function cabecera(t) {
    return { id: t.id, titulo: t.titulo, fuente: t.fuente, etiqueta: t.etiqueta, vistas: t.vistas };
  }

  function porTendencia(t, o) {
    o = o || {};
    const fuera = new Set(o.excluir || []);
    const minimo = o.minimo === undefined ? 25 : o.minimo;
    const salida = [];
    for (const libro of LIBROS) {
      if (fuera.has(libro.id)) continue;
      const c = cruce(libro, t);
      if (c.afinidad < minimo || !c.coinciden.length) continue;
      salida.push({ libro, tendencia: cabecera(t), afinidad: c.afinidad, temas: c.coinciden, porque: motivo(c.coinciden, t) });
    }
    salida.sort((a, b) => b.afinidad - a.afinidad || a.libro.nivel - b.libro.nivel || a.libro.titulo.localeCompare(b.libro.titulo, 'es'));
    return o.limite ? salida.slice(0, o.limite) : salida;
  }

  /* El feed de todos, por rondas: en cada vuelta el mejor libro que le queda a
     cada tendencia, empezando por la que mas suena. */
  function feed(o) {
    o = o || {};
    const limite = o.limite || 24;
    const usados = new Set(o.excluir || []);
    const colas = tendencias().map(t => porTendencia(t, { minimo: 30 }));
    const salida = [];
    for (let ronda = 0; salida.length < limite && ronda < 40; ronda++) {
      let puso = false;
      for (const cola of colas) {
        if (salida.length >= limite) break;
        const s = cola.find(p => !usados.has(p.libro.id));
        if (!s) continue;
        usados.add(s.libro.id); salida.push(s); puso = true;
      }
      if (!puso) break;
    }
    return salida;
  }

  /* El feed de una persona. 60 por ciento tus temas, 40 lo que suena hoy, y
     nunca mas de dos seguidas de la misma tendencia. */
  function paraTi(pesos, o) {
    o = o || {};
    const limite = o.limite || 24;
    const fuera = new Set(o.excluir || []);
    const techo = Math.max(...Object.values(pesos), 1);
    const ts = tendencias();
    const marcados = [];
    for (const libro of LIBROS) {
      if (fuera.has(libro.id)) continue;
      const tuyos = (libro.temas || []).filter(t => pesos[t] > 0);
      const mio = Math.min(1, tuyos.reduce((s, t) => s + pesos[t], 0) / (techo * 1.6));
      let mejor = null;
      for (const t of ts) {
        const c = cruce(libro, t);
        if (!c.coinciden.length) continue;
        if (!mejor || c.afinidad > mejor.c.afinidad) mejor = { t, c };
      }
      if (!mejor && !tuyos.length) continue;
      const nota = mio * 0.6 + (mejor ? mejor.c.afinidad / 100 : 0) * 0.4;
      if (nota > 0) marcados.push({ libro, tuyos, mio, mejor, nota });
    }
    marcados.sort((a, b) => b.nota - a.nota || a.libro.nivel - b.libro.nivel);

    const salida = [], espera = [];
    let ultima = null, seguidas = 0;
    const idDe = m => m.mejor ? m.mejor.t.id : 'tuyo';
    const cabe = m => !(idDe(m) === ultima && seguidas >= 2);
    const poner = m => { seguidas = idDe(m) === ultima ? seguidas + 1 : 1; ultima = idDe(m); salida.push(m); };
    for (const m of marcados) {
      if (salida.length >= limite) break;
      if (cabe(m)) {
        poner(m);
        for (let i = 0; i < espera.length && salida.length < limite; i++) if (cabe(espera[i])) poner(espera.splice(i--, 1)[0]);
      } else espera.push(m);
    }
    for (const m of espera) { if (salida.length >= limite) break; poner(m); }

    return salida.map(m => {
      const t = m.mejor ? m.mejor.t : null;
      const dos = m.tuyos.slice(0, 2).map(tema);
      const porque = dos.length
        ? 'Va contigo por ' + (dos.length === 2 ? dos[0] + ' y ' + dos[1] : dos[0]) + (t ? ', y ahora suena en ' + t.titulo : '')
        : motivo(m.mejor.c.coinciden, t);
      return {
        libro: m.libro,
        tendencia: t ? cabecera(t) : { id: 'tuyo', titulo: 'Tu gusto', fuente: 'tuyo', etiqueta: '#loTuyo' },
        afinidad: Math.round(m.nota * 100), temas: dos, tuyo: Math.round(m.mio * 100), porque
      };
    });
  }

  function buscar(texto) {
    const partes = llano(texto).split(/\s+/).filter(Boolean);
    if (!partes.length) return [];
    return LIBROS.filter(l => {
      const heno = llano(l.titulo + ' ' + l.autor + ' ' + (l.temas || []).join(' ') + ' ' + (l.temas || []).map(tema).join(' ') + (l.libre ? ' gratis libre completo dominio publico' : ''));
      return partes.every(p => heno.includes(p));
    }).slice(0, 30);
  }

  function parecidos(id, limite) {
    const base = POR_ID.get(id);
    if (!base) return [];
    const suyos = new Set(base.temas || []);
    return LIBROS.filter(l => l.id !== id)
      .map(l => ({ l, n: (l.temas || []).filter(t => suyos.has(t)).length }))
      .filter(x => x.n)
      .sort((a, b) => b.n - a.n || a.l.nivel - b.l.nivel)
      .slice(0, limite || 6).map(x => x.l);
  }

  /* De que tendencia sale mejor un libro, para escribir de donde viene. */
  function deDonde(libro) {
    let mejor = null;
    for (const t of tendencias()) {
      const c = cruce(libro, t);
      if (c.coinciden.length && (!mejor || c.afinidad > mejor.c.afinidad)) mejor = { t, c };
    }
    return mejor ? mejor.t : null;
  }

  return {
    cargar, tendencias, porTendencia, feed, paraTi, buscar, parecidos, deDonde, cruce, tema, llano, semilla, hoy,
    libros: () => LIBROS, libro: id => POR_ID.get(id), RED
  };
})();


/* EL GUSTO. Lo que la app aprende de como la usas, guardado en este
   navegador. Mismos pesos de siempre y la misma interfaz que tenia el cliente
   del servidor, para que el resto de la pagina no note el cambio.

     guardar 5    corazon 3    abrir 2    buscar 2    ver 0.35
     quitar -5    quitar el corazon -3                              */

window.Gusto = (function () {

  const LLAVE = 'lectortie.gusto';
  const CADA_MS = 3000;
  const CICLO_MS = 60 * 1000;
  const PESOS = { guardar: 5, corazon: 3, abrir: 2, buscar: 2, ver: 0.35, quitar: -5, desquerer: -3, leer: 4, elegir: 3 };
  const FUERTES = new Set(['guardar', 'corazon', 'abrir', 'buscar', 'leer']);
  const SUFICIENTES = 5, PACIENCIA_MS = 60 * 1000, MINIMO_POR_TIEMPO = 2, PARA_VESTIR = 6, VARIANTES = 4;

  const PIELES = {
    romantasy: { nombre: 'Romantasy', temas: ['romantasy', 'romance', 'fantasia', 'hadas', 'dragones', 'magia'] },
    terror: { nombre: 'Terror', temas: ['terror', 'gotico', 'misterio', 'intriga', 'cuentos'] },
    distopia: { nombre: 'Distopía', temas: ['distopia', 'ciencia ficcion', 'vigilancia', 'inteligencia artificial', 'justicia'] },
    arcade: { nombre: 'Arcade', temas: ['videojuegos', 'ochentas', 'tecnologia', 'humor'] },
    calma: { nombre: 'Calma', temas: ['salud mental', 'sentido', 'superacion', 'habitos'] },
    espacio: { nombre: 'Espacio', temas: ['espacio', 'ciencia', 'supervivencia'] },
    academia: { nombre: 'Academia', temas: ['academia', 'clasico', 'tragedia', 'mitologia', 'historia', 'venganza'] },
    selva: { nombre: 'Selva', temas: ['latinoamerica', 'realismo magico', 'familia'] }
  };

  function vacio() {
    return { desde: 0, ultimo: 0, senales: 0, fuertes: 0, vueltas: 0, temas: {}, redes: {}, tendencias: {}, libros: {}, busquedas: [] };
  }
  let g = leer();
  function leer() {
    try { return Object.assign(vacio(), JSON.parse(localStorage.getItem(LLAVE) || '{}')); }
    catch (e) { return vacio(); }
  }
  function guardar() { try { localStorage.setItem(LLAVE, JSON.stringify(g)); } catch (e) { /* modo privado */ } }
  function sumar(mapa, llave, cuanto) {
    if (!llave) return;
    mapa[llave] = Math.max(0, Math.round(((mapa[llave] || 0) + cuanto) * 100) / 100);
  }

  const cola = [];
  function registrar(que, datos) {
    cola.push(Object.assign({ que }, datos || {}));
    if (cola.length > 60) cola.splice(0, cola.length - 60);
  }

  function temasDeBusqueda(texto) {
    const salieron = Motor.buscar(texto).slice(0, 6);
    const cuenta = {};
    for (const l of salieron) for (const t of l.temas || []) cuenta[t] = (cuenta[t] || 0) + 1;
    return Object.entries(cuenta).filter(([, n]) => n >= Math.min(2, salieron.length))
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  }

  function anotar(s) {
    const p = PESOS[s.que];
    if (p === undefined) return;
    const ahora = Date.now();
    if (!g.desde) g.desde = ahora;
    g.ultimo = ahora; g.senales++;
    if (FUERTES.has(s.que)) g.fuertes++;
    if (s.que === 'buscar') {
      const texto = String(s.texto || '').trim().slice(0, 60);
      if (texto) {
        g.busquedas = [texto].concat(g.busquedas.filter(b => b !== texto)).slice(0, 12);
        for (const t of temasDeBusqueda(texto)) sumar(g.temas, t, p);
      }
      return;
    }
    if (s.que === 'elegir' && s.temas) { for (const t of s.temas) sumar(g.temas, t, p); }
    const libro = s.libro ? Motor.libro(s.libro) : null;
    if (libro) {
      for (const t of libro.temas || []) sumar(g.temas, t, p);
      if (p > 0) {
        const antes = g.libros[libro.id];
        if (!antes || antes.peso < p) g.libros[libro.id] = { peso: p, que: s.que, titulo: libro.titulo, cuando: ahora };
      } else delete g.libros[libro.id];
    }
    const t = s.tendencia ? Motor.tendencias().find(x => x.id === s.tendencia) : null;
    if (t) { sumar(g.tendencias, t.id, p); sumar(g.redes, t.fuente, p); }
  }

  function piel() {
    let mejor = null;
    for (const [id, p] of Object.entries(PIELES)) {
      const suma = p.temas.reduce((s, t) => s + (g.temas[t] || 0), 0);
      if (!mejor || suma > mejor.suma) mejor = { id, nombre: p.nombre, suma };
    }
    if (!mejor || mejor.suma < PARA_VESTIR) return { id: 'noche', nombre: 'La de todos', cerca: mejor && mejor.suma > 0 ? mejor : null };
    return Object.assign({ cerca: mejor }, mejor);
  }
  function ordenado(m) { return Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); }
  function listo() {
    if (g.fuertes >= SUFICIENTES) return true;
    return g.fuertes >= MINIMO_POR_TIEMPO && g.desde > 0 && Date.now() - g.desde >= PACIENCIA_MS;
  }
  function porque() {
    const temas = ordenado(g.temas).slice(0, 2).map(x => Motor.tema(x[0]));
    if (!temas.length) return '';
    const gestos = Object.values(g.libros).sort((a, b) => b.peso - a.peso || b.cuando - a.cuando);
    const guardados = gestos.filter(x => x.que === 'guardar').slice(0, 2);
    const queridos = gestos.filter(x => x.que === 'corazon').slice(0, 2);
    const partes = [];
    if (guardados.length) partes.push('guardaste ' + guardados.map(x => x.titulo).join(' y '));
    if (queridos.length) partes.push('te gustó ' + queridos.map(x => x.titulo).join(' y '));
    if (!partes.length && gestos.length) partes.push('abriste ' + gestos.slice(0, 2).map(x => x.titulo).join(' y '));
    if (!partes.length && g.busquedas.length) partes.push('buscaste ' + g.busquedas[0]);
    if (!partes.length) return 'Por lo que ves en redes, arriba va ' + (temas.length === 2 ? temas[0] + ' y ' + temas[1] : temas[0]) + '.';
    return 'Porque ' + partes.join(', y ') + ', arriba va ' + (temas.length === 2 ? temas[0] + ' y ' + temas[1] : temas[0]) + '.';
  }

  function perfil() {
    const v = piel();
    return {
      listo: listo(), piel: v.id, pielNombre: v.nombre,
      /* La piel a la que va, aunque todavia no alcance. El fondo se tine hacia
         ella un paso con cada gesto, para que el cambio se vea venir. */
      pielCerca: v.cerca ? v.cerca.id : null, pielCercaNombre: v.cerca ? v.cerca.nombre : '',
      variante: (g.vueltas || 0) % VARIANTES, vueltas: g.vueltas || 0,
      senales: g.senales, fuertes: g.fuertes, faltan: Math.max(0, SUFICIENTES - g.fuertes),
      paciencia: Math.round(PACIENCIA_MS / 1000),
      temas: ordenado(g.temas).slice(0, 6).map(([t, peso]) => ({ tema: Motor.tema(t), llave: t, peso })),
      guardados: Object.entries(g.libros).filter(([, x]) => x.que === 'guardar').map(([id]) => id),
      porque: porque()
    };
  }

  let ultimo = null, alSaber = null, arrancado = 0, armada = false;
  function restante() { return arrancado ? Math.max(0, CICLO_MS - (Date.now() - arrancado)) : CICLO_MS; }

  async function empujar() {
    if (cola.length) { cola.splice(0).forEach(anotar); guardar(); }
    ultimo = perfil();
    if (alSaber) alSaber(ultimo, restante());
    return ultimo;
  }
  async function cargar() { ultimo = perfil(); return ultimo; }
  async function olvidar() {
    cola.length = 0; g = vacio(); guardar(); arrancado = Date.now(); ultimo = perfil(); return ultimo;
  }
  function vuelta() { g.vueltas = (g.vueltas || 0) + 1; guardar(); return g.vueltas; }
  function marcarArmada(si) { armada = !!si; }
  let fuertesAlArmar = 0;
  function toca() {
    if (!ultimo || !ultimo.listo) return false;
    if (!armada) return true;
    return restante() === 0 && g.fuertes > fuertesAlArmar;
  }
  function reiniciarCiclo() { arrancado = Date.now(); fuertesAlArmar = g.fuertes; }

  function empezar(cuandoCambie, cuandoToque) {
    alSaber = cuandoCambie;
    arrancado = Date.now();
    fuertesAlArmar = g.fuertes;
    ultimo = perfil();
    setInterval(async () => {
      await empujar();
      if (toca()) { reiniciarCiclo(); cuandoToque(); }
      else if (restante() === 0) arrancado = Date.now();
    }, CADA_MS);
    addEventListener('pagehide', () => { if (cola.length) { cola.splice(0).forEach(anotar); guardar(); } });
  }

  return {
    registrar, empujar, cargar, olvidar, empezar, reiniciarCiclo, restante, marcarArmada, vuelta,
    perfil: () => ultimo || perfil(), pesos: () => Object.assign({}, g.temas), CICLO_MS
  };
})();
