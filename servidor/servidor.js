/* Servidor de LECTORTIE. Node pelado, sin dependencias y sin base de datos.

   Sirve la pagina y expone la API:

     GET /api/tendencias              lo que sube hoy, con su momento
     GET /api/feed?tendencia=id       publicaciones, mezcladas o de una sola
     GET /api/libro?id=               la ficha con los parecidos
     GET /api/libros?ids=a,b,c        varios de un golpe, para el estante
     GET /api/buscar?q=               busqueda por titulo, autor o tema
     GET /api/portadas?ids=a,b,c      portadas de Open Library, aparte
     GET /api/estado                  que fuente esta viva ahora mismo

   Correr:  node servidor/servidor.js   ->  http://localhost:4322

   Lo unico que se guarda en disco es datos/portadas.json, que es cache y se
   puede borrar. Los guardados del usuario viven en su navegador. */

const http = require('http');
const fs = require('fs');
const path = require('path');

require('./entorno');

const fuentes = require('./fuentes');
const motor = require('./recomendar');
const portadas = require('./portadas');
const gusto = require('./gusto');

const PUERTO = Number(process.env.PUERTO || 4322);
const RAIZ = path.join(__dirname, '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};

function json(res, codigo, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store'
  });
  res.end(texto);
}

/* Sirve un archivo de la carpeta del proyecto. La ruta se resuelve y se
   compara contra RAIZ: sin eso, un pedido con .. saca archivos de fuera. */
function estatico(res, ruta) {
  const limpia = decodeURIComponent(ruta.split('?')[0]);
  const destino = path.normalize(path.join(RAIZ, limpia === '/' ? 'index.html' : limpia));
  if (!destino.startsWith(RAIZ)) { res.writeHead(403); return res.end('no'); }

  fs.readFile(destino, (err, datos) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('no esta'); }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(datos);
  });
}

/* Lee el cuerpo de un POST. Tope de 64 kB: aqui solo entran senales de uso,
   y sin tope cualquiera puede tumbar el proceso mandando un archivo. */
function cuerpo(req) {
  return new Promise((listo, mal) => {
    let texto = '';
    req.on('data', trozo => {
      texto += trozo;
      if (texto.length > 65536) { mal(new Error('cuerpo demasiado grande')); req.destroy(); }
    });
    req.on('end', () => {
      try { listo(texto ? JSON.parse(texto) : {}); }
      catch (e) { mal(new Error('el cuerpo no es JSON')); }
    });
    req.on('error', mal);
  });
}

/* Una busqueda no trae temas, trae letras. Los temas se sacan de los libros
   que de verdad salieron: si escribiste murakami, lo que aprende es que te
   interesa lo que esos libros tienen dentro, no la palabra murakami. */
function temasDeBusqueda(texto) {
  const salieron = motor.buscar(texto).slice(0, 6);
  const cuenta = {};
  for (const l of salieron) for (const t of l.temas || []) cuenta[t] = (cuenta[t] || 0) + 1;
  return Object.entries(cuenta)
    .filter(([, n]) => n >= Math.min(2, salieron.length))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    if (p === '/api/tendencias') {
      const r = await fuentes.conMomento();
      return json(res, 200, r);
    }

    if (p === '/api/feed') {
      const r = await fuentes.conMomento();
      const pedida = url.searchParams.get('tendencia');
      const limite = Math.min(48, Math.max(1, Number(url.searchParams.get('limite')) || 24));

      if (pedida && pedida !== 'todas') {
        const t = r.tendencias.find(x => x.id === pedida);
        if (!t) return json(res, 404, { error: 'esa tendencia no existe' });
        return json(res, 200, {
          origen: r.origen, tendencia: t,
          publicaciones: motor.porTendencia(t, { limite, minimo: 25 })
        });
      }

      /* ?para=yo arma el feed con lo aprendido. Si todavia no hay con que,
         no se inventa nada: devuelve el feed normal y lo dice en `para`,
         para que la pantalla no presuma de conocerte antes de tiempo. */
      if (url.searchParams.get('para') === 'yo') {
        const perfil = gusto.perfil();
        if (perfil.listo) {
          /* Cada vez que se sirve la pagina armada, el ciclo avanza una
             vuelta y con ella cambia la variante del fondo. */
          gusto.vuelta();
          perfil.variante = gusto.perfil().variante;
          return json(res, 200, {
            origen: r.origen, tendencia: null, para: 'yo', perfil,
            variante: perfil.variante,
            publicaciones: motor.paraTi(r.tendencias, { temas: gusto.temas() },
              { limite, excluir: perfil.guardados })
          });
        }
        return json(res, 200, {
          origen: r.origen, tendencia: null, para: 'todavia-no', perfil,
          publicaciones: motor.feed(r.tendencias, { limite })
        });
      }

      return json(res, 200, {
        origen: r.origen, tendencia: null, para: 'todos',
        publicaciones: motor.feed(r.tendencias, { limite })
      });
    }

    if (p === '/api/libro') {
      const id = url.searchParams.get('id');
      const libro = motor.libros().find(l => l.id === id);
      if (!libro) return json(res, 404, { error: 'ese libro no esta' });
      return json(res, 200, { libro, parecidos: motor.parecidos(id, 6).map(x => x.libro) });
    }

    /* El estante manda sus ids de una sola vez. Con /api/libro seria una
       llamada por libro guardado, y ahi el estante de veinte tarda veinte
       viajes en pintarse. */
    if (p === '/api/libros') {
      const ids = (url.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
      const orden = new Map(ids.map((id, i) => [id, i]));
      const lista = motor.libros().filter(l => orden.has(l.id))
        .sort((a, b) => orden.get(a.id) - orden.get(b.id));
      return json(res, 200, { libros: lista });
    }

    if (p === '/api/buscar') {
      return json(res, 200, { libros: motor.buscar(url.searchParams.get('q') || '') });
    }

    if (p === '/api/portadas') {
      const ids = (url.searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
      const lista = motor.libros().filter(l => ids.includes(l.id));
      const tamano = url.searchParams.get('tam') === 'M' ? 'M' : 'L';
      return json(res, 200, { portadas: await portadas.varias(lista, tamano) });
    }

    if (p === '/api/estado') {
      const r = await fuentes.conMomento();
      return json(res, 200, {
        youtube: r.origen === 'vivo' ? 'en vivo, ' + r.detalle : 'respaldo, ' + r.detalle,
        tiktok: 'muestra guardada, la API publica no da tendencias del pais',
        instagram: 'muestra guardada, la API publica no da tendencias del pais',
        openlibrary: 'en vivo para portadas, sin llave',
        libros: motor.libros().length,
        tendencias: r.tendencias.length
      });
    }

    /* ── el gusto de esta computadora ─────────────────────────────────────
       No hay cuentas: el usuario es esta maquina. Por eso no viaja ningun
       identificador y no hace falta ninguno. */
    if (p === '/api/gusto' && req.method === 'POST') {
      const c = await cuerpo(req);
      const senales = Array.isArray(c.senales) ? c.senales.slice(0, 40) : [];
      const r = await fuentes.conMomento();
      let puestas = 0;

      for (const s of senales) {
        const libro = s.libro ? motor.libros().find(l => l.id === s.libro) : null;
        const tendencia = s.tendencia ? r.tendencias.find(t => t.id === s.tendencia) : null;
        if (s.que === 'buscar') s.temas = temasDeBusqueda(s.texto || '');
        if (gusto.anotar(s, libro, tendencia)) puestas++;
      }

      return json(res, 200, { puestas, perfil: gusto.perfil() });
    }

    if (p === '/api/perfil') return json(res, 200, gusto.perfil());

    if (p === '/api/olvidar' && req.method === 'POST') {
      return json(res, 200, { olvidado: true, perfil: gusto.olvidar() });
    }

    if (p.startsWith('/api/')) return json(res, 404, { error: 'esa ruta no existe' });

    return estatico(res, p);
  } catch (e) {
    return json(res, 500, { error: String(e && e.message || e) });
  }
});

servidor.listen(PUERTO, () => {
  const r = motor.libros().length;
  const t = fuentes.tendencias().length;
  console.log('');
  console.log('  LECTORTIE');
  console.log('  http://localhost:' + PUERTO);
  console.log('');
  console.log('  ' + t + ' tendencias y ' + r + ' libros cargados');
  console.log('  momento de YouTube ' + (process.env.YOUTUBE_API_KEY
    ? 'en vivo, region ' + (process.env.REGION || 'GT')
    : 'apagado, va con el respaldo. Para prenderlo, YOUTUBE_API_KEY'));
  console.log('  portadas de Open Library en vivo, cache en datos/portadas.json');
  console.log('');
});
