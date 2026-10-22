/* Lee el .env de la raiz y lo mete en process.env, sin dependencias.

   Se carga ANTES que fuentes.js, porque ese archivo lee la llave al cargarse
   y si llega tarde el momento sale con el respaldo aunque el .env este bien.

   El .env NUNCA se sube. Lo que se sube es .env.example con la palabra
   cambiame dentro. Aqui no hay valor por defecto para la llave a proposito:
   un default tapa el error y ademas queda publicado. */

const fs = require('fs');
const path = require('path');

const ARCHIVO = path.join(__dirname, '..', '.env');

if (fs.existsSync(ARCHIVO)) {
  for (const linea of fs.readFileSync(ARCHIVO, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte < 1) continue;
    const nombre = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();
    if (/^".*"$/.test(valor) || /^'.*'$/.test(valor)) valor = valor.slice(1, -1);
    if (process.env[nombre] === undefined) process.env[nombre] = valor;
  }
}
