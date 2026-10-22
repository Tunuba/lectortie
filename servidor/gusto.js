/* EL GUSTO: lo que LECTORTIE aprende de como usas la app.

   POR QUE EXISTE ESTE ARCHIVO
   ---------------------------
   La idea del curso es que un producto pueda ofrecer algo distinto a cada
   persona usando los datos que ya tiene, sin cambiar su sistema. Aqui no hay
   extension ni pieza pegada por fuera: esto vive dentro del proyecto, como
   una API que la empresa ya tiene integrada.

   COMO APRENDE, DICHO EN VOZ ALTA
   -------------------------------
   Cada cosa que haces vale distinto. Guardar un libro pesa mucho mas que
   pasar por delante de el, porque guardar cuesta y mirar no.

     guardar   5     corazon  3     abrir  2     buscar  2     ver  0.35
     quitar   -5     desquerer -3

   Ese peso se reparte entre los temas del libro, su tendencia y su red. Lo
   que sale es un perfil de temas, nada mas. No se guarda quien eres, porque
   no hay cuentas: aqui el usuario es esta computadora y ya.

   LO QUE NUNCA HACE
   -----------------
   Recomendar sin poder decir por que. El perfil guarda los libros que
   disparon cada peso para que la pantalla pueda escribir la razon con
   nombre y apellido: "porque guardaste Alas de sangre". Una fila que dice
   "para ti" sin decir de donde salio es un adorno, no una razon.

   Se guarda en datos/gusto.json, que es de esta maquina y se puede borrar
   entero desde la propia app con el boton de olvidar. */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ARCHIVO = path.join(RAIZ, 'datos', 'gusto.json');

/* APRENDER=0 apaga esto entero: no anota, no guarda y no vuelve a armar la
   pagina. Existe por dos motivos de verdad, no para las pruebas. Uno, poder
   ensenar la app sin que aprenda de quien la esta probando. Dos, que el
   recorrido de pruebas mida la pagina de todos sin que sus propios clics la
   rearmen a media prueba. Que ademas sirva para eso es suerte, no el motivo. */
const APRENDE = process.env.APRENDER !== '0';

const PESOS = { guardar: 5, corazon: 3, abrir: 2, buscar: 2, ver: 0.35, quitar: -5, desquerer: -3 };

/* Las que cuentan para decir que ya te conoce. Ver no cuenta: si contara,
   dejar la pagina abierta sola bastaria para "aprender" algo. */
const FUERTES = new Set(['guardar', 'corazon', 'abrir', 'buscar']);

/* Cuando se considera que ya hay con que armar una pagina. Dos caminos, y la
   pantalla dice en cual va: cinco senales fuertes, o tres minutos de uso con
   al menos dos. El segundo existe para que una demo corta no se quede sin
   ensenar nada. */
const SUFICIENTES = 5;
/* Un minuto y no tres. Medido delante de alguien, tres minutos mirando una
   pagina que todavia no cambia son eternos, y la gracia hay que ensenarla
   antes de que el otro se aburra. */
const PACIENCIA_MS = 60 * 1000;
const MINIMO_POR_TIEMPO = 2;

function vacio() {
  return { desde: 0, ultimo: 0, senales: 0, fuertes: 0, vueltas: 0,
           temas: {}, redes: {}, tendencias: {}, libros: {}, busquedas: [] };
}

/* Cuantas variantes de fondo tiene cada piel. Cada vez que la pagina se
   rearma pasa a la siguiente, aunque tu gusto sea exactamente el mismo: si
   dos rearmes seguidos se vieran identicos, el ciclo no se notaria y la
   pagina pareceria estancada. */
const VARIANTES = 4;

let memoria = null;

function leer() {
  if (memoria) return memoria;
  try {
    memoria = Object.assign(vacio(), JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')));
  } catch (e) {
    memoria = vacio();
  }
  return memoria;
}

/* Se escribe entero y de una vez. Son unos pocos kilobytes de una sola
   maquina: no hace falta nada mas, y asi el archivo nunca queda a medias. */
function guardar() {
  fs.writeFileSync(ARCHIVO, JSON.stringify(memoria, null, 2));
}

function sumar(mapa, llave, cuanto) {
  if (!llave) return;
  mapa[llave] = Math.max(0, Math.round(((mapa[llave] || 0) + cuanto) * 100) / 100);
}

/* Una senal entra con el tipo, el libro y la tendencia desde donde se hizo.
   `libro` llega completo para poder repartir el peso entre sus temas sin
   volver a buscarlo. */
function anotar(senal, libro, tendencia) {
  if (!APRENDE) return false;
  const g = leer();
  const peso = PESOS[senal.que];
  if (peso === undefined) return false;

  const ahora = Date.now();
  if (!g.desde) g.desde = ahora;
  g.ultimo = ahora;
  g.senales++;
  if (FUERTES.has(senal.que)) g.fuertes++;

  if (senal.que === 'buscar') {
    const texto = String(senal.texto || '').trim().slice(0, 60);
    if (texto) {
      g.busquedas = [texto].concat(g.busquedas.filter(b => b !== texto)).slice(0, 12);
      for (const tema of senal.temas || []) sumar(g.temas, tema, peso);
    }
    guardar();
    return true;
  }

  if (libro) {
    for (const tema of libro.temas || []) sumar(g.temas, tema, peso);

    if (peso > 0) {
      const antes = g.libros[libro.id];
      /* Se queda el gesto que mas pesa. Si guardaste un libro, que despues lo
         abras otra vez no lo baja a "abierto". */
      if (!antes || antes.peso < peso) {
        g.libros[libro.id] = { peso, que: senal.que, titulo: libro.titulo, cuando: ahora };
      }
    } else {
      delete g.libros[libro.id];
    }
  }

  if (tendencia) {
    sumar(g.tendencias, tendencia.id, peso);
    sumar(g.redes, tendencia.fuente, peso);
  }

  guardar();
  return true;
}

/* ── la piel ─────────────────────────────────────────────────────────────
   Que aspecto toma la pagina entera segun lo que lees. Cada familia junta
   los temas que de verdad conviven en un mismo tipo de lectura, y gana la
   que mas peso acumule. No es una etiqueta puesta a mano por libro: sale de
   los mismos temas con los que ya se recomienda, asi que no hay una segunda
   verdad que mantener.

   Sin peso suficiente no hay piel. La pagina de todos se queda como esta:
   presumir de conocerte con dos clics seria justo lo que no queremos. */
const PIELES = {
  romantasy: { nombre: 'Romantasy', temas: ['romantasy', 'romance', 'fantasia', 'hadas', 'dragones', 'magia'] },
  terror:    { nombre: 'Terror',    temas: ['terror', 'gotico', 'misterio', 'intriga', 'cuentos'] },
  distopia:  { nombre: 'Distopia',  temas: ['distopia', 'ciencia ficcion', 'vigilancia', 'inteligencia artificial'] },
  arcade:    { nombre: 'Arcade',    temas: ['videojuegos', 'ochentas', 'tecnologia', 'aventura'] },
  calma:     { nombre: 'Calma',     temas: ['salud mental', 'sentido', 'superacion', 'habitos'] },
  espacio:   { nombre: 'Espacio',   temas: ['espacio', 'ciencia', 'supervivencia'] },
  academia:  { nombre: 'Academia',  temas: ['academia', 'clasico', 'tragedia', 'mitologia', 'historia'] },
  selva:     { nombre: 'Selva',     temas: ['latinoamerica', 'realismo magico', 'familia'] }
};

/* Hace falta algo mas que un toque suelto para cambiarle la cara a la app. */
const PARA_VESTIR = 6;

function piel(g) {
  let mejor = null;
  for (const [id, p] of Object.entries(PIELES)) {
    const suma = p.temas.reduce((s, t) => s + (g.temas[t] || 0), 0);
    if (!mejor || suma > mejor.suma) mejor = { id, nombre: p.nombre, suma };
  }
  if (!mejor || mejor.suma < PARA_VESTIR) return { id: 'noche', nombre: 'La de todos', suma: mejor ? mejor.suma : 0 };
  return mejor;
}

function ordenado(mapa) {
  return Object.entries(mapa)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
}

function listo(g) {
  if (!APRENDE) return false;
  if (g.fuertes >= SUFICIENTES) return true;
  return g.fuertes >= MINIMO_POR_TIEMPO && g.desde > 0 && (Date.now() - g.desde) >= PACIENCIA_MS;
}

/* La frase que la pantalla enseña. Se arma con lo que de verdad hiciste, con
   el titulo del libro cuando lo hay. Si no alcanza para escribirla, no se
   escribe: devuelve cadena vacia y la pantalla dice que sigue mirando. */
function porque(g) {
  const temas = ordenado(g.temas).slice(0, 2).map(x => x[0]);
  if (!temas.length) return '';

  const gestos = Object.values(g.libros).sort((a, b) => b.peso - a.peso || b.cuando - a.cuando);
  const guardados = gestos.filter(x => x.que === 'guardar').slice(0, 2);
  const queridos = gestos.filter(x => x.que === 'corazon').slice(0, 2);

  const partes = [];
  if (guardados.length) partes.push('guardaste ' + guardados.map(x => x.titulo).join(' y '));
  if (queridos.length) partes.push('te gusto ' + queridos.map(x => x.titulo).join(' y '));
  if (!partes.length && gestos.length) partes.push('abriste ' + gestos.slice(0, 2).map(x => x.titulo).join(' y '));
  if (!partes.length && g.busquedas.length) partes.push('buscaste ' + g.busquedas[0]);
  if (!partes.length) return '';

  const cola = temas.length === 2 ? temas[0] + ' y ' + temas[1] : temas[0];
  return 'Porque ' + partes.join(', y ') + ', arriba va ' + cola + '.';
}

function perfil() {
  const g = leer();
  const temas = ordenado(g.temas);
  const redes = ordenado(g.redes);
  const vestido = piel(g);

  return {
    listo: listo(g),
    /* La piel de la pagina entera. La pantalla la pone en el html y el CSS
       hace el resto. */
    piel: vestido.id,
    pielNombre: vestido.nombre,
    variante: (g.vueltas || 0) % VARIANTES,
    vueltas: g.vueltas || 0,
    senales: g.senales,
    fuertes: g.fuertes,
    faltan: Math.max(0, SUFICIENTES - g.fuertes),
    /* Segundos que lleva mirando, para que la pantalla pueda decir en cual de
       los dos caminos va sin inventarse la cuenta. */
    segundos: g.desde ? Math.round((Date.now() - g.desde) / 1000) : 0,
    paciencia: Math.round(PACIENCIA_MS / 1000),
    temas: temas.slice(0, 6).map(([tema, peso]) => ({ tema, peso })),
    red: redes.length ? redes[0][0] : null,
    tendencias: ordenado(g.tendencias).slice(0, 3).map(([id, peso]) => ({ id, peso })),
    guardados: Object.entries(g.libros).filter(([, x]) => x.que === 'guardar').map(([id]) => id),
    busquedas: g.busquedas.slice(0, 3),
    porque: porque(g)
  };
}

/* Una vuelta mas del ciclo. La llama el servidor cada vez que sirve la
   pagina armada, que es exactamente una vez por rearme. */
function vuelta() {
  const g = leer();
  g.vueltas = (g.vueltas || 0) + 1;
  guardar();
  return g.vueltas;
}

/* Olvidar de verdad: borra el archivo y la memoria. En una demo hay que poder
   volver a empezar delante de la gente. */
function olvidar() {
  memoria = vacio();
  try { fs.unlinkSync(ARCHIVO); } catch (e) { /* no estaba, ya esta olvidado */ }
  return perfil();
}

/* El mapa de temas crudo, que es lo que usa el motor para ordenar. */
function temas() {
  return Object.assign({}, leer().temas);
}

module.exports = { anotar, perfil, olvidar, temas, leer, vuelta, PESOS, PIELES, VARIANTES };
