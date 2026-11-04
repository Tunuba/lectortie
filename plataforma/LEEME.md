# lectortie, la app real

En vivo en https://lectortie.ledkid.com. Hecha el 03-11 para la exposición final, a pedido de Meme y José David, y rehecha el mismo 03-11 en la noche después de probarla.

## Estado al 04-11, 07:40

**PRENDIDA y con los arreglos de la mañana publicados**, ver Pruebas del 04-11 en la mañana al final. El más importante, al volver de una lectura el feed ya no regresa al primer video. 144 videos, 25 lecturas, 8 lectores reales.

## Estado al 03-11, 18:30

**PRENDIDA otra vez por pedido de Meme.** PostgreSQL corriendo, la tarea `LectortieServidor` habilitada y corriendo, y https://lectortie.ledkid.com responde. Se apaga con `apagar.ps1`.

Al prenderla tardó 5 minutos en arrancar. La tarea tenía prioridad 7, la que pone Windows por defecto, que deja el servidor por debajo de lo normal. Con la laptop en batería, OneDrive, el indexador y Defender le quitaban el procesador, y por eso en la tarde algunas peticiones tardaban hasta 10 segundos. Se le puso prioridad 4, igual que `LEDKIDServidor`, y ahora arranca en 5 segundos. Ese cambio está en la tarea, no en el repo. Si alguna vez se vuelve a crear la tarea, hay que ponerle prioridad 4 otra vez.

Lo último que se hizo antes, todo publicado y probado en el dominio.

- Feed que engancha primero con lo que ya ven los jóvenes, 43 videos generales y 24 de BookTok, todos de TikTok.
- Red neuronal propia que recomienda libros, 558 videos clasificados a mano, acierta 78 de cada 100.
- Página Por dentro en `/motor`, para enseñar en la presentación cómo recomienda.
- Conseguir el libro, que lleva a la librería Sophos y cuenta el clic.
- Pieles por tema, sonido que ya no se pierde al bajar, botón En TikTok, íconos para que el logo salga una vez al abrir la app instalada, y todo acomodado para no ir encima de lo que pinta TikTok, probado en 9 tamaños de pantalla.
- En la base quedan solo los lectores de verdad, `navichoque`, `meme`, `pin` y dos anónimos. Las pruebas se borraron.
- En `servidor/` quedan dos exe anteriores por si hay que volver atrás, `lectortie-antes-feed-general.exe` y `lectortie-antes-red.exe`. Para volver, apagar, copiar el que toque encima de `lectortie.exe` y prender.
- Las pruebas visuales y la cosecha de videos están en `pruebas/plataforma`, con su LEEME.

## Qué hace

Deslizas videos de TikTok de verdad y la app mide cuántos segundos te quedas en cada uno, cuáles saltas y cuáles repites. No arranca con libros. Los primeros videos son de lo que ya ven los jóvenes, frutinovelas, risa, armar cosas, cubo Rubik, pixel art, caricaturas, leyendas de Guatemala y el espacio, y cada uno empuja tu gusto hacia un tema de lectura. Mientras más miras, más BookTok te sale, sin quitar nunca del todo lo otro.

Cada tres videos te pone una mini lectura del tema que más te atrapó, con el motivo escrito, por ejemplo te quedaste 16 segundos en una frutinovela, aquí va una historia de amor de verdad. Un toque la abre completa, al terminarla con calma se prende la racha, y aparece en vivo en la comunidad. Con lo que miras, la app entera cambia de piel. Sin anuncios. Se instala en el teléfono como app.

Una red neuronal nuestra, entrenada con 558 videos clasificados a mano, lee cada video y dice a qué lectura se parece. Tu gusto suma lo que la red vio en los videos donde te quedaste, y los libros que te recomienda son los que más se parecen a tu gusto. Cada libro trae Conseguir, que lleva a buscarlo en la librería Sophos. La página Por dentro, en `/motor`, enseña todo eso funcionando, para mostrarlo en la presentación.

## Cómo está hecha

| Pieza | Qué es | Dónde |
|---|---|---|
| Base | PostgreSQL 18 nativo, puerto 5433, base `lectortie` | `base/001_esquema.sql`, `002_feed_general.sql`, `003_red_neuronal.sql` |
| Servidor | Go 1.26 con pgx, un solo programa, 127.0.0.1:8097 | `servidor/` |
| Web | Vue 3 con vue-router y Vite, PWA instalable | `web/` |
| Contenido | 8 temas, 13 lecturas, 67 videos de TikTok (43 generales y 24 de BookTok) | `contenido/construir.py` |
| Red neuronal | 558 videos clasificados a mano, 870 palabras, 16 neuronas, acierta 78 de 100 | `contenido/red/` |

- La base tiene dos usuarios. `lectortie_dueno` corre las migraciones y carga el contenido al arrancar. `lectortie_app` es con el que trabaja el servidor y solo puede leer y escribir lo que le da el esquema.
- La base necesita las extensiones `pg_trgm` y `pgcrypto`, creadas a mano como superusuario antes de la primera migración. En una base nueva hay que crearlas primero.
- Los triggers mueven el gusto con cada vista, cierran la lectura con racha, páginas, puntos y nivel, y suben el gusto cuando se abre una micro lectura.
- Las métricas salen de vistas materializadas que el servidor refresca cada minuto: retención de la semana, Sean Ellis y resumen por tema. Se ven en `/panel` con la clave `PANEL_CLAVE` del `.env`.
- El correo de entrar sin contraseña sale por el SMTP de ledkid.com. El `.env` apunta con `CORREO_ENV` al `.env` de LEDKID-SIMULADOR\backend y solo lee las variables `SMTP_*`, sin copiarlas.
- Ayuda guarda cada pedido en la tabla `ayuda`. Si se ponen `GLPI_URL`, `GLPI_APP_TOKEN` y `GLPI_USER_TOKEN` en el `.env`, los sube a GLPI como incidentes. Hoy GLPI está apagado y quedan en cola.

## El feed

- La recomendación la hace una red neuronal propia junto con lo que mide la app, ver La red neuronal más abajo. El tema principal de cada video del feed se puso a mano al elegirlo, y la red le agrega cuánto se parece a los demás temas.
- Cada video tiene `clase` y `etiqueta`. La clase `general` es lo que engancha (Frutinovela, Risa, Para armar, Cubo Rubik, Pixel art, Caricatura, Leyenda, Espacio) y la clase `libros` es BookTok.
- Cada video general lleva el tema de lectura que le queda. La frutinovela de la cárcel y la traición lleva a Clásicos, que es El conde de Montecristo. La caricatura lleva a Fantasía, que es El patito feo. El cubo Rubik lleva a Misterio, el pixel art a Distopía, las leyendas a Terror y Latinoamérica.
- `partGeneral` en `servidor/feed.go` decide la mezcla. Los tres primeros videos son generales y después baja poco a poco hasta uno de cada cuatro.
- Tres de cada diez se sortean parejo entre los temas, para que nunca sea un espejo. Nunca salen dos seguidos del mismo autor ni de la misma etiqueta. Cada persona ve otro orden, todo es al azar con su gusto.
- La micro lectura sale de lo que te atrapó en tus últimos videos, no del gusto de días (desde el 04-11). Cada segundo que te quedas suma, lo más nuevo pesa más, pasar rápido resta, y un tema cuyos dos últimos videos pasaste rápido no cuenta. Hacen falta al menos 4 segundos de verdad; si no hay un tema claro, en ese lugar sale otro video y la lectura espera al siguiente lugar, hasta 9 videos, y después sale la del gusto de siempre. Si vuelves a un texto que no abriste y ya viste dos videos más, se vuelve a elegir. Para quien todavía no termina ninguna, sale la más corta de todas aunque sea de otro nivel (en la demo salía El almohadón de pluma, 7 páginas, habiendo de 3). La pantalla ya no dice app, dice lectortie, porque el pitch lo llama prototipo; el botón de la barra lateral dice solo Instalar para que quepa.
- El motivo dice lo que viste en palabras de persona, una frutinovela, un video del cubo Rubik, y cierra con el puente de cada tema, por ejemplo aquí va un misterio para resolver.
- La racha se prende solo si la lectura se lee con calma, tres segundos por página como mínimo. Si se pasa más rápido, la app lo dice y ofrece leerla otra vez.

### Cómo se eligieron los 43 videos generales

El 03-11 en la noche salieron de las páginas discover de TikTok (por ejemplo `https://www.tiktok.com/discover/cubo-rubik`), abiertas en Edge sin ventana, que traen 26 videos cada una. Las páginas tag no sirven y el oEmbed de TikTok corta con 403 después de unos 50 pedidos. Se dejaron los que están en español, son populares y no traen temas que no van para jóvenes, y después se abrió cada uno en el reproductor oficial desde lectortie.ledkid.com para verlo. Se sacaron un humor con cara pintada, los de otros idiomas, los de bebés, uno de calificar chicas por belleza, uno religioso y uno de autoayuda. Para cambiar videos se edita `GENERAL` o `TIKTOK` en `contenido/construir.py`.

## La red neuronal

Lo que hace, en orden.

1. `contenido/red/dataset.json` tiene 558 videos de TikTok clasificados a mano en los 8 temas de lectura, leyendo su texto uno por uno. Salieron de 37 páginas discover de TikTok el 03-11 en la noche. Se descartaron 121 por otro idioma, sin relación o poco claros. Las reglas fueron las del catálogo, los acertijos y el cubo Rubik van a Misterio, las caricaturas y la risa a Fantasía, armar cosas y el espacio a Ciencia ficción, el pixel art, los videojuegos y la inteligencia artificial a Distopía, las frutinovelas de Cocardo a Clásicos, las leyendas de miedo a Terror y la cultura de Guatemala y el realismo mágico a Latinoamérica.
2. `contenido/red/entrenar.py` entrena desde cero una red de una capa de 16 neuronas (scikit-learn, MLPClassifier) con las palabras de cada texto, en minúsculas, sin tildes y cortadas a 6 letras. Aparta 112 videos para probarla. **Acierta 78 de cada 100 videos que nunca vio**, y la validación cruzada de 5 vueltas da lo mismo, 77.8 por ciento.
3. La misma red le pone un vector a cada video del feed (mitad lo que dice la red de su texto original de TikTok, mitad el tema que se le puso a mano) y a cada libro (mitad la red leyendo título, gancho y etiquetas, mitad sus etiquetas). Los libros sin ninguna etiqueta de los 8 temas, como Hábitos atómicos, no se recomiendan.
4. En la base, `003_red_neuronal.sql` cambia el trigger del gusto. Cada vista sube el peso de cada tema según cuánto se parece el video a ese tema.
5. `GET /api/para-mi` ordena los libros por el coseno entre tu gusto y el vector de cada libro, y dice por qué, los dos temas que más aportan.
6. La red corre igual en el navegador, en la página `/motor`, con los mismos pesos, que se sirven en `/motor/red.json`.

Para volver a entrenar, desde `contenido`, primero `python -B construir.py` y después `python -B red/entrenar.py`, y reiniciar el servidor para que cargue los vectores. Necesita numpy y scikit-learn.

## Conseguir el libro

- Cada libro recomendado tiene Conseguir, en la micro lectura, al terminar una lectura, en los videos de BookTok que llevan libro, en el perfil y en `/motor`.
- El enlace es `/ir/{libro}?desde=...`. El servidor anota el clic en la tabla `salidas` y manda a la búsqueda de la librería Sophos de Guatemala con el título y el autor.
- Todavía no hay convenio con ninguna librería, así que no hay comisión. El clic se cuenta para medir, y el panel enseña los Clics a comprar y Los libros que más quieren conseguir.

## La página Por dentro

`/motor`, en el menú de la computadora como Por dentro, y en el teléfono desde Tu gusto y desde el perfil. Tiene cuatro partes, el muro de los 558 videos por tema, la red pensando en vivo con un cuadro para escribir, el mapa de lo que la red aprendió con los videos y los libros y tu lugar, y tus libros con su parecido y Conseguir. En el teléfono la red se ve en vertical, palabras, neuronas y temas.

## Lo que se ve

- En el teléfono el video va entre la barra de arriba, que es sólida, y las pestañas. El reproductor de TikTok pinta su propio encabezado arriba y sus contadores abajo a la derecha, así que lo nuestro va donde él no pinta. La ficha abajo a la izquierda y los botones a la derecha a media altura, con su nombre debajo.
- En la computadora el video va en tarjeta 9 por 16 al centro y los botones al lado, como TikTok en la web. Entre 900 y 1279 de ancho, como un proyector de 1024, el panel del gusto de la derecha se esconde y queda en el botón Tu gusto, para que el video no se vuelva diminuto.
- El botón En TikTok abre el video original en TikTok, o en su app si está instalada.
- Las pieles están en `web/src/estilos.css`, una por tema, solo colores y un dibujo de fondo. Las pone `estado.js` en `html[data-piel]` con el tema que va arriba en tu gusto, y al cambiar avisa con Tu app se pintó de.
- Si un video no carga en quince segundos, sale su respaldo. Con libro es la portada arriba y el gancho abajo, sin texto encima de la imagen. Sin libro dice que no cargó y ofrece verlo en TikTok.
- El sonido. El reproductor que se carga de antemano se silencia solo la primera vez que suena, y eso pisaba el unMute. `TikTok.vue` escucha `onMute` y `onStateChange`, y si TikTok se silencia mientras la persona quiere oír, se lo vuelve a pedir. En iPhone Safari puede no bastar, porque ahí el navegador exige tocar dentro del mismo video.
- Los íconos. Para que al abrir la app instalada el logo se vea una sola vez, el ícono `any` es redondo sobre transparente, igual al recorte que hace Android, y el `maskable` es el cuadrado completo. La app ya instalada toma los íconos nuevos cuando Chrome la actualiza, o al quitarla y volverla a instalar.

## Prender y apagar

    clic derecho en prender.ps1, Ejecutar con PowerShell     prende la base y el servidor
    clic derecho en apagar.ps1, Ejecutar con PowerShell      los apaga, sin tocar ledkid.com

Los dos piden permiso de administrador solos, porque PostgreSQL es un servicio de Windows, y dejan la ventana unos segundos con el resultado. `prender.ps1` dice si respondió en la computadora y en el dominio. Si responde en la computadora pero no en el dominio, en la red de la U falta conectar WARP.

Con todo apagado, lectortie.ledkid.com da error 502, porque el túnel sigue y el servidor no. Es normal. Si da 1033 o 530 es el túnel, y en la red de la U hace falta WARP conectado, igual que ledkid.com.

## Cómo corre cuando está prendido

- PostgreSQL es el servicio `postgresql-x64-18`, en Manual. Lo prende `prender.ps1`.
- El servidor es la tarea programada `LectortieServidor`. `apagar.ps1` la deshabilita y `prender.ps1` la habilita y la arranca; prendida, arranca al iniciar sesión y se reinicia si se cae. Su registro va a `servidor.log`.
- Al mundo sale por el túnel de ledkid.com, con la regla `lectortie.ledkid.com` hacia `localhost:8097` en los dos `config.yml` de cloudflared. Las copias de antes quedaron como `config.yml.antes-lectortie`.
- Los límites por IP dejan entrar a un salón entero que sale a internet con una sola IP, hasta 200 personas nuevas de golpe y después una por segundo. Probado con 120 a la vez desde una IP, ver Pruebas del 04-11 en la mañana.

## Para cambiar algo

`npx vite build` en `web` publica al momento, porque el servidor sirve `web/dist` del disco. Antes de eso conviene probar en el ensayo.

Desde el 04-11 la web no se construye encima de `dist`. Se construye en otra carpeta y se copia sin borrar los archivos viejos de `dist/assets`, y `index.html` va al final. Así quien tiene la app abierta con la versión anterior sigue pudiendo abrir Comunidad o una lectura. Si igual le falta un archivo, la app se recarga sola en la página a la que iba.

    cd web && npx vite build --outDir C:\ruta\dist-nuevo --emptyOutDir
    copiar dist-nuevo\assets\* a dist\assets sin reemplazar, después favicon, manifest, sw.js, fuentes, iconos y motor, y al final index.html
    cd servidor && go build -o lectortie.new.exe .   y después parar la tarea, cambiar el exe y arrancarla
    cd contenido && python -B construir.py           y reiniciar el servidor para que cargue el contenido

### El ensayo

Una copia de `plataforma` en otra carpeta, con el `.env` cambiado a `PUERTO=8098`, `img/portadas` y `datos/libros.json` un nivel arriba, y el exe corrido con `-raiz` hacia esa copia. Usa la misma base, así que sus migraciones también quedan en la de verdad. Para verlo con los videos de TikTok, que solo cargan desde el dominio, Edge se hace pasar por lectortie.ledkid.com con `route.fetch` hacia el 8098. Así se probó todo el 03-11 en la noche, en teléfono de 390 y 360, tableta, 940, 1024, 1280, 1366, 1536 y 1920 de ancho.

## Antes de exponer

- Borrar solo los lectores de prueba, por id, como dueño. Los de alias `pr.` y `prueba.` son de las pruebas. `navichoque`, `meme` y `pin` son de verdad.
- Prender si está apagado, y en la U revisar que WARP esté conectado.
- Abrir la app una vez desde el teléfono que va a mostrar la demo, para que cargue todo.
- Si la app ya estaba instalada en ese teléfono, quitarla y volver a instalarla para que tome los íconos nuevos.
- Probar desde un teléfono con datos móviles además del WiFi de la U, por si el filtro de la U bloquea TikTok o el subdominio.

## Lo que falta

- Conectar GLPI con sus tokens.
- Un convenio con una librería para que Conseguir deje comisión.
- Correr el SQL de Supabase de la app vieja (`supabase/esquema.sql`). El 04-11 se subió todo al repo por pedido de Meme sin correrlo, así que la app vieja de GitHub Pages no guarda hasta que se corra.
- En iPhone, Safari puede seguir sin sonido al pasar de video, porque exige tocar dentro del mismo video. En Android y en la computadora ya funciona.
- Que el equipo revise las etiquetas de `contenido/red/dataset.json`. Las puso Claude a mano, leyendo cada texto con las reglas del catálogo.

## Arreglos del 03-11 en la noche

Publicados después de probarlos en el ensayo, en 1536x730 y en teléfono de 390.

- La barra del lector, con volver, avance y reloj, tenía un fondo sólido que tapaba con una caja el brillo de la piel, y se veía cortado junto al reloj. Ahora no tiene fondo. Al leer solo se mueve la hoja, así que no hace falta.
- En pantalla grande, el aviso que sale arriba tapaba el botón de volver del lector. Ahora en el lector sale debajo de la barra, como en el teléfono.
- Si el primer video no carga, el aviso Desliza hacia arriba tapaba el botón Verlo en TikTok. Ahora baja.
- Si la red se cae justo al abrir la app, como pasó a las 20:00 cuando el Wi-Fi de la casa se desconectó, la app se quedaba sin sesión y con el feed vacío hasta recargar. Ahora reintenta la primera llamada y la carga del feed durante unos 20 segundos.
- Sin sesión, el perfil decía Sin alias. Ahora dice Sin conexión.
- La copia de la web de antes de estos arreglos quedó en el scratchpad de la sesión, no en el repo.
- Las capturas de la presentación salen de `pruebas/plataforma/pieles.js`, que carga el gusto de cada tema en la base a un lector de prueba y saca el perfil en cada piel. Ese lector se borra por id al terminar.

## El algoritmo nuevo y 60 videos más (03-11, 21:33)

Pedido de José David, que vio puras leyendas de terror y le seguía saliendo romantasy. Se midió primero con lectores simulados, `pruebas/plataforma/simular.js`, que ven 60 videos cada uno como la app. Antes, al que solo ve terror le acertaba el 12 por ciento y pasaba 43 de 60 videos. Ahora, en el ensayo, de 65 a 69 por ciento, y en producción 64.

Lo que estaba mal, en este orden de peso.
- El catálogo. De BookTok había 3 de terror, 3 de misterio, 1 de distopía, 1 de ciencia ficción, 2 de Latinoamérica y 0 de clásicos, contra 7 de romantasy y 7 de fantasía. El feed no repetía nada en 6 horas, así que al acabarse lo de su tema llenaba con lo que quedara, que era justo lo que la persona pasaba.
- El feed nunca ponía dos videos seguidos del mismo tema y sorteaba parejo tres de cada diez.
- La red le ponía a los BookTok de terror de 0.14 a 0.20 de romantasy, y el trigger le subía romantasy a quien se quedaba en terror.
- La micro lectura decía Va con lo que más te gusta de un tema que no era el que más le gustaba, cuando se acababan las de su tema.

Lo que se cambió.
- `servidor/feed.go`. Primero se sortea el tema, 85 por ciento con el gusto y 15 por ciento entre los temas no rechazados, hasta tres seguidos del mismo. Después el video, uno no visto gana siempre; si ya vio todos los de su tema se repite uno en el que se quedó, el de hace más tiempo, y nunca uno que pasó rápido ni de los últimos 12. La micro lectura sale del tema que te atrapó en los últimos 12 videos de los últimos 20 minutos (`elegirPorAtrapo`, pruebas en `micro_test.go` con los casos de Meme del 04-11); del tema, una nueva, después una suya sin terminar que no estuvo entre las tres últimas, y nunca la que se acaba de poner. Sin tema claro responde `espera` con un video, solo al cliente que manda `espera=1`, así una página vieja en cache siempre recibe lectura. El motivo nunca dice lo que más te gusta si no lo es, y solo dice te quedaste si se quedó al menos 4 segundos.
- `servidor/cache.go`, cache aside del estado de cada lector, como pidió José David. El feed, la micro, el perfil y Por dentro leen primero de la cache; si no está o venció a los 2 minutos, leen de la base y la guardan. Cualquier escritura del lector la borra, y la vista y la micro la vuelven a llenar ya con el trigger aplicado. `/api/salud` muestra aciertos y fallos.
- `base/004_gusto_sin_ruido.sql`, el trigger solo reparte el gusto a los temas con 0.25 o más del vector, y siempre al tema del video.
- 60 videos nuevos en `contenido/construir.py`, 59 de BookTok y uno general, sacados de las páginas de libros del dataset de la red, leídos uno por uno y vistos en el reproductor con `pruebas/plataforma/cosecha/validar.js`. Se dejaron fuera 5, uno con una grosería en pantalla, uno de una saga con temas fuertes, uno político, uno de cultos y uno con una morgue. La lista y los motivos están en `pruebas/plataforma/cosecha/nuevos-1103.py`. La red no cambió, red.json y modelo.json quedaron idénticos.
- La vista se guarda aunque la persona cierre la app a media petición.

El ensayo ahora vive en su propio esquema, `ensayo`, dentro de la misma base, con `PG_DB=lectortie search_path=ensayo,public` en su `.env`. Así se prueban migraciones y contenido sin tocar a la app real. Después de una migración nueva hay que darle permiso al usuario de la app sobre las secuencias, `GRANT USAGE ON ALL SEQUENCES IN SCHEMA ensayo TO lectortie_app`.

Para volver atrás, `servidor/lectortie-antes-algoritmo.exe`. El trigger viejo es el de `003_red_neuronal.sql`.

## Segunda vuelta del algoritmo, 6 lecturas y ciencia ficción (03-11, 22:13)

Medido con `pruebas/plataforma/simular.js` tres veces por lector y sacando el promedio, porque una sola corrida varía mucho. Al final, lector que solo ve terror 69 por ciento de acierto y 97 de mini lecturas de su tema, romantasy 67, clásicos 56, el que cambia de terror a ciencia ficción a la mitad 53. Antes de todo esto eran 12, 17, 8 y 25.

- Exploración más lista. Al principio explora el 40 por ciento y baja al 15 en unos doce videos, y lo que explora va primero a los temas que la persona casi no ha visto. Sin esto, al de romantasy a veces no le salía ni un video de romantasy en los primeros 32, porque la fantasía le gustó un poco primero y se quedó con todo.
- Cansancio. Si los videos más recientes de un tema la persona los pasó rápido, dos o más seguidos, ese tema baja de golpe aunque su gusto de largo plazo siga alto. Antes, quien vio mucho terror y se aburrió seguía recibiendo terror unos catorce videos. La micro lectura usa lo mismo, y solo dice lo que más te gusta del tema de más peso de verdad.
- Ya no repite los últimos 8 videos, antes 12, para que un tema con pocos videos pueda repetir uno que te gustó.
- El motivo cambia. Si la lectura ya se le puso y no la abrió, dice Te la guardamos con lo que acaba de ver. Las leyendas se nombran por su tema, porque hay de terror y de Latinoamérica.
- 6 lecturas nuevas, adaptación propia de originales en inglés de dominio público, en `contenido/construir.py`. La pata de mono y El guardavía de terror, La liga de los pelirrojos y La cruz azul de misterio, La máquina del tiempo de ciencia ficción y La peste escarlata de distopía. Quedan 19, con 4 de terror, 3 de misterio y 2 de cada otro tema.
- 18 videos de BookTok de ciencia ficción, de las páginas discover de Proyecto Hail Mary, Dune y Ready Player One, vistos uno por uno. Se dejaron fuera los de la película, los de inglés, uno que ofrecía el libro en PDF y uno que vendía. Quedan 145 videos.

Para volver a la versión de las 21:33, `servidor/lectortie-algoritmo-2133.exe`. A la de antes de todo, `lectortie-antes-algoritmo.exe`.

Ojo, a las 21:59 PostgreSQL tardó 52 segundos en un checkpoint de 2 MB, el disco se trabó y una vista falló por tiempo. Pasó con miles de vistas simuladas, Defender, OneDrive y otra sesión trabajando a la vez. Con la carga de una exposición no debería pasar. Si se quiere evitar del todo, se puede excluir de Defender la carpeta de datos de PostgreSQL, pero eso lo decide Meme.

## 25 lecturas (03-11, 22:24)

Seis lecturas más, para que ningún tema se quede con dos. Las mini lecturas que tocan del tema de la persona pasaron, en clásicos, de 42 a 92 por ciento, y en romantasy de 50 a 68.

- Latinoamérica, dos cuentos completos de Horacio Quiroga, La tortuga gigante y Las medias de los flamencos, de Cuentos de la selva, 1918, tomados tal cual de Wikisource. Están en `contenido/cuentos_selva.py`. Igual que los otros cuentos completos conservan su puntuación y solo se les quitaron las rayas de diálogo, con la ortografía de hoy, fue y vio en lugar de fué y vió. Se corrigieron los errores del escaneo, entre ellos no piden ocasión, que en el original es no pierden ocasión.
- Romantasy, El ruiseñor y la rosa, y fantasía, El príncipe feliz, los dos de Oscar Wilde. Clásicos, Canción de Navidad de Dickens y el comienzo de Frankenstein de Mary Shelley, que lleva al libro Frankenstein del catálogo. Adaptaciones propias de originales en inglés de dominio público, en `contenido/construir.py`.

Quedan 4 de terror, 4 de clásicos, 4 de Latinoamérica, 3 de misterio, 3 de romantasy, 3 de fantasía y 2 de distopía y de ciencia ficción.

El ensayo se apagó al terminar. Su esquema `ensayo` sigue en la base, con lectores simulados, y no estorba a la app real. Para volver a usarlo, copiar el exe y el contenido a la copia del ensayo y correrlo con `-raiz`.

## Pruebas del 04-11 en la mañana (publicado 07:35)

Meme pidió seguir probando la app. Se probó en un ensayo propio en el puerto 8197 (el 8098 lo puede usar la sesión de LEDKID) y después en el dominio. Lo encontrado y arreglado, en orden de gravedad.

- **Al volver al feed salía otra vez el primer video.** Después de leer y tocar Seguir deslizando, o al ir a Comunidad y volver con Para ti, la persona caía en el video 1. Justo en la demo. Es que keep-alive saca el feed del documento y el navegador le borra el scroll. Ahora `Feed.vue` lo pone donde iba al volver, y si viene de terminar la lectura de ese lugar sigue solo con el video de abajo.
- **Al volver de leer, el video de abajo podía salir como que no cargó.** El reproductor de TikTok tenía un reloj de quince segundos para darse por caído que seguía corriendo mientras la persona leía. Ahora el reloj solo corre con el video a la vista. Si TikTok está bloqueado en la red, el primero tarda 15 s en pasar a su respaldo y los demás ya llegan con el respaldo puesto.
- **Un video de TikTok lo borraron.** Locas por ir a Corea, una frutinovela que sale entre los primeros, ahora da INVALID_VIDEO. Se quitó de `videos.json` y quedó comentado en `construir.py`. Los otros 144 cargan, revisados uno por uno en el reproductor con `pruebas/plataforma/cosecha/validar.js`. Conviene repetir esa revisión antes de cada exposición, porque los videos se pueden borrar en cualquier momento.
- **Una versión nueva dejaba quieta la app abierta.** Si alguien tenía la app abierta y se publicaba otra versión, tocar Comunidad o una lectura no hacía nada, porque el pedazo viejo ya no existía y el servidor contestaba la página en su lugar. Ahora un archivo que no existe da 404, la app se recarga sola en la página a la que iba, y al publicar no se borran los archivos viejos.
- **El filtro rechazaba cosas normales.** Alias como messi.10, kevin.gt o ana.me salían como Ese alias no se puede usar, y comentarios como Triste.me hizo llorar como Ese comentario no se puede publicar. El cambio de números por letras, que es para las groserías, convertía el 10 en io, y me, co y gt son también palabras. Ahora los enlaces se buscan en el texto tal cual, y me, co, gt, ly y tv solo cuentan si siguen con una barra o cierran el texto. Además José se guarda como jose y Juan Pablo como juan_pablo en vez de dar error.
- **Un salón entero en la misma red.** Con 60 personas a la vez desde una IP salían avisos de vas muy rápido. Se subió el límite por IP a 150 pedidos por segundo y a 200 personas nuevas de golpe, y el feed, la vista y la micro reintentan en silencio antes de avisar. Con 120 personas a la vez entran todas, con la vista en 20 ms.
- **Un video que da vueltas solo.** Si el presentador deja un video corriendo mientras habla, cada vuelta sumaba 2 al gusto sin tope. Ahora cuentan hasta 3 vueltas.
- **Tiempos largos.** El motivo decía te quedaste 312 segundos; ahora dice 5 minutos, y la barra del gusto pasa a min desde un minuto.
- **Mientras se leía cambiaba la piel.** La última vista del feed llega cuando la lectura ya está abierta, y ponía arriba lectortie se pintó de Terror tapando la etiqueta de una lectura de ciencia ficción, y le cambiaba el color a los botones a media lectura. Ahora con una lectura abierta la piel no se toca, y el cambio se pone y se avisa al volver al feed. Publicado a las 07:55, solo la web.
- **La caché podía guardar un gusto viejo.** Un feed que leía justo antes de una vista guardaba lo de antes encima de lo nuevo. Ahora cada lector lleva un número que sube con cada escritura y solo se guarda lo leído si no cambió.

### La prueba fuerte, muchos dispositivos a la vez (04-11, 08:00 a 08:40)

Meme pidió probarla con al menos diez dispositivos a la vez, y que el algoritmo no se rompa.

- **El algoritmo con 40 lectores simulados a la vez**, desde una sola IP como un salón, cuatro vueltas seguidas, 160 lectores y unos 145 pedidos por segundo. Ningún error. Cada uno terminó con su propio gusto, ninguno se mezcló con otro, y las vistas que mandó cuadran con las de la base. Acierto de 58 a 65 por ciento para quien ve un solo tema, igual que con 15 a la vez, y la mini lectura de su tema del 87 al 100 por ciento. Con `pruebas` en el scratchpad de la sesión, `sim-concurrente.js`.
- **A través del túnel, en el dominio**, 30 personas a la vez desde una IP: ningún error, la mitad de las respuestas en unos 130 ms y las más lentas en 1.4 segundos. Los lectores de prueba se borraron.
- **Navegadores reales a la vez**, teléfonos, tableta, computadora y proyector, cada uno con su gusto, y uno más con la misma cuenta que el primero. Cada uno recibió lecturas de su tema, volvió al lugar después de leer y de Comunidad, y el de la misma cuenta funcionó igual. Cada navegador de prueba pesa unos 330 MB, así que en esta laptop caben unos seis a la vez con lo demás abierto.
- **Fallo, dos vistas del mismo lector a la vez se trababan.** PostgreSQL cancelaba una con deadlock detected y la vista daba 500. Pasa con la misma cuenta en dos aparatos y con una sola persona que desliza muy rápido. Con 2 vistas a la vez fallaba el 16 por ciento y con 4 el 40. Nunca le pasó a un lector real, solo en estas pruebas. Arreglado de fondo en `base/005_sin_bloqueo_mutuo.sql`, todo lo que cambia el gusto toma primero el turno del lector y así las del mismo lector esperan en fila. Después, 0 errores con 2, 4 y 8 a la vez.
- **Fallo, videos que salían como que no cargaron con TikTok funcionando.** Al deslizar rápido a un video se le manda reproducir y enseguida pausa, y TikTok contesta un error de reproducción (3001). La app lo tomaba como video caído para siempre. Ahora solo pasa al respaldo un video que no existe, los errores del 1000 al 1999 como el borrado; uno de reproducción se vuelve a intentar.
- **Fallo, con TikTok bloqueado y deslizando rápido se veían ruedas girando sin fin.** Ahora un solo vigía por página: si a los 20 segundos no cargó ningún reproductor, TikTok está bloqueado en esa red y todos los videos salen con su respaldo enseguida.
- **El primer video ya no se hace esperar.** Meme preguntó si se podían precargar los videos en la base para que no se viera la espera de TikTok. Guardar los videos y servirlos nosotros no se puede, son de sus creadores y TikTok solo deja mostrarlos con su reproductor. Lo que se hizo: al tocar Seguir en el paso 1 de la entrada, los temas se mandan ya y el feed carga los primeros videos detrás mientras la persona escribe su alias, sin contar ese tiempo como visto, y la página se conecta a TikTok desde que abre. El primer video pasó de 3 segundos de rueda después de Empezar a 0.0 a 0.2. Se probó cargar dos videos de antemano en vez de uno y no cambió nada medible, y en una red lenta le quitaba velocidad al que se ve, así que se dejó en uno.
- **El aviso se pintó de, al entrar a leer.** El que salía en el feed justo antes de tocar la lectura se quedaba unos segundos encima del texto; ahora se quita al abrirla.
- Todo esto publicado a las 08:38 (la migración 005, con el servidor reiniciado 2 segundos) y a las 09:00 (la web). Probado otra vez en el dominio y borrados los lectores de prueba; quedan los 8 reales. Para volver al disparador de antes, el de `004_gusto_sin_ruido.sql`.
- **Lo que queda flojo, sin tocar el día de la exposición.** Quien cambia de gusto a la mitad, por ejemplo de terror a ciencia ficción, recibe lo nuevo en el 40 a 48 por ciento de los videos, y si antes pasó rápido ese tema, el feed tarda en volver a ofrecérselo. La mini lectura sí cambia rápido, del 87 al 93 por ciento.

Probado y bien, sin cambios. La racha entre días, simulando que leyó ayer y hace tres días. Recargar a media lectura, atrás y adelante del navegador, entrar directo a cada página y a una lectura que no existe. 40 videos seguidos con solo 3 reproductores a la vez y 11 MB de memoria. La prueba completa de siempre en teléfono de 390 y de 360, 1024 y 1536 de ancho, y en el dominio. Pruebas de Go nuevas en `servidor/arreglos_test.go`.

En la base quedan los 8 lectores reales; los de prueba del dominio se borraron por id.

Para volver atrás. El servidor anterior es `servidor/lectortie-antes-volver-0730.exe`. La web anterior está en `web/dist-antes-0730`; basta copiar su `index.html` encima del de `dist`, porque sus archivos siguen en `dist/assets`.
