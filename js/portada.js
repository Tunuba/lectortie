/* La portada de un libro, en dos capas.

   ABAJO va una portada dibujada con el tono que trae el libro. Se pinta al
   instante, sin red y sin esperar a nadie.
   ARRIBA, si Open Library tiene la foto, entra encima con un fundido.

   Por que asi y no un cuadro gris con un spinner: en una demo el feed se ve
   completo desde el primer segundo, y si el wifi no da, nadie se entera. Un
   cuadro gris se ve roto; una portada dibujada se ve a proposito.

   LA FOTO SE PIDE CUANDO LA TARJETA SE ACERCA A LA PANTALLA, no al armarla.
   Medido el 2026-09-08: pidiendo las 24 de golpe el navegador se quedaba
   pegado y ni la captura de pantalla respondia, porque son 24 imagenes
   grandes de un servidor lento. Con el observador entran de a dos o tres,
   que son las que de verdad se estan viendo. */

(function (raiz) {

  /* Las fotos que ya volvieron, para no volver a pedirlas al cambiar de vista.
     Vive en la pestana, no en disco: el servidor ya tiene su propia cache. */
  const sabidas = new Map();

  const mirador = 'IntersectionObserver' in raiz
    ? new IntersectionObserver(entradas => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          mirador.unobserve(e.target);
          const traer = e.target._traerFoto;
          if (traer) traer();
        }
      }, { rootMargin: '600px 0px' })
    : null;

  function tapa(libro) {
    const h = Number(libro.tono) || 250;
    const caja = document.createElement('div');
    caja.className = 'portada';
    caja.style.background =
      'linear-gradient(150deg, hsl(' + h + ' 58% 44%), hsl(' + ((h + 22) % 360) + ' 54% 24%))';

    const autor = document.createElement('i');
    autor.textContent = libro.autor;

    const titulo = document.createElement('b');
    titulo.textContent = libro.titulo;

    const anio = document.createElement('em');
    anio.textContent = libro.anio;

    caja.append(autor, titulo, anio);
    return caja;
  }

  /* Las fotos viven junto a la pagina, en img/portadas, ya achicadas. Antes
     se pedian a Open Library en cada visita y en el wifi de un salon tardaban
     hasta nueve segundos. Si una falta, se queda la portada dibujada. */
  function pedirFoto(libro, tamano, alLlegar) {
    if (sabidas.has(libro.id)) { alLlegar(sabidas.get(libro.id)); return; }
    const url = 'img/portadas/' + libro.id + '.jpg';
    sabidas.set(libro.id, url);
    alLlegar(url);
  }

  /* Arma la portada dentro de un contenedor ya posicionado.
     `tamano` es L para la tarjeta grande del feed y M para las miniaturas. */
  function pintar(contenedor, libro, tamano) {
    const caja = tapa(libro);
    contenedor.appendChild(caja);

    const traer = () => pedirFoto(libro, tamano === 'M' ? 'M' : 'L', url => {
      if (!url) return;
      const foto = new Image();
      foto.className = 'foto';
      foto.alt = 'Portada de ' + libro.titulo;
      foto.decoding = 'async';
      foto.onload = () => {
        /* El fondo es la MISMA direccion, asi que sale del cache del navegador
           y no cuesta un segundo viaje. */
        const fondo = new Image();
        fondo.className = 'fondo';
        fondo.alt = '';
        fondo.setAttribute('aria-hidden', 'true');
        fondo.src = url;

        caja.append(fondo, foto);
        caja.classList.add('con-foto');
        requestAnimationFrame(() => {
          foto.classList.add('puesta');
          fondo.classList.add('puesta');
        });
      };
      foto.src = url;
    });

    if (mirador) { contenedor._traerFoto = traer; mirador.observe(contenedor); }
    else traer();

    return caja;
  }

  raiz.Portada = { pintar, tapa };

})(window);
