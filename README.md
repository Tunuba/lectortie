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
- **Deslizar.** El mismo gesto de TikTok, pero cada video termina en un libro. Cada seis
  deslizones aparece la invitación a leer cinco minutos.
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

## Como elige los libros

Cada tendencia trae sus temas en orden de importancia y cada libro los suyos. El puntaje es
cuánto se cruzan, pesando más los primeros. Ya con gusto aprendido, el feed va 60 por ciento
por tus temas y 40 por lo que suena hoy, y nunca pone más de dos seguidas de la misma
tendencia. Si el motivo no se puede escribir, la recomendación no sale.

## Lo que es demo

Es un prototipo sin cuentas. Lo de cada persona se guarda en su navegador. Los demás lectores,
sus comentarios y el ranking se arman en la página con números que salen de la fecha, para que
no cambien en cada recarga. Las tendencias viven en `datos/tendencias.json`. De las tres redes
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
    datos/libros.json     los 49 libros, con nivel
    datos/tendencias.json las 16 tendencias
    img/portadas/         las portadas, de Open Library
    servidor/             el servidor de Node de la primera versión
