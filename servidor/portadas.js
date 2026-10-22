/* Portadas reales desde Open Library.

   Open Library es la unica de las APIs del proyecto que no pide llave ni
   aprobacion, asi que aqui si hay dato en vivo de verdad.

   LO QUE SE GUARDA ES EL NUMERO, NO LA DIRECCION
   Open Library sirve la misma portada en tres tamanos con solo cambiar una
   letra al final. Guardando el numero, la tarjeta grande del feed pide la L y
   las miniaturas del estante piden la M, que pesa como diez veces menos. Con
   la direccion completa guardada habia que cortarla con tijera cada vez.

   CUATRO DECISIONES QUE NO SON ADORNO
   1. Se piden APARTE del feed. El feed sale al instante con la portada
      dibujada y las fotos entran despues. Si Open Library esta lenta o el wifi
      del salon no da, la pantalla ya se vio.
   2. Lo que vuelve se guarda en datos/portadas.json. No es base de datos: es
      cache y se puede borrar sin perder nada. Sirve para que la demo funcione
      sin internet la segunda vez, que es justo cuando se ensena.
   3. Lo que NO tiene portada tambien se guarda, con null. Sin eso la app le
      vuelve a preguntar por los mismos libros en cada carga y espera el mismo
      silencio.
   4. Antes de escribir se relee el archivo y se mezcla. Paso de verdad el
      2026-09-08: traer_portadas.js dejo las 36 resueltas y el servidor, que
      llevaba en memoria una copia vieja de 6, guardo encima y se comio 11.
      Dos procesos con el mismo archivo y sin mezclar es siempre eso. */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ARCHIVO = path.join(RAIZ, 'datos', 'portadas.json');
const TOPE_MS = Number(process.env.TOPE_PORTADAS || 20000);

let cache = null;
let guardadoPendiente = null;

function leerArchivo() {
  try { return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); }
  catch (e) { return {}; }
}

function cargar() {
  if (!cache) cache = leerArchivo();
  return cache;
}

/* El guardado se junta: al resolver doce portadas de un feed no tiene sentido
   escribir el archivo doce veces. */
function guardar() {
  if (guardadoPendiente) return;
  guardadoPendiente = setTimeout(() => {
    guardadoPendiente = null;
    try {
      /* Se mezcla DENTRO del mismo objeto, no creando otro. Con
         `cache = Object.assign(enDisco, cache)` la variable apuntaba a un
         objeto nuevo y las funciones que ya tenian el viejo en la mano seguian
         escribiendo ahi: de 36 portadas resueltas solo se guardaba 1. Lo de
         disco entra unicamente donde no hay nada, porque lo nuestro es lo
         recien preguntado. */
      const enDisco = leerArchivo();
      for (const k in enDisco) if (!(k in cache)) cache[k] = enDisco[k];
      fs.writeFileSync(ARCHIVO, JSON.stringify(cache, null, 2));
    } catch (e) { /* si no se puede escribir, la cache vive en memoria y ya */ }
  }, 400);
  if (guardadoPendiente.unref) guardadoPendiente.unref();
}

function direccion(numero, tamano) {
  if (!numero) return null;
  const t = tamano === 'M' ? 'M' : 'L';
  return 'https://covers.openlibrary.org/b/id/' + numero + '-' + t + '.jpg';
}

async function pedirOpenLibrary(consulta) {
  const url = 'https://openlibrary.org/search.json?limit=6&fields=cover_i,title,author_name&q=' +
    encodeURIComponent(consulta);
  const r = await fetch(url, {
    signal: AbortSignal.timeout(TOPE_MS),
    headers: { 'User-Agent': 'LECTORTIE demo academica' }
  });
  if (!r.ok) throw new Error('Open Library respondio ' + r.status);
  const j = await r.json();
  const docs = Array.isArray(j.docs) ? j.docs : [];
  const con = docs.find(d => d && d.cover_i);
  return con ? con.cover_i : null;
}

/* Resuelve una sola portada. `estado` distingue las tres cosas que no son lo
   mismo: ya se sabia, se pregunto y no hay, y no se pudo preguntar. La tercera
   se reintenta la proxima vez; la segunda no. */
async function una(libro, tamano) {
  const c = cargar();
  if (Object.prototype.hasOwnProperty.call(c, libro.id)) {
    return { url: direccion(c[libro.id], tamano), estado: c[libro.id] ? 'cache' : 'sin portada' };
  }
  try {
    const numero = await pedirOpenLibrary(libro.consulta || (libro.titulo + ' ' + libro.autor));
    c[libro.id] = numero;
    guardar();
    return { url: direccion(numero, tamano), estado: numero ? 'vivo' : 'sin portada' };
  } catch (e) {
    return { url: null, estado: 'sin red' };
  }
}

/* Varias a la vez, de seis en seis.

   MEDIDO EL 2026-09-08, no supuesto: una consulta a openlibrary.org/search.json
   desde aqui tarda entre 5.6 y 9.3 segundos. Por eso el tope es de 20 s y no de
   7 (con 7 fallaban TODAS) y por eso van de seis en seis: de tres en tres, las
   doce portadas de una pantalla tardaban cuatro vueltas. Pedirle treinta a la
   vez a una API publica y gratis es otra cosa, y encima sale mas lento cuando
   ella empieza a cortar. */
async function varias(lista, tamano) {
  const salida = {};
  for (let i = 0; i < lista.length; i += 6) {
    const grupo = lista.slice(i, i + 6);
    const r = await Promise.all(grupo.map(l => una(l, tamano)));
    grupo.forEach((l, k) => { salida[l.id] = r[k]; });
  }
  return salida;
}

module.exports = { una, varias };
