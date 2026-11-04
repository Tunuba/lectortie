<script setup>
import { ref, onMounted, onBeforeUnmount, onActivated, onDeactivated, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, vistaAlCerrar, conReintento } from '../api.js'
import { estado, aplicarGustos, avisar, tiempo } from '../estado.js'
import TikTok from '../componentes/TikTok.vue'
import ClipLocal from '../componentes/ClipLocal.vue'
import Micro from '../componentes/Micro.vue'
import Icono from '../componentes/Icono.vue'
import Gusto from '../componentes/Gusto.vue'

defineOptions({ name: 'Feed' })

// El feed. Cada video mide cuanto se queda la persona, sin contar el tiempo con la pestana
// escondida, y al salir de el se manda la vista. Cada tres videos va el lugar de una micro
// lectura, que se pide justo al llegar, cuando el servidor ya sabe lo que acaba de pasar. Si
// todavia no esta claro que te atrapo, el servidor no adivina: ese lugar se vuelve otro video y
// la lectura espera al siguiente lugar. Y si vuelves a un texto que no abriste y ya viste mas
// videos, se vuelve a elegir con lo de ahora (Meme vio el texto de terror de hacia tres minutos).
//
// El reproductor de TikTok pinta su propio encabezado arriba y sus contadores abajo a la
// derecha. Lo nuestro va donde el no pinta, la ficha abajo a la izquierda y los botones a la
// derecha a media altura en el telefono, y al lado del video en la computadora.
const router = useRouter()
const items = ref([])
const activo = ref(0)
const pista = ref(null)
const sonido = ref(false)
const verGusto = ref(false)
const pista0 = ref(true)
let cargando = false
let desdeMicro = 0
let actual = null
let ultimaVista = Promise.resolve()
let io = null
let iniciado = false
let toques = 0
let toqueT = 0
let enviadas = 0 // vistas mandadas, para saber si un texto ya quedo viejo

function excluirDe() {
  return items.value.filter(x => x.tipo === 'video').slice(-40).map(x => x.video.id).join(',')
}

async function cargar(n = 6) {
  if (cargando) return
  cargando = true
  try {
    const d = await conReintento(() => api.feed(n, excluirDe()))
    if (d.gustos) aplicarGustos(d.gustos)
    for (const v of d.videos) {
      items.value.push({ k: `v${v.id}-${items.value.length}`, tipo: 'video', video: v, falla: v.fuente !== 'tiktok', gusta: false, corazon: 0 })
      desdeMicro++
      if (desdeMicro === 3) {
        items.value.push({ k: `m${items.value.length}`, tipo: 'micro', micro: null, pidiendo: false, error: '' })
        desdeMicro = 0
      }
    }
    await nextTick()
    observarNuevos()
  } catch (e) {
    avisar(e.message, 'mal')
  } finally {
    cargando = false
  }
}

function observarNuevos() {
  if (!pista.value) return
  if (!io) {
    io = new IntersectionObserver(ents => {
      for (const e of ents) if (e.isIntersecting && e.intersectionRatio >= 0.6) activar(Number(e.target.dataset.i))
    }, { root: pista.value, threshold: [0.6] })
  }
  pista.value.querySelectorAll('.item:not([data-obs])').forEach(el => { el.dataset.obs = '1'; io.observe(el) })
}

// El tiempo en un video solo corre si la persona lo puede ver: con la pestana escondida no, y
// tampoco mientras la entrada esta encima, que desde el 04-11 los primeros videos ya cargan
// detras mientras escribe su alias.
const tapado = () => !!(estado.yo && !estado.yo.entro && !estado.yo.alias && !estado.yo.videos)
const parado = () => document.hidden || tapado()
function abrirVista(i) {
  const it = items.value[i]
  actual = it && it.tipo === 'video' ? { i, video: it.video.id, t0: parado() ? 0 : performance.now(), acum: 0, vueltas: 0 } : null
}
function msDe(a) { return Math.round(a.acum + (a.t0 ? performance.now() - a.t0 : 0)) }

const QUE_SE_VIO = {
  Frutinovela: 'una frutinovela', Risa: 'un video de risa', 'Para armar': 'un video de armar cosas',
  'Cubo Rubik': 'un video del cubo Rubik', 'Pixel art': 'un video de pixel art', Caricatura: 'una caricatura',
  Leyenda: 'una leyenda', Espacio: 'un video del espacio'
}
function queSeVio(v) { return QUE_SE_VIO[v.etiqueta] || `un video de ${v.temaNombre.toLowerCase()}` }

function cerrarVista(alCerrar = false) {
  const a = actual
  actual = null
  if (!a) return
  const it = items.value[a.i]
  const ms = msDe(a)
  if (ms < 350 && !it.gusta) return
  const v = { video: a.video, ms, vueltas: a.vueltas, salto: ms < 2500, gusta: !!it.gusta }
  if (alCerrar) { vistaAlCerrar(v); return }
  const que = queSeVio(it.video)
  const texto = v.salto ? `Pasaste rápido ${que}` : `Te quedaste ${tiempo(ms / 1000)} en ${que}`
  ultimaVista = conReintento(() => api.vista(v), 2).then(d => aplicarGustos(d.gustos, { texto, color: it.video.color })).catch(() => {})
  enviadas++
  if (estado.yo) estado.yo.videos = (estado.yo.videos || 0) + 1
}

function activar(i) {
  if (Number.isNaN(i) || (i === activo.value && iniciado)) return
  iniciado = true
  if (i > 0) pista0.value = false
  cerrarVista()
  activo.value = i
  abrirVista(i)
  const it = items.value[i]
  if (it && it.tipo === 'micro' && !it.pidiendo && !it.abierta && (!it.micro || enviadas - it.n >= 2)) pedirMicro(it, i)
  if (items.value.length - i <= 4) cargar()
}

async function pedirMicro(it, i) {
  it.pidiendo = true
  it.error = ''
  it.micro = null
  const t0 = performance.now()
  try {
    await ultimaVista
    const n = enviadas
    const m = await conReintento(() => api.micro(excluirDe()))
    if (m.gustos) aplicarGustos(m.gustos)
    if (m.espera && m.video) {
      // todavia no esta claro que te atrapo: en este lugar va otro video
      Object.assign(it, { tipo: 'video', video: m.video, falla: m.video.fuente !== 'tiktok', gusta: false, corazon: 0, pidiendo: false })
      if (activo.value === i && !actual) abrirVista(i)
      return
    }
    const resta = Math.max(0, 1200 - (performance.now() - t0))
    setTimeout(() => { it.micro = m; it.n = n; it.pidiendo = false }, resta)
  } catch (e) {
    it.error = e.message
    it.pidiendo = false
  }
}

function leer(it) {
  it.abierta = true
  api.abrirMicro(it.micro.id).catch(() => {})
  router.push(`/leer/${it.micro.lectura.id}`)
}

function vuelta(i) { if (actual && actual.i === i) actual.vueltas++ }

function corazon(it) {
  it.gusta = !it.gusta
  if (it.gusta) it.corazon++
}

// un toque prende o apaga el sonido, dos toques le dan corazon
function tocar(it) {
  toques++
  clearTimeout(toqueT)
  if (toques === 2) {
    toques = 0
    if (!it.gusta) corazon(it)
    else it.corazon++
    return
  }
  toqueT = setTimeout(() => { if (toques === 1) sonido.value = !sonido.value; toques = 0 }, 260)
}

// donde empieza un item dentro de la pista, medido en pantalla para no depender de margenes
function cimaDe(el) {
  const pi = pista.value
  return Math.round(el.getBoundingClientRect().top - pi.getBoundingClientRect().top + pi.scrollTop)
}
function irA(i, suave = true) {
  const el = pista.value && pista.value.querySelector(`.item[data-i="${i}"]`)
  if (el) pista.value.scrollTo({ top: cimaDe(el), behavior: suave ? 'smooth' : 'instant' })
}
// keep-alive saca la pista del documento al ir a otra pagina y el navegador le borra el scroll.
// Sin esto, al volver de una lectura o de Comunidad la persona caia otra vez en el primer video
// (04-11). Al volver se pone donde iba, y si viene de terminar la lectura de ese lugar, sigue
// sola con el video de abajo, que para eso toco Seguir deslizando.
function volverAlLugar() {
  if (!pista.value || !iniciado) return
  irA(activo.value, false)
  const it = items.value[activo.value]
  if (it && it.tipo === 'micro' && it.micro && estado.terminada === it.micro.lectura.id) {
    estado.terminada = null
    setTimeout(() => irA(activo.value + 1), 450)
  }
}
function teclas(e) {
  if (e.target.closest('input, textarea')) return
  if (['ArrowDown', 'PageDown', 'j'].includes(e.key)) { e.preventDefault(); irA(activo.value + 1) }
  else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); irA(Math.max(0, activo.value - 1)) }
  else if (e.key === 'm') sonido.value = !sonido.value
}
function visible() {
  if (!actual) return
  if (parado()) { if (actual.t0) { actual.acum += performance.now() - actual.t0; actual.t0 = 0 } }
  else if (!actual.t0) actual.t0 = performance.now()
}
watch(tapado, visible)
function alSalir() { cerrarVista(true) }

// Hasta que la persona no elige sus temas en la entrada, no se pide el primer lote, asi el
// primer video ya va con lo que eligio. Los temas llegan al pasar al paso 2 de la entrada, y el
// lote se carga detras mientras escribe su alias.
function esperar(cond) {
  if (cond()) return Promise.resolve()
  return new Promise(r => { const w = watch(cond, v => { if (v) { w(); r() } }) })
}
onMounted(async () => {
  document.addEventListener('visibilitychange', visible)
  window.addEventListener('pagehide', alSalir)
  window.addEventListener('keydown', teclas)
  await esperar(() => estado.listo)
  await esperar(() => !estado.yo || estado.yo.alias || estado.yo.videos > 0 || estado.yo.entro || estado.temasListos)
  await cargar(7)
  // si la primera carga fallo por la red, el feed queda vacio y no hay nada que observar
  for (let k = 1; k <= 5 && !items.value.length; k++) {
    await new Promise(r => setTimeout(r, 2000 * k))
    await cargar(7)
  }
})
onActivated(() => {
  window.addEventListener('keydown', teclas)
  volverAlLugar()
  if (iniciado && !actual) abrirVista(activo.value)
})
onDeactivated(() => {
  verGusto.value = false
  window.removeEventListener('keydown', teclas)
  cerrarVista()
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', visible)
  window.removeEventListener('pagehide', alSalir)
  window.removeEventListener('keydown', teclas)
  if (io) io.disconnect()
  cerrarVista(true)
})
</script>

<template>
  <div class="feed">
    <div ref="pista" class="pista">
      <section v-for="(it, i) in items" :key="it.k" class="item" :class="{ es_micro: it.tipo === 'micro' }" :data-i="i">
        <div class="marco">
          <template v-if="it.tipo === 'video'">
            <TikTok v-if="!it.falla && Math.abs(i - activo) <= 1" :id="it.video.ref" :activo="i === activo" :sonido="sonido" @falla="it.falla = true" @vuelta="vuelta(i)" />
            <ClipLocal v-else-if="it.falla && Math.abs(i - activo) <= 2" :libro="it.video.libro" :texto="it.video.libro?.gancho || it.video.texto" :etiqueta="it.video.etiqueta" :enlace="it.video.enlace" :color="it.video.color" :activo="i === activo" @vuelta="vuelta(i)" />
            <div v-else class="espera" :style="{ '--c': it.video.color }"></div>

            <div class="tapa" @click="tocar(it)"></div>
            <div class="sombra"></div>
            <div class="info">
              <span class="chip" :style="{ '--c': it.video.color }"><i></i>{{ it.video.etiqueta }}<template v-if="it.video.clase === 'libros'">, {{ it.video.temaNombre }}</template></span>
              <p class="texto">{{ it.video.texto }}</p>
              <p class="lleva" v-if="it.video.libro && it.video.clase === 'libros'"><Icono n="libro" /><span>{{ it.video.libro.titulo }}, de {{ it.video.libro.autor }}</span></p>
              <a v-if="it.video.libro && it.video.clase === 'libros'" class="conseguir" :href="`/ir/${it.video.libro.id}?desde=video`" target="_blank" rel="noopener">Conseguir el libro</a>
            </div>
            <div v-if="it.corazon" :key="'c' + it.corazon" class="estallido"><Icono n="corazon" /></div>
            <button v-if="i === activo && !sonido && !it.falla" class="pide-sonido" @click="sonido = true"><Icono n="mudo" />Toca para el sonido</button>
          </template>
          <Micro v-else :item="it" @leer="leer(it)" />
        </div>
        <div v-if="it.tipo === 'video'" class="riel">
          <button class="accion" :class="{ si: it.gusta }" :aria-pressed="it.gusta" @click="corazon(it)"><span class="boli"><Icono n="corazon" /></span><small>Me gusta</small></button>
          <button class="accion" @click="sonido = !sonido"><span class="boli"><Icono :n="sonido ? 'sonido' : 'mudo'" /></span><small>{{ sonido ? 'Con sonido' : 'Sin sonido' }}</small></button>
          <button class="accion movil" @click="verGusto = true"><span class="boli"><Icono n="panel" /></span><small>Tu gusto</small></button>
          <a v-if="it.video.enlace" class="accion" :href="it.video.enlace" target="_blank" rel="noopener"><span class="boli"><Icono n="afuera" /></span><small>En TikTok</small></a>
        </div>
        <div v-if="i === 0 && pista0" class="desliza" :class="{ bajo: it.falla }"><span></span>Desliza hacia arriba</div>
      </section>
      <section v-if="!items.length" class="item"><div class="marco vacio"><i></i></div></section>
    </div>

    <Teleport to="body">
      <div v-if="verGusto" class="velo" @click.self="verGusto = false">
        <div class="hoja"><Gusto compacto /><button class="boton claro cerrar-g" @click="verGusto = false">Seguir deslizando</button></div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* En el telefono el video va entre la barra de arriba y las pestanas, sin nada encima de lo
   que pinta TikTok arriba. */
.feed { position: relative; --alto-item: calc(100dvh - var(--barra) - var(--tabs) - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
.pista { height: var(--alto-item); margin-top: calc(var(--barra) + env(safe-area-inset-top)); overflow-y: scroll; scroll-snap-type: y mandatory; overscroll-behavior: contain; scrollbar-width: none; }
.pista::-webkit-scrollbar { display: none; }
.item { position: relative; height: var(--alto-item); overflow: hidden; scroll-snap-align: start; scroll-snap-stop: always; display: flex; align-items: center; justify-content: center; }
.marco { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; }
.espera { position: absolute; inset: 0; background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--c) 22%, #12101C), #000 70%); }
.tapa { position: absolute; inset: 0; z-index: 2; }
.sombra { position: absolute; left: 0; right: 0; bottom: 0; height: 38%; z-index: 2; pointer-events: none; background: linear-gradient(transparent, rgba(5, 4, 10, .78)); }
/* la ficha abajo a la izquierda, sin tocar la columna de contadores de TikTok */
.info { position: absolute; left: 14px; right: 74px; bottom: 16px; z-index: 3; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; pointer-events: none; }
.chip { background: rgba(10, 9, 18, .62); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.texto { font-size: 16px; font-weight: 700; line-height: 1.35; color: #fff; text-shadow: 0 2px 10px rgba(0, 0, 0, .7); }
.lleva { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #EDEAF7; text-shadow: 0 2px 8px rgba(0, 0, 0, .7); }
.lleva .ico { width: 18px; height: 18px; color: var(--piel); flex: none; }
.info .conseguir { pointer-events: auto; padding: 8px 14px; border-radius: 999px; background: var(--piel); color: #0A0912; font-weight: 800; font-size: 13px; box-shadow: 0 6px 20px rgba(0, 0, 0, .4); }
/* los botones a la derecha, a media altura, entre el encabezado de TikTok y sus contadores */
.riel { position: absolute; right: 8px; top: calc(50% - 70px); transform: translateY(-50%); z-index: 4; display: flex; flex-direction: column; gap: 10px; }
.accion { display: flex; flex-direction: column; align-items: center; gap: 3px; color: #fff; }
.accion .boli { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: rgba(10, 9, 18, .55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, .14); transition: transform .15s; }
.accion:active .boli { transform: scale(.9); }
.accion .ico { width: 24px; height: 24px; }
.accion small { font-size: 10.5px; font-weight: 800; text-shadow: 0 1px 6px rgba(0, 0, 0, .9); white-space: nowrap; }
.accion.si { color: var(--rosa); }
.accion.si .ico { fill: var(--rosa); animation: late .4s ease; }
.estallido { position: absolute; left: 50%; top: 45%; z-index: 5; pointer-events: none; color: var(--rosa); animation: estalla .8s var(--ease) forwards; }
.estallido .ico { width: 120px; height: 120px; fill: var(--rosa); filter: drop-shadow(0 0 30px rgba(255, 61, 110, .7)); }
@keyframes estalla { 0% { transform: translate(-50%, -50%) scale(.3); opacity: 0; } 30% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } 100% { transform: translate(-50%, -80%) scale(1); opacity: 0; } }
/* debajo del encabezado de TikTok, que ocupa unos 90 px arriba */
.pide-sonido { position: absolute; top: 100px; left: 50%; transform: translateX(-50%); z-index: 6; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; background: rgba(10, 9, 18, .75); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, .14); color: #fff; font-weight: 800; font-size: 14px; white-space: nowrap; animation: aparece .5s ease 1.2s both; }
.pide-sonido .ico { width: 18px; height: 18px; }
.desliza { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%); z-index: 6; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 20px; border-radius: 22px; background: rgba(10, 9, 18, .55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); font-weight: 800; white-space: nowrap; animation: aparece .6s ease 2.5s both; }
/* si el video no cargo, su respaldo pone Verlo en TikTok al centro; el aviso baja para no taparlo */
.desliza.bajo { top: 74%; }
.desliza span { width: 30px; height: 48px; border-radius: 16px; border: 3px solid #fff; position: relative; }
.desliza span::after { content: ''; position: absolute; left: 50%; top: 9px; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: #fff; animation: dedo 1.4s ease-in-out infinite; }
@keyframes dedo { 0% { transform: translateY(18px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-3px); opacity: 0; } }
.vacio { display: grid; place-items: center; }
.vacio i { width: 46px; height: 46px; border-radius: 50%; border: 4px solid rgba(255, 255, 255, .15); border-top-color: var(--piel); animation: gira .8s linear infinite; }
@keyframes gira { to { transform: rotate(360deg); } }
.cerrar-g { margin-top: 18px; width: 100%; }
@media (max-height: 680px) { .accion small { display: none; } .riel { gap: 8px; } .accion .boli { width: 42px; height: 42px; } }

/* En la computadora el video va en tarjeta 9 por 16 y los botones al lado, como TikTok en la web. */
@media (min-width: 900px) {
  .feed { --alto-item: 100dvh; --marco-alto: min(calc(100dvh - 48px), calc((100vw - 590px - 200px) * 16 / 9)); }
  .pista { margin-top: 0; }
  .marco { width: calc(var(--marco-alto) * 9 / 16); height: var(--marco-alto); border-radius: 22px; box-shadow: 0 40px 120px rgba(0, 0, 0, .6), 0 0 0 1px var(--borde); }
  /* el video siempre al centro, y los botones pegados a su lado derecho, abajo */
  .riel { left: calc(50% + var(--marco-alto) * 9 / 32 + 16px); right: auto; top: auto; bottom: calc(50% - var(--marco-alto) / 2 + 20px); transform: none; gap: 14px; }
  .accion { color: var(--tinta); }
  .accion .boli { width: 50px; height: 50px; background: var(--alto); border-color: var(--borde); backdrop-filter: none; }
  .accion small { text-shadow: none; color: var(--suave); }
  .movil { display: none; }
  .desliza::after { content: 'o usa las flechas del teclado'; font-size: 13px; font-weight: 700; color: var(--suave); }
  .pide-sonido { top: 92px; }
}
@media (min-width: 900px) and (max-width: 1279px) {
  .feed { --marco-alto: min(calc(100dvh - 48px), calc((100vw - 250px - 200px) * 16 / 9)); }
  .movil { display: flex; }
}
</style>
