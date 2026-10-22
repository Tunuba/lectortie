/* El motor de LECTORTIE: de una tendencia a una lista de libros, con el
   motivo escrito.

   La regla es una sola y se puede explicar en voz alta: cada tendencia trae
   sus temas EN ORDEN de importancia, cada libro trae los suyos, y el puntaje
   es cuanto se cruzan pesando mas los primeros. Nada de azar: el mismo pedido
   devuelve siempre lo mismo, que es lo que permite ensenarlo en una demo.

   Si el motivo no se puede escribir, la recomendacion no sale. Una fila que
   dice "te puede gustar" sin decir por que es un adorno, no una razon. */

const fs = require('fs');
const path = require('path');
const { llano } = require('./fuentes');

const RAIZ = path.join(__dirname, '..');

let LIBROS = null;
function libros() {
  if (!LIBROS) LIBROS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'libros.json'), 'utf8'));
  return LIBROS;
}

/* Peso por posicion en la lista de temas de la tendencia. El primero manda:
   en Romantasy, "romantasy" tiene que pesar mas que "hadas", porque si no un
   libro de hadas sin romance se cuela arriba de Alas de sangre. */
function peso(indice) {
  return 1 / (1 + indice * 0.45);
}

function cruce(libro, tendencia) {
  const temas = tendencia.temas || [];
  const suyos = new Set(libro.temas || []);
  let puntos = 0;
  const coinciden = [];
  temas.forEach((tema, i) => {
    if (suyos.has(tema)) { puntos += peso(i); coinciden.push(tema); }
  });
  const techo = temas.reduce((s, _, i) => s + peso(i), 0);
  return { puntos, coinciden, afinidad: techo ? Math.round((puntos / techo) * 100) : 0 };
}

const RED = { tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram' };

/* El motivo se arma con los temas que de verdad coincidieron, nunca con los
   de la tendencia entera. Si dijera "por dragones" en un libro sin dragones,
   la app estaria mintiendo con buena letra. */
function motivo(coinciden, tendencia) {
  const red = RED[tendencia.fuente] || tendencia.fuente;
  const dos = coinciden.slice(0, 2);
  const por = dos.length === 2 ? dos[0] + ' y ' + dos[1] : (dos[0] || tendencia.titulo.toLowerCase());
  return 'Sale de ' + tendencia.titulo + ' en ' + red + ' por ' + por;
}

/* Devuelve las publicaciones de UNA tendencia, ya ordenadas.
   `excluir` es la lista de ids que ya salieron en el feed, para que la portada
   no repita el mismo libro en dos tarjetas seguidas. */
function porTendencia(tendencia, opciones) {
  const o = opciones || {};
  const fuera = new Set(o.excluir || []);
  const minimo = o.minimo === undefined ? 25 : o.minimo;

  const candidatos = [];
  for (const libro of libros()) {
    if (fuera.has(libro.id)) continue;
    const c = cruce(libro, tendencia);
    if (c.afinidad < minimo || !c.coinciden.length) continue;
    candidatos.push({
      libro,
      tendencia: { id: tendencia.id, titulo: tendencia.titulo, fuente: tendencia.fuente, etiqueta: tendencia.etiqueta },
      afinidad: c.afinidad,
      temas: c.coinciden,
      porque: motivo(c.coinciden, tendencia)
    });
  }

  candidatos.sort((a, b) =>
    b.afinidad - a.afinidad ||
    b.libro.anio - a.libro.anio ||
    a.libro.titulo.localeCompare(b.libro.titulo, 'es'));

  return o.limite ? candidatos.slice(0, o.limite) : candidatos;
}

/* El feed mezclado. Va por rondas: en cada vuelta toma el mejor libro que le
   queda a cada tendencia, empezando por la de mas momento. Asi la primera
   pantalla trae varias redes y no diez tarjetas seguidas de lo mismo, que es
   como se ve un feed de verdad. */
function feed(tendencias, opciones) {
  const o = opciones || {};
  const limite = o.limite || 24;
  const usados = new Set();
  const colas = tendencias.map(t => ({ t, cola: porTendencia(t, { minimo: 30 }) }));
  const salida = [];

  let ronda = 0;
  while (salida.length < limite && ronda < 40) {
    let puso = false;
    for (const c of colas) {
      if (salida.length >= limite) break;
      const siguiente = c.cola.find(p => !usados.has(p.libro.id));
      if (!siguiente) continue;
      usados.add(siguiente.libro.id);
      salida.push(siguiente);
      puso = true;
    }
    if (!puso) break;
    ronda++;
  }
  return salida;
}

/* Buscador por texto sobre titulo, autor y temas. Sin acentos y por partes,
   para que "garcia marquez" y "Márquez" lleguen al mismo libro. */
function buscar(texto) {
  const partes = llano(texto).split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  return libros().filter(l => {
    const heno = llano(l.titulo + ' ' + l.autor + ' ' + (l.temas || []).join(' '));
    return partes.every(p => heno.includes(p));
  }).slice(0, 30);
}

/* Parecidos a uno dado, por temas compartidos. Es lo que sostiene la ficha:
   despues de un libro siempre hay otro, que es el objetivo de la app. */
function parecidos(id, limite) {
  const base = libros().find(l => l.id === id);
  if (!base) return [];
  const suyos = new Set(base.temas || []);
  return libros()
    .filter(l => l.id !== id)
    .map(l => ({ libro: l, comunes: (l.temas || []).filter(t => suyos.has(t)) }))
    .filter(x => x.comunes.length)
    .sort((a, b) => b.comunes.length - a.comunes.length || b.libro.anio - a.libro.anio)
    .slice(0, limite || 6);
}

/* ── el feed de una persona ──────────────────────────────────────────────
   Lo mismo de arriba, pero con el gusto aprendido puesto encima.

   La nota final de un libro se reparte asi:

     60 %  cuanto pega con tus temas, con el peso que traen del uso
     40 %  cuanto pega con la tendencia que mejor lo explica hoy

   El 40 de la tendencia no se quita nunca a proposito. Si mandara solo el
   gusto, a la segunda tarde la pagina seria un espejo: lo mismo de siempre y
   nada de lo que esta sonando. La gracia del producto es que sean las dos.

   Los libros que ya guardaste no vuelven a salir en el feed. Ya son tuyos y
   estan en tu estante. */
function paraTi(tendencias, gusto, opciones) {
  const o = opciones || {};
  const limite = o.limite || 24;
  const pesos = gusto.temas || {};
  const fuera = new Set(o.excluir || []);

  const techo = Math.max(...Object.values(pesos), 1);

  const marcados = [];
  for (const libro of libros()) {
    if (fuera.has(libro.id)) continue;

    /* de tus temas, los que trae este libro */
    const tuyos = (libro.temas || []).filter(t => pesos[t] > 0);
    const crudo = tuyos.reduce((s, t) => s + pesos[t], 0);
    const mio = Math.min(1, crudo / (techo * 1.6));

    /* la tendencia que mejor lo explica hoy, para poder escribir de donde sale */
    let mejor = null;
    for (const t of tendencias) {
      const c = cruce(libro, t);
      if (!c.coinciden.length) continue;
      if (!mejor || c.afinidad > mejor.afinidad) mejor = { t, c };
    }
    if (!mejor && !tuyos.length) continue;

    const dela = mejor ? mejor.c.afinidad / 100 : 0;
    const nota = mio * 0.6 + dela * 0.4;
    if (nota <= 0) continue;

    marcados.push({ libro, tuyos, mio, mejor, nota });
  }

  marcados.sort((a, b) => b.nota - a.nota ||
    b.libro.anio - a.libro.anio ||
    a.libro.titulo.localeCompare(b.libro.titulo, 'es'));

  /* NO MAS DE DOS SEGUIDAS DE LA MISMA TENDENCIA. Sin esta vuelta, en cuanto
     guardas dos libros de romantasy el feed entero es romantasy y la pagina
     deja de ensenarte nada nuevo, que es justo lo contrario de para lo que
     sirve. Se respeta el orden por nota: solo se baja la tercera repetida al
     siguiente hueco libre. */
  const repartidos = [];
  const espera = [];
  let ultima = null, seguidas = 0;

  const cabe = m => {
    const id = m.mejor ? m.mejor.t.id : 'tuyo';
    return !(id === ultima && seguidas >= 2);
  };
  const poner = m => {
    const id = m.mejor ? m.mejor.t.id : 'tuyo';
    seguidas = id === ultima ? seguidas + 1 : 1;
    ultima = id;
    repartidos.push(m);
  };

  for (const m of marcados) {
    if (repartidos.length >= limite) break;
    if (cabe(m)) {
      poner(m);
      /* al cambiar de tendencia, los que se habian quedado esperando vuelven a tener sitio */
      for (let i = 0; i < espera.length && repartidos.length < limite; i++) {
        if (cabe(espera[i])) poner(espera.splice(i--, 1)[0]);
      }
    } else {
      espera.push(m);
    }
  }
  for (const m of espera) { if (repartidos.length >= limite) break; poner(m); }

  return repartidos.map(m => {
    const t = m.mejor ? m.mejor.t : null;
    const dos = m.tuyos.slice(0, 2);
    const porque = dos.length
      ? 'Va contigo por ' + (dos.length === 2 ? dos[0] + ' y ' + dos[1] : dos[0]) +
        (t ? ', y ahora suena en ' + t.titulo : '')
      : motivo(m.mejor.c.coinciden, t);

    return {
      libro: m.libro,
      tendencia: t
        ? { id: t.id, titulo: t.titulo, fuente: t.fuente, etiqueta: t.etiqueta }
        : { id: 'tuyo', titulo: 'Tu gusto', fuente: 'tuyo', etiqueta: '#loTuyo' },
      afinidad: Math.round(m.nota * 100),
      /* Lo que hace que la tarjeta se pueda defender: que temas TUYOS pesaron */
      temas: dos,
      tuyo: Math.round(m.mio * 100),
      porque
    };
  });
}

module.exports = { libros, porTendencia, feed, paraTi, buscar, parecidos, cruce };
