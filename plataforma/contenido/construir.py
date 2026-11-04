# Arma temas.json, lecturas.json y videos.json de lectortie.
# Los cuentos completos salen de js/libres.js y los fragmentos de js/textos.js de la app
# estatica. Los textos nuevos de abajo son traduccion propia de originales de dominio publico.
# Uso, desde esta carpeta, python -B construir.py
import json
import math
import os
import subprocess

AQUI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(AQUI, '..', '..'))

TEMAS = [
    {'clave': 'terror', 'nombre': 'Terror', 'piel': 'terror', 'color': '#FF4D5E', 'orden': 1},
    {'clave': 'romantasy', 'nombre': 'Romantasy', 'piel': 'romantasy', 'color': '#FF6FB1', 'orden': 2},
    {'clave': 'fantasia', 'nombre': 'Fantasía', 'piel': 'fantasia', 'color': '#A77BFF', 'orden': 3},
    {'clave': 'misterio', 'nombre': 'Misterio', 'piel': 'misterio', 'color': '#F2C14E', 'orden': 4},
    {'clave': 'distopia', 'nombre': 'Distopía', 'piel': 'distopia', 'color': '#35E0FF', 'orden': 5},
    {'clave': 'espacio', 'nombre': 'Ciencia ficción', 'piel': 'espacio', 'color': '#FF8A3D', 'orden': 6},
    {'clave': 'clasicos', 'nombre': 'Clásicos', 'piel': 'clasicos', 'color': '#E2C08D', 'orden': 7},
    {'clave': 'latinoamerica', 'nombre': 'Latinoamérica', 'piel': 'selva', 'color': '#2AE58C', 'orden': 8},
]


def cargar_js(archivo, variable):
    codigo = ("global.window={};require(%s);process.stdout.write(JSON.stringify(window.%s))"
              % (json.dumps(os.path.join(APP, 'js', archivo)), variable))
    return json.loads(subprocess.run(['node', '-e', codigo], capture_output=True, check=True, encoding='utf-8').stdout)


def minutos(paginas):
    palabras = sum(len(p.split()) for pag in paginas for p in pag)
    return max(1, math.ceil(palabras / 170))


def micro_de(paginas, tope=640):
    """El comienzo del texto, cortado en un punto, para el feed."""
    texto = ''
    for pag in paginas:
        for p in pag:
            for frase in p.replace('. ', '.|').split('|'):
                if len(texto) + len(frase) + 1 > tope and len(texto) >= 200:
                    return texto.strip()
                texto += ' ' + frase
    return texto.strip()


libres = cargar_js('libres.js', 'LIBRES')
textos = cargar_js('textos.js', 'TEXTOS')

PROPIA = 'Traducción propia del original en inglés, de dominio público. Fragmento.'
ADAPTADA = 'Adaptación propia del original en inglés, de dominio público. Fragmento.'

NUEVOS = {
    'corazon-delator': {
        'titulo': 'El corazón delator', 'autor': 'Edgar Allan Poe', 'tema': 'misterio', 'nivel': 2,
        'libro': 'el-secreto', 'fuente': 'Edgar Allan Poe, 1843. ' + PROPIA,
        'paginas': [
            ['Es verdad. Estoy nervioso, terriblemente nervioso, siempre lo he estado. Pero ¿por qué dicen que estoy loco? La enfermedad afiló mis sentidos, no los destruyó. Sobre todo el oído. Oía todo lo del cielo y de la tierra, y muchas cosas del infierno. Entonces, ¿cómo voy a estar loco? Escuchen, y vean con qué calma les cuento toda la historia.',
             'No sé cómo entró la idea en mi cabeza, pero una vez adentro me rondó de día y de noche. No había un motivo. Yo quería al viejo. Nunca me hizo daño, nunca me insultó, y no deseaba su oro. Creo que fue su ojo. Sí, fue eso. Tenía el ojo de un buitre, azul pálido, cubierto por una tela. Cada vez que me miraba se me helaba la sangre, y así, poco a poco, decidí librarme de ese ojo para siempre.'],
            ['Ustedes creen que estoy loco. Los locos no saben nada. Tendrían que haber visto con qué cuidado trabajé. Nunca fui tan amable con el viejo como esa semana. Cada noche, cerca de las doce, giraba el pestillo de su puerta y la abría muy despacio. Metía primero una linterna cerrada, sin un rayo de luz, y después la cabeza. Tardaba una hora en asomarla lo suficiente para verlo dormido en su cama.',
             'Entonces abría la linterna, apenas un poco, hasta que un solo rayo, fino como el hilo de una araña, caía sobre el ojo de buitre. Lo hice siete noches seguidas, y siempre encontré el ojo cerrado. Así no podía hacer nada, porque no era el viejo quien me molestaba. Era su ojo.'],
            ['La octava noche fui más cuidadoso que nunca. El minutero de un reloj se mueve más rápido que mi mano. Casi me reía de pensar que él ni soñaba lo que yo pensaba, cuando se movió de golpe en la cama, como si algo lo hubiera asustado. ¿Creen que retrocedí? No. El cuarto estaba negro como la brea, y yo seguí empujando la puerta, despacio, despacio.',
             'Ya tenía la cabeza adentro cuando el pulgar se me resbaló en el cierre de la linterna. El viejo se sentó de un salto y gritó quién anda ahí. Me quedé quieto. Durante una hora entera no moví un músculo, y tampoco lo oí acostarse otra vez. Seguía sentado, escuchando en la oscuridad, igual que yo había escuchado noche tras noche.',
             'Y entonces lo oí. Un sonido bajo, sordo y rápido, como el de un reloj envuelto en algodón. Yo conocía bien ese sonido. Era el corazón del viejo.'],
        ],
    },
    'maquina-se-detiene': {
        'titulo': 'La máquina se detiene', 'autor': 'E. M. Forster', 'tema': 'distopia', 'nivel': 2,
        'libro': '1984', 'fuente': 'E. M. Forster, 1909. Adaptación propia del original en inglés, de dominio público. Fragmento.',
        'paginas': [
            ['Imagina, si puedes, un cuarto pequeño de seis lados, como la celda de una abeja. No tiene ventana ni lámpara, y aun así lo llena una luz suave. No hay por dónde entre el aire, y aun así el aire es fresco. No hay instrumentos, y aun así el cuarto vibra con música. En el centro hay un sillón y, a su lado, un atril. Es todo el mueble. En el sillón está sentada una mujer pequeña, envuelta en telas, con la cara blanca como un hongo. El cuarto es de ella.',
             'Sonó un timbre. La mujer tocó un botón y la música se apagó. Seguro es mi hijo, pensó, y con fastidio tocó otro botón. En el plato redondo que tenía en las manos apareció una cara. Era Kuno, su hijo, que vivía al otro lado de la Tierra.'],
            ['Date prisa, le dijo Vashti. Tengo que dar una conferencia y no me sobra el tiempo. Kuno la miró desde el plato azul. Quiero que vengas a verme, le dijo. Pero si te estoy viendo, contestó ella. ¿Qué más quieres?',
             'Quiero verte sin la Máquina, dijo él. Quiero hablar contigo sin esta cosa cansada en medio. Ella se escandalizó. No debes decir nada contra la Máquina, Kuno. Él guardó silencio y después dijo algo peor. Quiero subir a la superficie de la Tierra. Quiero ver las estrellas con mis propios ojos.',
             'Allá arriba solo hay polvo y lodo, le dijo ella con miedo. No queda nada vivo, y el frío del aire de afuera te mataría.'],
            ['Cuando el plato se apagó, Vashti se quedó sola en su cuarto, rodeada de botones. Uno traía comida, otro música, otro ropa, otro un baño tibio. Había botones para hablar con miles de personas a la vez, y ninguno para abrazar a nadie.',
             'Pensó en su hijo, en las estrellas, en el polvo de afuera. Después tocó un botón, la luz se volvió más suave y siguió preparando su conferencia, como todos los días, sin levantarse de su sillón.'],
        ],
    },
    'guerra-mundos': {
        'titulo': 'La guerra de los mundos', 'autor': 'H. G. Wells', 'tema': 'espacio', 'nivel': 2,
        'libro': 'el-marciano', 'fuente': 'H. G. Wells, 1898. ' + PROPIA,
        'paginas': [
            ['Nadie habría creído, en los últimos años del siglo diecinueve, que este mundo estaba siendo observado de cerca por inteligencias más grandes que la nuestra, y tan mortales como nosotros. Mientras la gente iba y venía con sus asuntos, alguien la estudiaba, casi como quien mira con un microscopio las criaturas diminutas que nadan en una gota de agua.',
             'Y al otro lado del abismo del espacio, mentes enormes, frías y sin piedad miraban esta Tierra con envidia, y poco a poco, con calma, preparaban sus planes contra nosotros.'],
            ['Una noche fui con mi amigo Ogilvy, el astrónomo, a su observatorio. Afuera todo estaba en silencio. Adentro, el telescopio apuntaba a Marte, un pequeño círculo rojizo que flotaba en la oscuridad. Esa semana habían visto en el planeta un destello enorme, como un chorro de gas encendido lanzado hacia nosotros.',
             'Yo pregunté si podía haber vida allá. Ogilvy se rió. Las probabilidades de que haya algo parecido a un hombre en Marte son de una en un millón, me dijo. Y volvimos a casa caminando bajo las estrellas, sin miedo de nada.'],
            ['Pocas noches después mucha gente vio caer una estrella. Pasó muy alto, dejando una raya verde en el cielo, y cayó lejos, más allá del pueblo. Ogilvy pensó que era un meteorito y al amanecer salió a buscarlo.',
             'Lo encontró en el campo de Horsell, en el fondo de un hoyo enorme de arena. No era una piedra. Era un cilindro de metal, gigantesco y todavía caliente. Y mientras lo miraba, Ogilvy vio que la tapa, muy despacio, empezaba a girar.'],
        ],
    },
    'alicia': {
        'titulo': 'Alicia en el país de las maravillas', 'autor': 'Lewis Carroll', 'tema': 'fantasia', 'nivel': 1,
        'libro': 'harry-potter-1', 'fuente': 'Lewis Carroll, 1865. ' + PROPIA,
        'paginas': [
            ['Alicia empezaba a cansarse de estar sentada junto a su hermana sin hacer nada. Había mirado el libro que ella leía, pero no tenía dibujos ni conversaciones, y ¿para qué sirve un libro sin dibujos ni conversaciones?, pensó.',
             'Estaba pensando si valía la pena levantarse a hacer una corona de margaritas cuando pasó corriendo a su lado un conejo blanco de ojos rosados. Eso no tenía nada de raro. Lo raro fue que el conejo sacó un reloj del bolsillo de su chaleco, lo miró y dijo ay, ay, voy a llegar tarde.'],
            ['Alicia se levantó de un salto, porque nunca había visto un conejo con chaleco, ni mucho menos con reloj. Ardiendo de curiosidad, corrió tras él por el campo y alcanzó a ver cómo se metía en una madriguera grande, debajo del cerco.',
             'Un momento después Alicia entró detrás, sin pensar ni un segundo cómo iba a salir. La madriguera seguía derecho como un túnel y de repente se hundía, tan de repente que Alicia no tuvo tiempo de frenarse y se encontró cayendo por un pozo muy hondo.'],
            ['O el pozo era muy hondo, o ella caía muy despacio, porque tuvo tiempo de sobra para mirar a su alrededor. Las paredes estaban llenas de estantes, mapas y cuadros. Al pasar tomó un frasco que decía mermelada de naranja, pero estaba vacío.',
             'Abajo, abajo, abajo. ¿Nunca se iba a terminar? Voy a salir del otro lado de la Tierra, pensó. ¿Comerán murciélagos los gatos? Y de pronto, pum, cayó sobre un montón de hojas secas. Se levantó sin un rasguño y, al fondo de un pasillo largo, vio al conejo blanco que se alejaba corriendo.'],
        ],
    },
    'sirenita': {
        'titulo': 'La sirenita', 'autor': 'Hans Christian Andersen', 'tema': 'romantasy', 'nivel': 1,
        'libro': 'alas-de-sangre', 'fuente': 'Hans Christian Andersen, 1837. Traducción propia del original en danés, de dominio público. Fragmento.',
        'paginas': [
            ['Mar adentro, donde el agua es azul como la flor del aciano y clara como el cristal más puro, vive el rey del mar con sus seis hijas. La menor es la más hermosa, con la piel suave como un pétalo de rosa y los ojos azules como el mar más hondo. Pero, igual que sus hermanas, no tiene pies. Su cuerpo termina en una cola de pez.',
             'Desde niña sueña con una sola cosa. Su abuela le cuenta historias del mundo de arriba, de barcos y ciudades, de flores que huelen y de peces que cantan en las ramas de los árboles, que así llama ella a los pájaros.'],
            ['Cuando cumplan quince años, les dijo la abuela, podrán subir a la superficie, sentarse en las rocas a la luz de la luna y ver pasar los barcos. Cada año una hermana subía y volvía con cuentos nuevos, y la menor, que tenía que esperar más que todas, se quedaba de noche junto a la ventana, mirando hacia arriba a través del agua oscura.',
             'Por fin llegó su cumpleaños. Subió tan ligera como una burbuja y sacó la cabeza justo cuando el sol se ponía. Cerca había un barco lleno de luces y de música. Era la fiesta de un príncipe joven, el más hermoso que ella había visto.'],
            ['Esa noche se levantó una tormenta. Las olas subían como montañas negras y el barco se partió. La sirenita buscó al príncipe entre las tablas, lo encontró casi sin vida y lo sostuvo con la cabeza fuera del agua toda la noche.',
             'Al amanecer lo dejó en la arena, le besó la frente y se escondió detrás de unas rocas. Llegó una muchacha, el príncipe abrió los ojos y le sonrió a ella. Nunca supo quién lo había salvado. Y la sirenita volvió al fondo del mar con el corazón más triste que nunca.'],
        ],
    },
    'pata-de-mono': {
        'titulo': 'La pata de mono', 'autor': 'W. W. Jacobs', 'tema': 'terror', 'nivel': 2,
        'libro': 'coraline', 'fuente': 'W. W. Jacobs, 1902. ' + ADAPTADA,
        'paginas': [
            ['La noche era fría y húmeda, pero en la pequeña sala de Laburnum Villa las cortinas estaban cerradas y el fuego ardía con fuerza. Padre e hijo jugaban ajedrez, y la señora White tejía tranquila junto a la chimenea. Afuera el viento golpeaba la casa, que estaba al final de un camino solitario.',
             'Escuchen ese viento, dijo el señor White. De todos los lugares horribles para vivir, este es el peor. El camino es un pantano y nadie pasa por aquí. Justo entonces sonó la reja del jardín y unos pasos pesados se acercaron a la puerta. Era el sargento Morris, un viejo amigo que volvía de la India después de veintiún años.'],
            ['Morris se sentó junto al fuego, aceptó un vaso de whisky y empezó a contar historias de lugares lejanos, de guerras, de templos y de magos. Herbert, el hijo, lo escuchaba con los ojos muy abiertos. Cuéntales de la pata de mono, le pidió el señor White. Morris se puso serio. No es nada, dijo. Solo un poco de lo que ustedes llamarían magia.',
             'Sacó del bolsillo una cosa pequeña, seca y arrugada. Era la pata de un mono, momificada. Un viejo faquir le echó un hechizo, explicó. Quería demostrar que el destino gobierna la vida de las personas, y que quien se mete con él lo lamenta. Tres hombres pueden pedirle tres deseos cada uno.'],
            ['¿Y usted pidió los suyos?, preguntó Herbert. Sí, contestó el sargento, y se puso pálido. ¿Y alguien más? El primer hombre pidió sus tres deseos. No sé cuáles fueron los dos primeros, pero el tercero fue morir. Así llegó a mis manos. Entonces, sin decir más, lanzó la pata al fuego. El señor White la sacó de un manotazo.',
             'Si van a pedir algo, pidan algo sensato, les advirtió Morris antes de irse. Esa noche, medio en broma, el señor White levantó la pata y dijo en voz alta, deseo doscientas libras. En ese momento soltó un grito. La pata se había retorcido en su mano, contó después, como una serpiente.'],
        ],
    },
    'guardavia': {
        'titulo': 'El guardavía', 'autor': 'Charles Dickens', 'tema': 'terror', 'nivel': 2,
        'libro': 'frankenstein', 'fuente': 'Charles Dickens, 1866. ' + ADAPTADA,
        'paginas': [
            ['Hola, usted, el de allá abajo. Eso grité desde arriba del barranco. El hombre que estaba junto a la puerta de su caseta, con una bandera enrollada en la mano, tuvo que oírme. Pero en vez de mirar hacia arriba, donde yo estaba, se dio vuelta y miró hacia la vía, hacia la boca del túnel.',
             'Había algo raro en esa forma de mirar, aunque no habría sabido decir qué. Le pregunté si había un camino para bajar y me señaló un sendero en zigzag tallado en la roca. Bajé despacio. El barranco era tan hondo y tan estrecho que allá abajo casi no llegaba el sol, y del túnel salía un aire helado, con olor a tierra mojada.'],
            ['Junto a la entrada del túnel brillaba una luz roja. El guardavía me esperaba quieto, como si me tuviera miedo. Cuando estuve cerca se quedó mirando esa luz y después a mí. Le conté que su trabajo me interesaba, que yo había pasado la vida encerrado en una oficina y que por fin era libre de mirar el mundo. Él no dejaba de observarme.',
             '¿Usted cree que me ha visto antes?, le pregunté. Me pareció verlo allá, contestó, y señaló la luz roja. ¿Allá? ¿Y qué iba a hacer yo allá? No lo sé, dijo. Le juré que nunca había estado en ese lugar. Él respiró hondo y me invitó a su caseta. Adentro había un fuego, un escritorio, un telégrafo y una campanita.'],
            ['Hablamos mucho rato. Era un hombre tranquilo, que había estudiado de joven y ahora pasaba los días solo en el fondo de ese barranco. Dos veces, mientras hablábamos, se calló de golpe, pálido, y se volvió hacia la campanita, aunque la campanita no había sonado.',
             'Antes de irme le pregunté qué le pasaba. Me miró a los ojos y me dijo en voz baja, tengo un problema, señor. Venga mañana a las once de la noche y se lo cuento. Y cuando llegue, no me llame desde arriba. ¿Por qué no?, le pregunté. Porque eso es lo que me gritan a mí, dijo. Hola, usted, el de allá abajo.'],
        ],
    },
    'liga-pelirrojos': {
        'titulo': 'La liga de los pelirrojos', 'autor': 'Arthur Conan Doyle', 'tema': 'misterio', 'nivel': 2,
        'libro': 'seis-de-cuervos', 'fuente': 'Arthur Conan Doyle, 1891. ' + ADAPTADA,
        'paginas': [
            ['Un día de otoño fui a visitar a mi amigo Sherlock Holmes y lo encontré conversando con un señor gordo, de cara colorada y con un pelo tan rojo que parecía en llamas. Pase, Watson, me dijo Holmes. Llega justo a tiempo. El señor Jabez Wilson me trae un caso de lo más raro.',
             'Holmes lo miró de arriba abajo y dijo tranquilo, fuera de que ha hecho trabajo con las manos, que ha estado en China y que últimamente ha escrito mucho, no sé nada de usted. El señor Wilson saltó de la silla. ¿Cómo sabe todo eso? Holmes le señaló la mano derecha, más grande que la izquierda, un pececito tatuado en la muñeca y la manga brillante de tanto apoyarla en un escritorio.'],
            ['El señor Wilson sacó un periódico viejo y nos mostró un anuncio. Decía que la Liga de los Pelirrojos tenía un puesto libre, que pagaba cuatro libras a la semana por un trabajo muy sencillo y que solo podía pedirlo un hombre de pelo rojo. Yo tengo una casa de empeño pequeña, explicó, y mi ayudante, Vincent Spaulding, fue quien me lo enseñó.',
             'Es un buen ayudante, siguió. Trabaja por la mitad del sueldo y su único defecto es la fotografía. Se pasa horas metido en el sótano revelando fotos. El caso es que fui a la oficina de la Liga. La calle estaba llena de pelirrojos, cientos de ellos, pero el hombre que entrevistaba me miró el pelo, lo jaló para ver si era de verdad y me dio el puesto a mí.'],
            ['El trabajo era raro. Tenía que estar en la oficina de diez a dos, todos los días, sin salir ni un minuto, copiando a mano la enciclopedia, empezando por la letra A. Si salía, perdía el puesto. Así pasaron ocho semanas. Yo copiaba y copiaba, y cada sábado me pagaban mis cuatro libras.',
             'Pero esta mañana, al llegar, la puerta estaba cerrada. Clavado en ella había un cartoncito que decía la Liga de los Pelirrojos ha sido disuelta. Holmes y yo miramos el cartón, nos miramos, y los dos soltamos la carcajada. Al señor Wilson no le hizo ninguna gracia. Entonces Holmes se puso serio. Su caso es más grave de lo que parece, le dijo.'],
        ],
    },
    'cruz-azul': {
        'titulo': 'La cruz azul', 'autor': 'G. K. Chesterton', 'tema': 'misterio', 'nivel': 2,
        'libro': 'el-secreto', 'fuente': 'G. K. Chesterton, 1910. ' + ADAPTADA,
        'paginas': [
            ['Entre la plata del amanecer y el verde brillante del mar, el barco llegó a Harwich, y de él bajó un hombre que no llamaba la atención. Era Valentin, el jefe de la policía de París y el detective más famoso del mundo. Venía a Londres siguiendo al ladrón más grande de su tiempo, Flambeau.',
             'Nadie sabía dónde estaba Flambeau. Se sabía que era un gigante, de casi dos metros, con una fuerza enorme y un humor de payaso. Una vez puso de cabeza a un juez para que se le aclararan las ideas. Otra vez cambió de noche todos los números de una calle solo para que un viajero cayera en su trampa. Y se decía que iba a llegar a Londres.'],
            ['Valentin sabía que un hombre tan alto no podía esconder su estatura, y en el tren miró a todos. Ninguno era tan grande. Había empleados, dos señoras, un marinero bajito y un cura pequeño de Essex, con la cara redonda como una bola de masa, que llevaba varios paquetes de papel café y un paraguas enorme que se le caía a cada rato.',
             'El curita era tan sencillo que le contaba a todo el mundo que tenía que cuidar mucho uno de sus paquetes, porque llevaba algo de plata con piedras azules. A Valentin le dio lástima, le aconsejó no decírselo a nadie y siguió buscando a su gigante. Pero en Londres no lo encontró por ninguna parte.'],
            ['Valentin tenía un método curioso. Cuando no tenía ninguna pista, seguía lo absurdo. Entraba donde no había que entrar y doblaba en las esquinas sin motivo. Esa mañana entró en un restaurante cualquiera, pidió un café, le echó azúcar y, al probarlo, descubrió que era sal. Miró la salera. Estaba llena de azúcar.',
             'Llamó al mesero, que se puso rojo. Fueron dos curas, señor, le explicó. Uno bajito y otro alto. Antes de irse, el bajito tiró la sopa contra la pared. Valentin no dijo nada, pagó y salió corriendo a la calle. Por fin tenía algo que seguir.'],
        ],
    },
    'maquina-tiempo': {
        'titulo': 'La máquina del tiempo', 'autor': 'H. G. Wells', 'tema': 'espacio', 'nivel': 2,
        'libro': 'proyecto-hail-mary', 'fuente': 'H. G. Wells, 1895. ' + ADAPTADA,
        'paginas': [
            ['El Viajero del Tiempo, así lo vamos a llamar, nos estaba explicando algo difícil. Sus ojos grises brillaban, y en la mesa la luz de las lámparas se reflejaba en los vasos. Todo cuerpo de verdad, dijo, tiene largo, ancho y alto. Pero además tiene que durar un tiempo, porque si no, no existiría. El tiempo es la cuarta dimensión.',
             'Nosotros nos movemos libres hacia arriba, hacia los lados y hacia adelante, siguió. Solo en el tiempo vamos todos juntos, siempre hacia el futuro y a la misma velocidad. ¿Y si alguien pudiera moverse en el tiempo como se mueve en el espacio? El médico se rió y el psicólogo dijo que eso era imposible. El Viajero sonrió y salió de la sala.'],
            ['Volvió con un aparato de metal brillante, poco más grande que un reloj de mesa, hecho con una delicadeza increíble. Tenía piezas de marfil, otras como de cristal y dos palancas pequeñas. Esto es solo un modelo, nos dijo. Es mi plan para una máquina que viaja por el tiempo. Una palanca la manda al futuro y la otra al pasado.',
             'Le pidió al psicólogo que empujara la palanca con su propio dedo, para que nadie pensara en un truco. El psicólogo la empujó. Hubo un soplo de viento, la llama de la lámpara saltó, y la maquinita giró, se volvió borrosa como un fantasma de bronce y desapareció. Sobre la mesa solo quedó la lámpara.'],
            ['Nos quedamos en silencio. ¿Adónde se fue?, preguntó alguien. Al futuro o al pasado, no sé bien a cuál, contestó él con calma. Después nos llevó a su taller y nos mostró, a medio terminar, la máquina de verdad, grande, con un asiento para una persona. Pienso viajar en ella, nos dijo. Ninguno le creyó del todo.',
             'Una semana después volvimos a cenar a su casa. Él no estaba. A las siete y media se abrió la puerta y entró, pero cómo venía. Estaba pálido, lleno de polvo, con la ropa rota y una herida en la cara, y cojeaba. Se tomó una copa de un trago, nos miró a todos y sonrió. Ahora les cuento, dijo. Pero antes tengo que comer algo.'],
        ],
    },
    'peste-escarlata': {
        'titulo': 'La peste escarlata', 'autor': 'Jack London', 'tema': 'distopia', 'nivel': 2,
        'libro': 'juegos-del-hambre', 'fuente': 'Jack London, 1912. ' + ADAPTADA,
        'paginas': [
            ['El camino había sido una vía de tren, pero ya nadie se acordaba. A los lados crecía el bosque, y entre los árboles asomaba de vez en cuando un poste viejo de metal. Por ahí caminaba un viejo con un niño. El viejo iba vestido con una piel de cabra, tenía el pelo blanco y largo, y se apoyaba en un palo.',
             'El niño se llamaba Edwin, también iba vestido con pieles y llevaba un arco y unas flechas. Tenía unos doce años y caminaba mucho más rápido. Abuelo, le decía, cuéntame otra vez de antes, de cuando había tanta gente. Y el viejo, que en otro tiempo había sido profesor en una universidad, se ponía a recordar.'],
            ['En el año 2013 éramos ocho mil millones de personas, empezaba. Había ciudades enormes, máquinas que volaban por el aire y otras que corrían por la tierra, y comida para todos los que tenían dinero. Los niños se reían y no le creían. Para ellos el mundo era el bosque, la playa y los pocos que quedaban.',
             'Entonces llegó la peste escarlata, seguía el viejo. Empezaba con un calor en la cara, después la piel se ponía roja como la sangre, y en pocas horas la persona se moría. Nadie sabía curarla. Los médicos morían igual que los demás. En unos días las ciudades se llenaron de miedo y la gente empezó a huir.'],
            ['Yo lo vi todo, decía el viejo, y se le llenaban los ojos de lágrimas. Vi caer a mis alumnos, a mis amigos, a mi familia. Las luces de la ciudad se apagaron una por una. Al final quedamos unos pocos, escondidos en el campo, sin saber qué hacer con los libros, con las máquinas, con todo lo que ya no servía.',
             'Edwin lo escuchaba en silencio y tiraba piedras al mar. Ahora somos como los primeros hombres, terminaba el viejo. Tuvimos que aprender otra vez a cazar y a encender el fuego. Y todo lo que sabíamos, la ciencia, las ciudades, la música, se va a perder conmigo, porque ustedes ya no saben leer.'],
        ],
    },
    'ruisenor-rosa': {
        'titulo': 'El ruiseñor y la rosa', 'autor': 'Oscar Wilde', 'tema': 'romantasy', 'nivel': 1,
        'libro': 'cancion-de-aquiles', 'fuente': 'Oscar Wilde, 1888. ' + ADAPTADA,
        'paginas': [
            ['Dijo que bailaría conmigo si le llevaba rosas rojas, se quejaba el joven estudiante, pero en todo mi jardín no hay una sola rosa roja. Desde su nido en la encina, el ruiseñor lo oyó, miró entre las hojas y se quedó pensando.',
             'Ni una rosa roja en todo mi jardín, siguió el estudiante, y se le llenaron los ojos de lágrimas. He leído todo lo que escribieron los sabios, conozco todos los secretos de la filosofía, y por una rosa roja mi vida es un desastre. Por fin un enamorado de verdad, pensó el ruiseñor. Noche tras noche he cantado sobre él sin conocerlo.'],
            ['Mañana el príncipe da un baile, dijo el joven, y mi amada va a ir. Si le llevo una rosa roja, bailará conmigo hasta el amanecer. Si no, pasará a mi lado sin mirarme y se me romperá el corazón. Y se tiró en la hierba, con la cara entre las manos, a llorar.',
             'El ruiseñor abrió sus alas oscuras y voló. Fue a un rosal que crecía en medio del pasto y le pidió una rosa roja. Mis rosas son blancas, le contestó el rosal, más blancas que la espuma del mar. Ve a buscar a mi hermano, el que crece junto al reloj de sol. Pero las rosas de ese otro rosal eran amarillas.'],
            ['Ve a buscar a mi hermano, el que crece bajo la ventana del estudiante, le dijo. Y el ruiseñor voló hasta él. Mis rosas son rojas, le dijo ese rosal, tan rojas como las patas de las palomas. Pero el invierno me heló las venas, la escarcha me quemó los botones y la tormenta me rompió las ramas. Este año no tendré ninguna rosa.',
             'Solo quiero una, dijo el ruiseñor. ¿No hay ninguna manera de conseguirla? Hay una, contestó el rosal, pero es tan terrible que no me atrevo a decírtela. Dímela, le pidió el ruiseñor, no tengo miedo. Si quieres una rosa roja, dijo el rosal, tienes que hacerla con tu canto a la luz de la luna, y teñirla con la sangre de tu propio corazón.'],
        ],
    },
    'principe-feliz': {
        'titulo': 'El príncipe feliz', 'autor': 'Oscar Wilde', 'tema': 'fantasia', 'nivel': 1,
        'libro': 'el-principito', 'fuente': 'Oscar Wilde, 1888. ' + ADAPTADA,
        'paginas': [
            ['En lo alto de la ciudad, sobre una columna, estaba la estatua del Príncipe Feliz. Estaba cubierta de hojitas de oro fino, tenía dos zafiros brillantes en lugar de ojos, y en el puño de la espada le brillaba un rubí rojo y grande. Todo el mundo lo admiraba. Es tan hermoso como una veleta, decían los concejales.',
             'Una noche llegó volando una golondrina. Sus amigas se habían ido a Egipto seis semanas antes, pero ella se había quedado atrás, enamorada de un junco. Ahora estaba sola y tenía frío. ¿Dónde duermo?, se preguntó. Entonces vio la estatua sobre la columna. Aquí me quedo, dijo, es un buen lugar, con mucho aire fresco. Y se acomodó entre los pies del Príncipe Feliz.'],
            ['Ya iba a meter la cabeza bajo el ala cuando le cayó encima una gota de agua. Qué raro, pensó, no hay una sola nube en el cielo. Cayó otra gota, y otra. La golondrina miró hacia arriba y vio que los ojos del Príncipe Feliz estaban llenos de lágrimas, que le corrían por las mejillas de oro.',
             '¿Quién eres?, le preguntó. Soy el Príncipe Feliz. ¿Y entonces por qué lloras? Cuando estaba vivo y tenía un corazón de hombre, le contó la estatua, vivía en un palacio donde no entraba la tristeza. De día jugaba en el jardín y de noche bailaba en el gran salón. Nunca me pregunté qué había más allá del muro. Todos me llamaban el Príncipe Feliz.'],
            ['Ahora que estoy muerto me pusieron aquí arriba, tan alto que veo toda la fealdad y toda la miseria de mi ciudad, y aunque mi corazón es de plomo no puedo dejar de llorar. Allá lejos, en una calle pobre, hay una casa con una ventana abierta. Adentro veo a una costurera muy cansada, con las manos rojas de tanto pincharse con la aguja.',
             'En la cama del rincón está su hijito enfermo. Tiene fiebre y pide naranjas, pero su madre solo puede darle agua del río. Golondrina, golondrinita, ¿no quieres llevarle el rubí de mi espada? Yo tengo los pies pegados a esta columna y no me puedo mover.'],
        ],
    },
    'cancion-navidad': {
        'titulo': 'Canción de Navidad', 'autor': 'Charles Dickens', 'tema': 'clasicos', 'nivel': 2,
        'libro': 'conde-montecristo', 'fuente': 'Charles Dickens, 1843. ' + ADAPTADA,
        'paginas': [
            ['Marley estaba muerto, para empezar. De eso no hay ninguna duda. Y Scrooge lo sabía, claro que lo sabía, porque habían sido socios durante muchísimos años. Scrooge era duro como una piedra, avaro y frío por dentro. Ese frío le congelaba la cara, le afilaba la nariz y le ponía azules los labios.',
             'Era la víspera de Navidad y Scrooge trabajaba en su oficina. Hacía un frío terrible y había niebla. En un cuartito, su empleado, Bob Cratchit, copiaba cartas junto a un fuego tan pequeño que parecía una sola brasa, porque Scrooge no lo dejaba echar más carbón. Entonces se abrió la puerta y entró su sobrino, alegre, con la cara roja por el frío. Feliz Navidad, tío, le dijo.'],
            ['Bah, paparruchas, contestó Scrooge. ¿Feliz Navidad? ¿Con qué derecho estás feliz, si eres pobre? ¿Y con qué derecho estás amargado, si eres rico?, le respondió el sobrino riendo. Si por mí fuera, dijo Scrooge, a todos los que andan por ahí diciendo feliz Navidad los cocinaría en su propio pudín.',
             'El sobrino lo invitó a cenar al día siguiente y Scrooge le dijo que no. Después llegaron dos señores a pedir dinero para los pobres, y Scrooge los echó. ¿No hay cárceles?, les preguntó. ¿No hay asilos? Que vayan allá. Cuando se hizo de noche dejó ir a Bob Cratchit, de mala gana, y se fue solo a su casa, oscura y vacía.'],
            ['Al meter la llave en la puerta, Scrooge vio algo que lo dejó helado. La aldaba de bronce ya no era una aldaba. Era la cara de Marley, pálida, con una luz triste alrededor, como una langosta podrida en un sótano oscuro. Scrooge la miró fijo y la cara volvió a ser una aldaba. Paparruchas, murmuró, y entró.',
             'Subió a su cuarto, cerró la puerta con llave y se sentó junto al fuego a tomar su sopa. De pronto, en el sótano, sonó un ruido de cadenas que se arrastraban. El ruido subió por la escalera y llegó a su puerta. Y sin abrirla, atravesándola, entró el fantasma de Marley, arrastrando una cadena larga hecha de cajas de dinero, llaves y candados.'],
        ],
    },
    'frankenstein-fragmento': {
        'titulo': 'Frankenstein', 'autor': 'Mary Shelley', 'tema': 'clasicos', 'nivel': 2,
        'libro': 'frankenstein', 'fuente': 'Mary Shelley, 1818. ' + ADAPTADA,
        'paginas': [
            ['Fue en una noche triste de noviembre cuando vi terminado mi trabajo. Con una angustia que casi me ahogaba, junté a mi alrededor los instrumentos para darle la chispa de la vida a la cosa sin vida que estaba a mis pies. Era la una de la mañana. La lluvia golpeaba los vidrios y mi vela estaba casi consumida.',
             'Entonces, a la luz que se apagaba, vi abrirse el ojo amarillo y apagado de la criatura. Respiró con fuerza y un movimiento convulso le sacudió los brazos y las piernas. ¿Cómo puedo describir lo que sentí ante esa catástrofe? ¿Cómo dibujar al miserable que con tanto esfuerzo y tanto cuidado había intentado formar?'],
            ['Había elegido sus rasgos pensando en que fuera hermoso. ¡Hermoso! Dios mío. Su piel amarilla apenas le cubría los músculos y las venas. Su pelo era negro y brillante, sus dientes de un blanco de perla, pero eso solo hacía más horribles sus ojos aguados, casi del mismo color que las cuencas donde estaban, y sus labios negros y rectos.',
             'Había trabajado casi dos años con un solo fin, darle vida a un cuerpo inanimado. Por eso me había quitado el descanso y la salud. Lo había deseado con una pasión sin medida. Pero ahora que había terminado, la belleza del sueño desapareció, y un horror y un asco sin aliento me llenaron el corazón. Sin poder soportar lo que había creado, salí corriendo del cuarto.'],
            ['Caminé de un lado a otro en mi habitación durante mucho tiempo, sin poder calmarme. Al final el cansancio me venció y me tiré vestido en la cama. Dormí, sí, pero mis sueños fueron terribles. Soñé que veía a Elizabeth, sana y hermosa, caminando por las calles de Ingolstadt, y que al besarla sus labios se ponían pálidos, del color de la muerte.',
             'Me desperté de golpe, cubierto de un sudor frío, temblando. A la luz amarilla de la luna que entraba por la ventana vi al miserable, al monstruo que había creado. Tenía levantada la cortina de la cama, y sus ojos, si se les puede llamar ojos, estaban fijos en mí. Abrió la boca y murmuró algo que no entendí, mientras una mueca le arrugaba las mejillas.'],
        ],
    },
}

EXISTENTES = [
    # id, titulo, autor, tema, nivel, libro de moda al que lleva
    ('almohadon-pluma', 'El almohadón de pluma', 'Horacio Quiroga', 'terror', 1, 'mexican-gothic'),
    ('monte-animas', 'El monte de las ánimas', 'Gustavo Adolfo Bécquer', 'terror', 2, 'dracula'),
    ('ojos-verdes', 'Los ojos verdes', 'Gustavo Adolfo Bécquer', 'romantasy', 2, 'corte-rosas-espinas'),
    ('a-la-deriva', 'A la deriva', 'Horacio Quiroga', 'latinoamerica', 1, 'cien-anios'),
    ('rey-burgues', 'El rey burgués', 'Rubén Darío', 'latinoamerica', 2, 'pedro-paramo'),
]
FRAGMENTOS = [
    ('el-patito-feo', 'El patito feo', 'Hans Christian Andersen', 'fantasia', 1, 'historia-interminable'),
    ('la-metamorfosis', 'La metamorfosis', 'Franz Kafka', 'clasicos', 1, 'frankenstein'),
    ('conde-montecristo', 'El conde de Montecristo', 'Alejandro Dumas', 'clasicos', 2, 'cancion-de-aquiles'),
]

lecturas = []
for lid, titulo, autor, tema, nivel, libro in EXISTENTES:
    pags = libres[lid]['paginas']
    lecturas.append({'id': lid, 'titulo': titulo, 'autor': autor, 'tema': tema, 'nivel': nivel,
                     'micro': micro_de(pags), 'paginas': pags, 'minutos': minutos(pags),
                     'fuente': 'Cuento completo. Dominio público, Project Gutenberg.', 'libro': libro})
for lid, titulo, autor, tema, nivel, libro in FRAGMENTOS:
    pars = textos[lid]['parrafos']
    pags = [pars[i:i + 2] for i in range(0, len(pars), 2)]
    lecturas.append({'id': lid + '-fragmento', 'titulo': titulo, 'autor': autor, 'tema': tema, 'nivel': nivel,
                     'micro': micro_de(pags), 'paginas': pags, 'minutos': minutos(pags),
                     'fuente': 'Traducción propia del original de dominio público. Fragmento del ' + textos[lid]['capitulo'] + '.',
                     'libro': libro})
# Dos cuentos completos de Quiroga, Cuentos de la selva, 1918, tomados de Wikisource. Son el texto
# original, asi que conservan su puntuacion; solo se quitaron las rayas de dialogo, como en los
# otros cuentos completos. Ver cuentos_selva.py.
from cuentos_selva import TORTUGA, FLAMENCOS, paginas as paginas_selva
for lid, titulo, nivel, libro, pars in [('tortuga-gigante', 'La tortuga gigante', 1, 'casa-espiritus', TORTUGA),
                                        ('medias-flamencos', 'Las medias de los flamencos', 1, 'cien-anios', FLAMENCOS)]:
    pags = paginas_selva(pars)
    lecturas.append({'id': lid, 'titulo': titulo, 'autor': 'Horacio Quiroga', 'tema': 'latinoamerica', 'nivel': nivel,
                     'micro': micro_de(pags), 'paginas': pags, 'minutos': minutos(pags),
                     'fuente': 'Cuento completo. Horacio Quiroga, Cuentos de la selva, 1918. Dominio público, Wikisource.', 'libro': libro})
for lid, n in NUEVOS.items():
    lecturas.append({'id': lid, 'titulo': n['titulo'], 'autor': n['autor'], 'tema': n['tema'], 'nivel': n['nivel'],
                     'micro': micro_de(n['paginas']), 'paginas': n['paginas'], 'minutos': minutos(n['paginas']),
                     'fuente': n['fuente'], 'libro': n['libro']})

# ---------- videos ----------
# Todos son videos reales de TikTok, incrustados con el reproductor oficial. Hay dos clases.
#
# general, lo que ya ven los jovenes, frutinovelas, risa, armar cosas, cubo Rubik, pixel art,
# caricaturas, leyendas de Guatemala y el espacio. Con esto se engancha al que no lee, y cada
# uno lleva el tema de lectura que le queda, para que el gusto se vaya formando solo. La
# frutinovela de la carcel y la traicion lleva a Clasicos, que es El conde de Montecristo; la
# caricatura lleva a Fantasia, que es El patito feo; el cubo a Misterio y el pixel art a Distopia.
#
# libros, BookTok en espanol. Cada uno lleva un libro del catalogo del mismo tema.
#
# Los 43 generales salieron el 03-11 de las paginas discover de TikTok, se revisaron uno por uno
# viendo el video en el reproductor desde lectortie.ledkid.com, y se dejaron fuera los que no
# van para jovenes de 13 a 18, los de otros idiomas y los de bebes.
GENERAL = [
    # tema, etiqueta, autor, id, texto
    ('misterio', 'Frutinovela', '@frutitaenlatada', '7691886326454455573', 'El sabor de tus secretos, parte 1'),
    ('clasicos', 'Frutinovela', '@frutasalocadao', '7690388659975064864', 'Cocardo, la frutinovela que todos siguen'),
    ('clasicos', 'Frutinovela', '@bm_fruitstories', '7690416646548245791', 'La historia completa de Cocardo'),
    # ('romantasy', 'Frutinovela', '@kiara_xv25', '7703782955793091860', 'Locas por ir a Corea'),  fuera 04-11, TikTok dice INVALID_VIDEO, lo borraron
    ('distopia', 'Frutinovela', '@relatosen1minuto_', '7650663580588674326', 'Una calabaza que vive por los likes'),
    ('clasicos', 'Frutinovela', '@frutitaenlatasda', '7700621346342014241', 'Cocardo sale de la cárcel'),
    ('misterio', 'Frutinovela', '@frutinovela2900', '7696655432714095905', 'El coco del millón de dólares'),
    ('romantasy', 'Frutinovela', '@frotinovela.m', '7692907211411950866', 'La heladería de Cocardo'),
    ('fantasia', 'Risa', '@misaka450', '7585060292665560327', 'El loro que no deja en paz al gato'),
    ('fantasia', 'Risa', '@littlemonkey.ia', '7609655258226232598', 'El mono más tierno de TikTok'),
    ('latinoamerica', 'Risa', '@samaritanosenaccion', '7563384046034685198', 'El gallo que no se deja detener'),
    ('fantasia', 'Risa', '@toby_elvaliente', '7649169234920017174', 'La capibara y la maceta gigante'),
    ('espacio', 'Risa', '@nikileytor8', '7613487355558694162', 'El gato que creyó que podía volar'),
    ('espacio', 'Para armar', '@diy__sha', '7317474820940123425', 'Una caja de papel con una sola hoja'),
    ('fantasia', 'Para armar', '@dave.fdz', '7486620796035616005', 'Stickers caseros con tus dibujos'),
    ('clasicos', 'Para armar', '@laberiwis', '7421715658666282273', 'Una caja de regalo con forma de libro'),
    ('espacio', 'Para armar', '@ross_manuali', '7593947411949571349', 'Estrellitas de papel'),
    ('clasicos', 'Para armar', '@8304.hoffmann', '7684748359931890966', 'Un separador de libros para el dedo'),
    ('misterio', 'Cubo Rubik', '@fer.jalil', '7545994707508235527', 'Cómo armar el cubo Rubik paso a paso'),
    ('misterio', 'Cubo Rubik', '@alan.cubos2', '7522989781387709727', 'Un método para el cubo Rubik'),
    ('misterio', 'Cubo Rubik', '@moyo.cro4', '7542299526548278584', 'Armar el cubo Rubik, parte 1'),
    ('misterio', 'Cubo Rubik', '@unique.cuber', '7493745368417504554', 'El cubo Rubik en cuatro pasos'),
    ('distopia', 'Pixel art', '@miricraft.oficial', '7258649894318083354', 'Spiderman en pixel art de papel'),
    ('espacio', 'Pixel art', '@miricraft.oficial', '7252711949706824986', 'Among Us en pixel art'),
    ('distopia', 'Pixel art', '@vivi_v_1', '7540364317175139640', 'Rumi de las Guerreras K-pop en pixel art'),
    ('espacio', 'Pixel art', '@jasmine_s_art', '7442460331584097592', 'Ideas de pixel art en cuadritos'),
    ('fantasia', 'Pixel art', '@lapdibujos', '7382214937977965829', 'Snoopy en pixel art'),
    ('fantasia', 'Caricatura', '@johnmv127', '7504141455565262135', 'Tom y Jerry, el clásico de siempre'),
    ('fantasia', 'Caricatura', '@kids.cartoon.clips', '7455812621917359402', 'El buen dinosaurio'),
    ('clasicos', 'Caricatura', '@fideosverdes', '7583636374989851925', 'Los tres cerditos de 1933'),
    ('fantasia', 'Caricatura', '@animadascomiquitas', '7288044901474880774', 'Silvestre y Piolín, parte 1'),
    ('romantasy', 'Caricatura', '@initpelis', '7269892570883443973', 'Rapunzel, deja caer tu cabello'),
    ('clasicos', 'Caricatura', '@pelis.free.en.esp', '7688813566991879442', 'Ferdinand, el toro que no quería pelear'),
    ('misterio', 'Leyenda', '@guatefornication', '7166418142330129670', 'El monstruo del lago de Atitlán'),
    ('terror', 'Leyenda', '@aguacateclick', '7517528725156613381', 'Noche de leyendas en La Antigua'),
    ('latinoamerica', 'Leyenda', '@themisteriio', '7567540897697565974', 'La leyenda del quetzal'),
    ('terror', 'Leyenda', '@un.usuario356', '7567117418179333387', 'Los cadejos, leyenda de Guatemala'),
    ('terror', 'Leyenda', '@s.p.l.l', '7538148120471915832', '¿El Sombrerón es real?'),
    ('latinoamerica', 'Leyenda', '@oscarlopezmt', '7660238930847042832', 'Lo que cuentan las abuelas de Latinoamérica'),
    ('terror', 'Leyenda', '@carlos._.diaz_505', '7292221993791835398', 'Cinco leyendas de Guatemala'),
    ('espacio', 'Espacio', '@orvionfilms', '7616107959457811743', 'Galaxias que chocan en silencio'),
    ('espacio', 'Espacio', '@drevmc', '7511564863471226128', 'Lo que hay más allá de lo conocido'),
    ('espacio', 'Espacio', '@xataka', '7704044833140165910', 'Las manchas oscuras del Sol'),
    # 03-11 noche, sacados del dataset de la red y revisados uno por uno en el reproductor
    ('espacio', 'Espacio', '@oem2810', '7550531706810387730', 'Interstellar y el amor que cruza el tiempo'),
]
TIKTOK = [
    ('romantasy', '@lucianaboooksss', '7475188738880982278', 'Romances que te hacen llorar y reír', 'bajo-misma-estrella'),
    ('fantasia', '@marleybooks', '7597951471111507212', 'Libros para 13 y 14 años', 'percy-jackson'),
    ('romantasy', '@marleybooks', '7498861306502515973', 'Ana Paula tiene 14 años y es booktoker', 'wonder'),
    ('misterio', '@booktokcorner21', '7442108020303154488', 'Si tienes entre 13 y 19 años, estos libros', 'el-secreto'),
    ('fantasia', '@irenes_book', '7630860337536896278', 'Libros para 11 y 12 años', 'momo'),
    ('romantasy', '@readwith.carla', '7573761779860278550', 'Romance juvenil para 13 a 15 años', 'bajo-misma-estrella'),
    ('terror', '@nereabosch_', '7328396666917227809', 'Tres libros muy perturbadores', 'frankenstein'),
    ('terror', '@nereabosch_', '7275319561119993120', 'Cinco libros cortos de terror para llegar a tu meta del año', 'coraline'),
    ('terror', '@lalibreriadeinigo', '7293591262609837344', 'Tres novelas de terror que no te puedes perder', 'mexican-gothic'),
    ('romantasy', '@alba_writes', '7512777284559080727', 'Diez romantasy poco conocidos que merecen más hype', 'sombra-y-hueso'),
    ('romantasy', '@alba_writes', '7396267942683446561', 'Mi top diez de romantasy', 'corte-rosas-espinas'),
    ('romantasy', '@alba_writes', '7493519070659087638', 'Romantasy con verdaderos enemies to lovers', 'principe-cruel'),
    ('romantasy', '@alba_writes', '7491670593524403458', 'Romantasy que no son Acotar y merecen más hype', 'alas-de-sangre'),
    ('distopia', '@entre_letrasea', '7311216509873949957', '¿Qué es una distopía?', '1984'),
    ('misterio', '@raluskness', '7623348117567524118', 'Los thrillers que me quiero leer este mes', 'el-secreto'),
    ('misterio', '@raluskness', '7590707745444121878', 'Los diez mejores thrillers que leí este año', 'kafka-en-la-orilla'),
    ('espacio', '@e.g.martinez', '7530999925715340546', 'El mejor libro de ciencia ficción que existe', 'dune'),
    ('latinoamerica', '@patriciafedz', '7246110689339641114', 'El realismo mágico y el Boom latinoamericano', 'cien-anios'),
    ('latinoamerica', '@flashliterario', '7539682383830814008', 'La ciudad y los perros en tres minutos', None),
    ('fantasia', '@flashliterario', '7554890826204105995', 'El mago de Oz en tres minutos', None),
    ('fantasia', '@alba_writes', '7289397236507741473', 'Fantasía juvenil para empezar a leer', 'percy-jackson'),
    ('fantasia', '@alba_writes', '7348042272010767649', 'Recomendación de fantasía juvenil', 'harry-potter-1'),
    ('fantasia', '@fantacci.books', '7628586557615787286', 'Cinco libros de fantasía para adolescentes, por edad', 'momo'),
    ('fantasia', '@fantacci.books', '7589656239618166039', 'Diez libros de fantasía que debes leer sí o sí', 'seis-de-cuervos'),
    # 03-11 noche, sacados del dataset de la red y revisados uno por uno en el reproductor
    ('terror', '@g_vanille', '7567472911842299154', 'Tres libros de terror que sí dan miedo', None),
    ('terror', '@kris.end.chapter', '7420966190975110406', 'En qué orden leer los cuentos de terror de Kristopher Rodas', None),
    ('terror', '@melybee.books', '7698842759347588373', 'Miedos reales, más libros de terror', None),
    ('terror', '@merr_books', '7693912112980069654', 'Libros para leer en Halloween', None),
    ('terror', '@alaskaleelibros', '7698080633465212182', 'Seis libros ideales para Halloween', None),
    ('terror', '@nereabosch_', '7571120276067470614', 'Seis libros de terror por género', None),
    ('terror', '@anayloslibros', '7563013583718583570', 'Cinco libros de terror que no te dejan dormir', None),
    ('terror', '@litwithlaura', '7695375044733652246', 'Tres libros de terror que de verdad asustan', None),
    ('terror', '@alexjsnr', '7702924646487723270', 'Novelas de terror por tipo de monstruo', None),
    ('terror', '@labibliofila', '7697909259597630742', 'Si te gusta el terror, estos libros', None),
    ('terror', '@librosquelei', '7699502432300076309', 'Leyendo It de Stephen King', None),
    ('terror', '@melybee.books', '7699249197802917126', 'La Sociedad de las Pesadillas, el libro del que todos hablan', None),
    ('misterio', '@merr_books', '7610064483569945878', 'Cinco libros de misterio con los giros más sorprendentes', None),
    ('misterio', '@te.conlibros', '7268394103925198085', 'Tres libros de misterio adictivos', None),
    ('misterio', '@patibarcena_', '7643489846262123798', 'Thrillers que se llevan un diez', None),
    ('misterio', '@elbookclub.podcast', '7694463132751711496', 'Cómo empezar a leer a Agatha Christie', None),
    ('misterio', '@satchareads', '7700327959919447317', 'Thrillers de cinco estrellas', None),
    ('misterio', '@nayamzreads', '7704054010554158357', 'Y no quedó ninguno, de Agatha Christie', None),
    ('misterio', '@wickedsophie', '7586867476529581333', 'Agatha Christie, una de mis autoras favoritas', None),
    ('misterio', '@cartasdeunlector', '7686700546329267476', 'Cuál es el mejor libro de Agatha Christie', None),
    ('misterio', '@misteriosylibros_', '7649458752390761750', 'El asesino no es Sofía, un libro que se resuelve', None),
    ('misterio', '@luisxmaldo', '7673694689685540116', 'Busca al asesino, un libro para jugar al detective', None),
    ('misterio', '@lasmovidasdeross', '7703668133080354080', 'Crímenes ilustrados, para jugar a los detectives', None),
    ('misterio', '@devoraotv', '7702832388346334486', 'Los once días en que desapareció Agatha Christie', None),
    ('clasicos', '@entre_letrasea', '7390943429544447237', 'Clásicos para empezar a leer', None),
    ('clasicos', '@bookscamander', '7464376973180095750', 'Diez clásicos cortos para empezar', None),
    ('clasicos', '@the_bolivian_bookaholic', '7415039044368993542', 'Diez clásicos adictivos', None),
    ('clasicos', '@minutosdeliteratura', '7530636277511736582', 'Don Quijote, la primera parte en resumen', None),
    ('clasicos', '@alaskaleelibros', '7575235053941198102', 'Clásicos de menos de 120 páginas', None),
    ('clasicos', '@marinaamorillo', '7680214690022149398', 'Clásicos cortos y fáciles para empezar', None),
    ('clasicos', '@loleoenespanol', '7399720425376501038', 'Clásicos que te van a encantar', None),
    ('clasicos', '@genio.literario', '7652487835047562517', 'Cuatro clásicos para empezar, de Rebelión en la granja a Frankenstein', 'rebelion-granja'),
    ('clasicos', '@josefa.delabarra', '7659566580040338695', 'Jane Austen y Sentido y sensibilidad', None),
    ('clasicos', '@fvz_00', '7391859691585801477', 'Ser o no ser, el monólogo de Hamlet', None),
    ('clasicos', '@literatura727', '7526552018736008470', 'Don Quijote contra los molinos', None),
    ('clasicos', '@kxlpa.sn', '7702915077879500084', 'Noches blancas de Dostoievski', None),
    ('distopia', '@alexjsnr', '7621318804680822036', 'Distopías esenciales, de 1984 a El cuento de la criada', '1984'),
    ('distopia', '@alibrate.ok', '7109622115770404101', 'Qué es una distopía y cuáles leer', None),
    ('distopia', '@eduglez__', '7377544347304168709', '1984 de George Orwell', '1984'),
    ('distopia', '@adrianavc32', '7202407980145495301', 'Un mundo feliz de Aldous Huxley', 'un-mundo-feliz'),
    ('distopia', '@johanreads', '7683652273569828116', 'Once libros para empezar con las distopías', None),
    ('distopia', '@myfantasyreadings', '7672861507985673494', 'Distopías para fans de Los juegos del hambre', 'juegos-del-hambre'),
    ('distopia', '@lgsobrado', '7485850948200303894', 'Distopías juveniles como Legend', None),
    ('distopia', '@thereaderwithin', '7536156856331373846', 'Distopías imprescindibles', None),
    ('distopia', '@booksbylusi', '7455726553918410017', 'Qué distopía leer después de Fahrenheit 451', None),
    ('distopia', '@mamador_literario', '7443626109519826231', 'Metro 2033, la distopía nuclear', None),
    ('latinoamerica', '@cristofruits', '7701439571971558688', 'Cien años de soledad en resumen', 'cien-anios'),
    ('latinoamerica', '@lunayotrossatelites', '7658791230301572359', 'Pedro Páramo, Cien años de soledad y La casa de los espíritus', 'pedro-paramo'),
    ('latinoamerica', '@minutosdeliteratura', '7501517839514258743', 'Por qué Cien años de soledad es único', 'cien-anios'),
    ('latinoamerica', '@ad.leteo', '7590940968862469383', 'El mundo del realismo mágico', None),
    ('latinoamerica', '@raquel.poveda.bronchalo', '7501408266266692886', 'Qué es el realismo mágico', None),
    ('latinoamerica', '@leeporgusto', '7359404638270934278', 'Anécdotas de Cien años de soledad', 'cien-anios'),
    ('latinoamerica', '@historiaen01minuto', '7285022231577627910', 'García Márquez en un minuto', None),
    ('latinoamerica', '@stefydcss', '7674426899015208199', 'Remedios la Bella sube al cielo', 'cien-anios'),
    ('latinoamerica', '@alma_literaria27', '7699502959201226005', 'El realismo mágico, explicado', None),
    ('latinoamerica', '@paola.bookclub', '7622385732325313823', 'La verdadera precursora del realismo mágico', None),
    ('romantasy', '@mariaelentiya', '7689770866707582222', 'Tres fantasías con romance', None),
    ('romantasy', '@ir_zu', '7439701893288430881', 'La magia de las casualidades imposibles', None),
    ('fantasia', '@maia.alessandraa', '7659556833752911111', 'La saga de Lyna, aventura y misterio', None),
    # 03-11 noche, ciencia ficcion, cosechados de las paginas discover de Proyecto Hail Mary, Dune y Ready Player One y vistos uno por uno
    ('espacio', '@te.conlibros', '7612755038137535764', 'Cuatro razones para leer Proyecto Hail Mary', 'proyecto-hail-mary'),
    ('espacio', '@lagatadeschrodinger', '7589337520274427158', 'Proyecto Hail Mary, de Andy Weir', 'proyecto-hail-mary'),
    ('espacio', '@juanpalv_', '7628725354810641684', 'Por qué todos hablan de Proyecto Hail Mary', 'proyecto-hail-mary'),
    ('espacio', '@libreandoconfelipe', '7620601186760101140', 'Proyecto Hail Mary en un video', 'proyecto-hail-mary'),
    ('espacio', '@lisalioz', '7633432118605057282', 'Mi opinión de Proyecto Hail Mary', 'proyecto-hail-mary'),
    ('espacio', '@dragonesydrama', '7685415281325264161', 'Hablemos de Proyecto Hail Mary', 'proyecto-hail-mary'),
    ('espacio', '@charlajo_thg', '7340896687868628230', 'Yo leyendo Dune', 'dune'),
    ('espacio', '@alaskaleelibros', '7689926325229948182', 'Dune de Frank Herbert', 'dune'),
    ('espacio', '@entre_letrasea', '7342330398145318149', 'Qué tal es leer Dune', 'dune'),
    ('espacio', '@samdcote', '7691395913134263565', 'Dune, el clásico de la ciencia ficción', 'dune'),
    ('espacio', '@mr.cactus_avt', '7340461138116676870', 'Por qué leer Dune', 'dune'),
    ('espacio', '@a.malaver', '7579322453969882371', 'Dune, de mis favoritos de toda la historia', 'dune'),
    ('espacio', '@the_ritzer_club', '7609459964582628616', 'Ready Player One, el libro', 'ready-player-one'),
    ('espacio', '@lu.urcelay', '7508258905634491655', 'Qué tal Ready Player One', 'ready-player-one'),
    ('espacio', '@pla_neto08', '7117388083187715334', 'Ready Player One de Ernest Cline', 'ready-player-one'),
    ('espacio', '@mister.naranjo', '7458826876924988678', 'Hablemos de Ready Player One', 'ready-player-one'),
    ('espacio', '@leyendoconmanuel', '7415784860448558341', 'Ready Player One, un libro muy adictivo', 'ready-player-one'),
    ('espacio', '@vangsura7_7', '7670694250203401492', 'Ready Player One y los videojuegos', 'ready-player-one'),
]
# Los clips locales hechos con la portada ya no van en el feed, todos se veian iguales. La
# portada y el gancho del libro siguen saliendo, pero solo si un video de TikTok no carga.

libros = {b['id']: b for b in json.load(open(os.path.join(APP, 'datos', 'libros.json'), encoding='utf-8'))}
temas_ok = {t['clave'] for t in TEMAS}
videos = []
for tema, etiqueta, autor, ref, texto in GENERAL:
    assert tema in temas_ok, tema
    videos.append({'fuente': 'tiktok', 'ref': ref, 'autor': autor, 'texto': texto, 'tema': tema,
                   'clase': 'general', 'etiqueta': etiqueta})
for tema, autor, ref, texto, libro in TIKTOK:
    assert libro is None or libro in libros, libro
    v = {'fuente': 'tiktok', 'ref': ref, 'autor': autor, 'texto': texto, 'tema': tema,
         'clase': 'libros', 'etiqueta': 'BookTok'}
    if libro:
        v['libro'] = libro
    videos.append(v)
refs = [v['ref'] for v in videos]
assert len(refs) == len(set(refs)), 'hay un video repetido'
for v in videos:
    assert v['autor'].startswith('@') and v['ref'].isdigit(), v
    for marca in (':', ';', '«', '»', '—', '…', '"'):
        assert marca not in v['texto'], (v['ref'], marca)

for l in lecturas:
    assert l['libro'] in libros, l['libro']
    assert 80 <= len(l['micro']) <= 1200, (l['id'], len(l['micro']))
    if l['id'] not in NUEVOS:
        continue
    for marca in (':', ';', '«', '»', '—', '…', '"'):
        for pag in l['paginas']:
            for p in pag:
                assert marca not in p, (l['id'], marca, p[:60])

def guardar(nombre, datos):
    with open(os.path.join(AQUI, nombre), 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)

guardar('temas.json', TEMAS)
guardar('lecturas.json', lecturas)
guardar('videos.json', videos)
print('temas', len(TEMAS), 'lecturas', len(lecturas), 'videos', len(videos),
      'tiktok', sum(v['fuente'] == 'tiktok' for v in videos))
for l in lecturas:
    print(' ', l['id'], l['tema'], 'nivel', l['nivel'], l['minutos'], 'min', len(l['paginas']), 'pag, micro', len(l['micro']))
