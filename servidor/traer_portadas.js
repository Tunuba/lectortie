/* Precalienta datos/portadas.json con las portadas de todos los libros.

   Por que existe. Medido el 2026-09-08, una consulta a openlibrary.org tarda
   entre 5 y 9 segundos y a veces no contesta. Con el servidor recien clonado,
   las primeras pantallas salen con la portada dibujada y las fotos van
   llegando de a poco. Eso esta bien para el uso normal y esta mal para una
   demo, que es cuando todos miran.

   Se corre una vez y despues el repo lleva las portadas resueltas:

       node servidor/traer_portadas.js

   Reintenta lo que no contesto, porque la mitad de los fallos de esta API son
   de una sola vez. Lo que responde sin portada NO se reintenta: eso no es un
   fallo, es la respuesta. */

const portadas = require('./portadas');
const { libros } = require('./recomendar');

const VUELTAS = Number(process.env.VUELTAS || 4);

async function main() {
  let faltan = libros();

  for (let vuelta = 1; vuelta <= VUELTAS && faltan.length; vuelta++) {
    console.log('vuelta ' + vuelta + ' con ' + faltan.length + ' libros');
    const r = await portadas.varias(faltan);

    const siguen = [];
    for (const l of faltan) {
      const e = r[l.id] || {};
      if (e.estado === 'sin red') siguen.push(l);
      else console.log('  ' + (e.url ? 'ok  ' : 'sin ') + l.titulo);
    }
    faltan = siguen;
  }

  const total = libros().length;
  console.log('');
  console.log('resueltas ' + (total - faltan.length) + ' de ' + total);
  if (faltan.length) console.log('sin respuesta ' + faltan.map(l => l.titulo).join(', '));
  /* El guardado del cache va con un timer corto; se le da su turno. */
  setTimeout(() => process.exit(0), 900);
}

main();
