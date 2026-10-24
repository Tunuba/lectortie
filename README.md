# lectortie

Leer también puede ser adictivo. lectortie toma lo que está sonando en TikTok, YouTube e
Instagram y lo convierte en una ruta de libros para gente joven, de lo fácil a los grandes
clásicos. Se ve y se usa como una red social.

En vivo en https://tunuba.github.io/lectortie/

## Como se corre

Es una página estática. No hay que instalar nada ni levantar base de datos.

    python -m http.server 8000

Y abrir http://localhost:8000 . Abierta con doble clic no carga, porque el navegador no deja
leer los archivos de datos sin servidor. También sirve `node servidor/servidor.js`, que abre en
el 4322.

## Que trae

- **La entrada.** Quien entra elige qué ve en redes y cuánto lee. Con eso se arma su ruta.
- **Inicio.** Las tendencias son las historias de arriba y cada publicación es un libro que
  sale de una tendencia, con el motivo escrito. Arriba va el libro que toca leer y la racha.
- **Deslizar.** El mismo gesto de TikTok, pero cada video termina en un libro. Cada cinco
  deslizones sale una pausa con los cinco libros que acabas de pasar; tocas el que se te quedó
  y lees cinco minutos de ese.
- **Ruta.** Siete libros por niveles. Arriba siempre espera El conde de Montecristo.
- **Sesión de lectura.** Un reloj con meta de cinco minutos. Al terminar se anotan las páginas,
  se prende la racha y se sube en el ranking. El patito feo, La metamorfosis y El conde de
  Montecristo traen un fragmento para leer ahí mismo, traducido del original de dominio público.
- **Comunidad.** Racha de la semana, ranking, promedio de páginas al día, amigos, clubes y lo
  que pasa ahora mismo.
- **Conseguirlo.** Apartar el libro en una librería aliada o pedirlo en una biblioteca. Es el
  modelo de negocio, la comisión por libro vendido. En la demo no se cobra nada.
- **La página cambia contigo.** Con cinco gestos fuertes (guardar, corazón, abrir, buscar,
  leer) la app se rearma con tu gusto y se pone una piel completa, Romantasy, Terror, Distopía,
  Calma, Espacio, Academia, Selva o Arcade.

- **Cuentos completos gratis.** El almohadón de pluma y A la deriva de Quiroga, Los ojos
  verdes y El monte de las ánimas de Bécquer, y El rey burgués de Darío. Dominio público, de
  Project Gutenberg, una página por pantalla. Al terminarlos se gana la medalla y se sube en la
  ruta. Bécquer va con la ortografía actualizada.
- **Música en Deslizar.** Veinte canciones cortas en bucle, una por grupo de lectura, hechas
  con `python musica/generar.py`. Cambian al pasar de un video a otro y se pueden silenciar.
- **Logros, nivel y campana.** Medallas que caen al ganarse, puntos por lo que lees y comentas,
  y avisos que llegan solos cada tanto.

## La red, con Supabase

El ranking, los comentarios y lo que pasa ahora mismo se comparten entre todos los teléfonos
por Supabase, en tiempo real. El esquema está en `supabase/esquema.sql` y la conexión en
`js/red-config.js`. Esa llave es la pública, la que Supabase hace para ir en la página, y lo
que se puede hacer con ella lo limitan las reglas del esquema. Sin conexión la app sigue igual
con su comunidad simulada.

La página puede leer las tablas pero no escribir en ellas. Todo lo que se escribe pasa por
tres funciones de la base, `soy` (la fila propia del ranking), `contar` (lo que va pasando) y
`comentar`. Cada teléfono guarda una clave al azar la primera vez y solo esa clave cambia su
fila, así nadie puede tocar el puntaje de otro. Las funciones rechazan las palabras feas y los
enlaces, y frenan a quien manda demasiado por minuto. La misma lista de palabras vive en
`js/red.js` para avisar antes de enviar; si se cambia una, hay que cambiar la otra.

El esquema se puede correr entero las veces que haga falta y no borra datos. Si se cambia,
primero se corre en el editor SQL de Supabase y después se sube la página, porque la página
nueva llama funciones que la base vieja no tiene.

La cuenta es opcional. Quien quiera guardar su avance crea una con correo y contraseña desde
Comunidad, y su racha, páginas, medallas y ruta se guardan en la nube.

## Como elige los libros

Cada tendencia trae sus temas en orden de importancia y cada libro los suyos. El puntaje es
cuánto se cruzan, pesando más los primeros. Ya con gusto aprendido, el feed va 60 por ciento
por tus temas y 40 por lo que suena hoy, y nunca pone más de dos seguidas de la misma
tendencia. Si el motivo no se puede escribir, la recomendación no sale.

## Lo que es demo

Lo de cada persona se guarda en su navegador, y en la nube solo si crea la cuenta opcional.
Mientras hay pocos lectores de verdad, el ranking y lo que pasa se completan con lectores
simulados, armados con números que salen de la fecha para que no cambien en cada recarga; los
de verdad llegan por Supabase y se mezclan con ellos. Las tendencias viven en
`datos/tendencias.json`. De las tres redes
solo YouTube da datos con una llave que uno saca solo, TikTok e Instagram no entregan
tendencias del país.

## Los archivos

    index.html            la página
    css/estilos.css       el diseño base y las ocho pieles
    css/vivo.css          entrada, deslizar, ruta, comunidad y lectura
    js/motor.js           cruza tendencias con libros y aprende de lo que tocas
    js/comunidad.js       racha, ruta, ranking, comentarios y la red simulada
    js/app.js             las vistas
    js/portada.js         la portada dibujada y la foto encima
    js/textos.js          los fragmentos de dominio público
    js/libres.js          los cuentos completos
    js/musica.js          la música de Deslizar
    js/red.js             Supabase, la red y la cuenta opcional
    js/red-config.js      la direccion y la llave publica de Supabase
    css/juego.css         campana, medallas, podio, fondo que se pinta
    musica/generar.py     sintetiza las veinte canciones
    supabase/esquema.sql  tablas y reglas de la base
    datos/libros.json     los 54 libros, con nivel
    datos/tendencias.json las 16 tendencias
    img/portadas/         las portadas, de Open Library
    servidor/             el servidor de Node de la primera versión
