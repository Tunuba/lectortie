# Lo que se midio, para no volver a suponerlo

Fecha de las mediciones, 2026-09-08, desde la maquina de Meme.

## Open Library tarda entre 5.6 y 9.3 segundos

`openlibrary.org/search.json` respondio 200 en 5.6 s con una consulta corta y
en 9.3 s con una larga, y dejo pasar 15 s sin contestar en un tercer intento.

Consecuencias que ya estan en el codigo.

- El tope de `servidor/portadas.js` es de 20 s. Con los 7 s que tenia al
  principio fallaban todas.
- Van de seis en seis. De tres en tres, las doce portadas de una pantalla
  tardaban cuatro vueltas.
- `servidor/traer_portadas.js` reintenta lo que no contesto, porque la mitad de
  los fallos son de una sola vez. Con cuatro vueltas quedaron las 36.

## Las 36 portadas apuntan al libro correcto

Se pidio la busqueda de los 36 y se comparo el titulo que devolvio Open Library
contra el que pide el catalogo. Todas dieron la obra correcta, aunque a veces en
otra edicion o idioma, por ejemplo Norwegian Wood para Tokio blues y Die
unendliche Geschichte para La historia interminable.

La unica que no devolvia nada era Gotico. La consulta decia Mexican Gothic
Silvia Moreno-Garcia y no encontraba portada; con Mexican Gothic a secas
aparecio. Ahi tambien se subio el limite de la busqueda de 3 a 6 resultados.

## El navegador se pegaba con 24 portadas de golpe

Pidiendo las 24 del feed al armar la pagina, Chrome dejo de responder y ni la
captura de pantalla salia. Son 24 imagenes grandes de un servidor lento.

Se arreglo pidiendo la foto cuando la tarjeta se acerca a la pantalla, con un
IntersectionObserver de 600 px de margen, y usando el tamano M en las
miniaturas, que pesa como diez veces menos que la L.

## display flex le gana al atributo hidden

La ficha vacia salia encima del feed al abrir la pagina y el filtro aparecia sin
texto. La causa no era el JavaScript, era el CSS: la regla del navegador para
`[hidden]` es `display:none`, pero `.velo{display:flex}` tiene mas peso y gana.

Sin la linea `[hidden]{display:none !important}`, apagar cosas con `.hidden` no
funciona en ningun elemento que tenga display propio.

## Dos procesos con la misma cache se pisan

`traer_portadas.js` dejo las 36 portadas resueltas y el servidor, que llevaba en
memoria una copia vieja de 6, guardo encima y se comio 11.

El primer intento de arreglo tampoco servia. Decia
`cache = Object.assign(enDisco, cache)`, que apunta la variable a un objeto
nuevo, y las funciones que ya tenian el viejo en la mano seguian escribiendo
ahi: de 36 portadas resueltas se guardaba 1. La mezcla tiene que ser dentro del
mismo objeto.

## En el telefono, buscar no tenia donde escribir

La barra de arriba esconde el campo de busqueda por debajo de 735 px, que es lo
normal. Pero la pestana de la lupa abajo si existe, asi que en el telefono se
llegaba a la pantalla de buscar sin ningun lugar donde teclear.

No lo encontro nadie mirando, lo encontro la prueba al hacer clic en la lupa con
una pantalla de 390 px. Ahora el campo sube a la barra mientras se busca, que es
lo que hace cualquier red social, y la prueba lo comprueba midiendo su ancho.

## El fallo intermitente del estante era la prueba, no la app

Durante un rato el paso de guardar fallaba una vez si y otra no. La causa no
estaba en la app: el navegador de la prueba conservaba el localStorage entre
vueltas, asi que la vuelta siguiente empezaba con el libro ya guardado y el clic
lo quitaba en vez de ponerlo.

Se vio enganchando un apunte a `Storage.setItem` antes de que corriera nada de
la pagina. El apunte mostro una sola escritura, la de quitar, y el boton ya
decia Quitar antes del clic. La prueba ahora limpia el almacenamiento al empezar
y comprueba que arranca vacio, que es lo que faltaba.

## Cobertura de temas

Los 36 libros cubren los temas de las diez tendencias sin dejar ninguno
huerfano, y ninguna tendencia se queda con menos de tres libros por encima del
25 de afinidad.

## La prueba de portadas fallaba por el reloj, no por el codigo

Medido el 2026-09-09. El paso `las portadas reales cargan` daba OK una corrida
y FALLA la siguiente sin haber tocado nada. Media a los 2500 ms fijos despues
de cargar. Las portadas vienen de Open Library por red: con la cache del
navegador caliente llegan en medio segundo y en frio tardan mas, y el Chrome
de las pruebas arranca con perfil nuevo cada vez, o sea siempre en frio.

Ahora espera a que carguen, con tope de 20 s, y mide lo mismo. Una prueba que
da verde o rojo segun lo que tarde la red no esta midiendo el codigo.

## Cuanto tarda en conocerte

Medido el 2026-09-09 con `node pruebas/gusto.js`, que hace clics de verdad.

- Con **5 senales fuertes** la pagina se rearma sin esperar el reloj. En la
  prueba se consiguen tocando 3 publicaciones: dos guardados, un corazon y
  tres fichas abiertas.
- Sin llegar a cinco, se rearma igual **al minuto**, si hay al menos dos.
- Empezo en tres minutos y se bajo a uno a proposito: delante de alguien, tres
  minutos mirando una pagina que todavia no cambia son eternos.
- Ver una tarjeta pasar cuenta 0.35 y no cuenta como senal fuerte. Si contara,
  dejar la pagina abierta sola bastaria para que la app creyera que aprendio.

## El feed tuyo no es el de todos

Misma corrida. Con dos libros de terror y distopia guardados, el feed de todos
empieza con 1984 y el tuyo con Nuestra parte de noche, y de las 24 tarjetas
las 24 traen el motivo escrito con tus temas. Los 2 libros guardados no
aparecen en ninguna: ya estan en tu estante.
