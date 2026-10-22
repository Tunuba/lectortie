/* De donde sale el "que se esta viendo" de LECTORTIE.

   LO QUE HAY QUE SABER ANTES DE TOCAR ESTE ARCHIVO
   ------------------------------------------------
   De las tres redes que nombra la idea, HOY solo una se puede consultar
   con una llave que uno saca solo:

     · YouTube  -> Data API v3, llave gratis desde Google Cloud. SI se llama.
     · TikTok   -> la Research API pide cuenta de investigador aprobada y la
                   Display API solo devuelve videos del propio usuario que
                   autoriza. No sirve para medir que sube en el pais.
     · Instagram-> la Graph API solo entrega datos de la cuenta que autoriza
                   y de hashtags con permisos de negocio revisados por Meta.

   Por eso las diez tendencias viven en datos/tendencias.json con su etiqueta
   de red, y lo que YouTube aporta cuando hay llave es el MOMENTO: cuanto pesa
   hoy cada tendencia en lo mas visto. Sin llave el momento sale del respaldo.

   La pantalla NUNCA dice que midio algo que no midio: cada respuesta trae
   `origen` y `medidas`, y la interfaz pinta un punto distinto para cada caso.
   La senal en vivo es un extra, nunca un requisito. */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const LLAVE = process.env.YOUTUBE_API_KEY || '';
const REGION = process.env.REGION || 'GT';
const TOPE_MS = Number(process.env.TOPE_FUENTES || 6000);

/* Cada cuanto se vuelve a preguntarle a YouTube. Lo mas visto no cambia en
   segundos y la llave gratis trae cuota diaria: pedirlo en cada recarga de la
   pagina la quema en una tarde de pruebas. */
const VIGENCIA_MS = 10 * 60 * 1000;

let cache = { cuando: 0, senales: null, origen: 'respaldo', detalle: '' };

function tendencias() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'tendencias.json'), 'utf8'));
}

/* Quita acentos y baja a minusculas para que "distopía" y "DISTOPIA" cuenten
   como la misma palabra al cruzar titulos con claves. */
function llano(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function pedirYoutube() {
  const url = 'https://www.googleapis.com/youtube/v3/videos' +
    '?part=snippet&chart=mostPopular&maxResults=50' +
    '&regionCode=' + encodeURIComponent(REGION) +
    '&key=' + encodeURIComponent(LLAVE);

  const corte = AbortSignal.timeout(TOPE_MS);
  const r = await fetch(url, { signal: corte });
  if (!r.ok) throw new Error('YouTube respondio ' + r.status);
  const j = await r.json();
  const items = Array.isArray(j.items) ? j.items : [];
  return items.map(v => llano(
    (v.snippet && v.snippet.title || '') + ' ' +
    (v.snippet && v.snippet.description || '').slice(0, 300) + ' ' +
    ((v.snippet && v.snippet.tags || []).join(' '))
  ));
}

/* Cuenta en cuantos de los videos mas vistos aparece alguna clave de la
   tendencia. Devuelve 0..1. Cuenta VIDEOS, no apariciones: un solo video que
   repite "dragon" ocho veces no vale por ocho. */
function medirSenal(textos, claves) {
  if (!textos.length) return 0;
  const pistas = claves.map(llano);
  let tocados = 0;
  for (const t of textos) if (pistas.some(p => t.includes(p))) tocados++;
  return tocados / textos.length;
}

/* El momento es lo que ordena el feed. Sin senal en vivo es la subida guardada
   (0..100). Con senal, la subida guardada pesa 60 y lo medido hoy pesa 40: asi
   una tendencia real no desaparece porque hoy no salio en lo mas visto, y una
   que si esta subiendo se nota. */
function momento(t, senal) {
  const base = Math.max(0, Math.min(100, Number(t.subida) || 0));
  if (senal === null || senal === undefined) return Math.round(base);
  return Math.round(base * 0.6 + Math.min(1, senal * 4) * 100 * 0.4);
}

async function conMomento() {
  const lista = tendencias();
  const ahora = Date.now();

  if (!cache.senales || ahora - cache.cuando > VIGENCIA_MS) {
    if (!LLAVE) {
      cache = { cuando: ahora, senales: null, origen: 'respaldo', detalle: 'sin YOUTUBE_API_KEY' };
    } else {
      try {
        const textos = await pedirYoutube();
        const senales = {};
        for (const t of lista) senales[t.id] = medirSenal(textos, t.claves || []);
        cache = {
          cuando: ahora, senales, origen: 'vivo',
          detalle: textos.length + ' videos de ' + REGION
        };
      } catch (e) {
        cache = {
          cuando: ahora, senales: null, origen: 'respaldo',
          detalle: String(e && e.message || e).slice(0, 120)
        };
      }
    }
  }

  const senales = cache.senales;
  const conjunto = lista.map(t => ({
    ...t,
    momento: momento(t, senales ? senales[t.id] : null),
    medida: senales ? 'vivo' : 'respaldo'
  }));
  conjunto.sort((a, b) => b.momento - a.momento);

  return { origen: cache.origen, detalle: cache.detalle, tendencias: conjunto };
}

module.exports = { conMomento, tendencias, llano };
