import { reactive } from 'vue'

// Lo que comparten todas las vistas.
export const estado = reactive({
  yo: null,
  temas: [],
  gustos: [],
  ultimo: null,
  aviso: null,
  listo: false,
  instalable: false,
  ios: false,
  instalada: false,
  terminada: null, // la lectura que se acaba de terminar, para que el feed siga solo al volver
  leyendo: false, // con una lectura abierta la piel no cambia, ver aplicarGustos
  temasListos: false // la entrada ya mando los temas y el feed puede cargar detras
})

// el tiempo corto, como en la barra del gusto; desde un minuto en minutos
export function tiempo(seg) {
  seg = Math.round(seg || 0)
  return seg < 60 ? `${seg} s` : `${Math.round(seg / 60)} min`
}

let avisoT = 0
export function avisar(texto, tipo = 'ok') {
  estado.aviso = { texto, tipo, k: Date.now() }
  clearTimeout(avisoT)
  avisoT = setTimeout(() => { estado.aviso = null }, 3800)
}

// La piel de la app sigue al tema que mas te atrapa, igual que la vaca purpura del pitch.
// Cambia el fondo, los paneles, el color y el dibujo de fondo, y cuando cambia se avisa.
// Mientras se lee no se toca: la hoja va con el color de su tema, y la ultima vista del feed,
// que llega ya leyendo, ponia arriba "se pinto de Terror" tapando una lectura de ciencia
// ficcion y le cambiaba el color a los botones (04-11). La piel nueva se pone al salir.
export function aplicarGustos(gs, ultimo) {
  if (!Array.isArray(gs)) return
  estado.gustos = gs
  if (ultimo) estado.ultimo = { ...ultimo, k: Date.now() }
  if (estado.leyendo) return
  pintar(gs)
}

export function empezarALeer() {
  estado.leyendo = true
  // el aviso de la piel que salio en el feed justo antes de tocar la lectura no se queda encima
  if (estado.aviso && estado.aviso.texto.startsWith('lectortie se pintó')) estado.aviso = null
}
export function dejarDeLeer() {
  estado.leyendo = false
  pintar(estado.gustos)
}

function pintar(gs) {
  const top = (gs || []).find(g => g.peso > 0)
  const raiz = document.documentElement
  if (top) {
    const antes = raiz.dataset.piel
    raiz.style.setProperty('--piel', top.color)
    raiz.dataset.piel = top.tema
    if (antes && antes !== top.tema) avisar(`lectortie se pintó de ${top.nombre}`)
  }
}

export function ponerYo(p) {
  if (!p) return
  estado.yo = p
  if (p.temas) estado.temas = p.temas
  if (p.gustos) aplicarGustos(p.gustos)
}
