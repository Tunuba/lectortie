<script>
import { reactive } from 'vue'
// Lo que saben todos los reproductores juntos. Si alguno ya cargo, TikTok responde y vale la
// pena esperar; si ninguno ha cargado y uno ya se dio por caido, TikTok esta bloqueado en esta
// red y todos, tambien los de abajo, pasan al respaldo en unos segundos.
const red = reactive({ algunoListo: false, caido: false })
const bloqueado = () => !red.algunoListo && red.caido
// Un solo vigia para toda la pagina: si 20 segundos despues del primer reproductor no ha cargado
// ninguno, TikTok esta bloqueado en esta red. Sin esto, quien deslizaba cada tres segundos nunca
// se quedaba quince en uno y veia ruedas girando sin fin (04-11).
let vigia = 0
function vigilarRed() {
  if (vigia || red.algunoListo) return
  vigia = setTimeout(() => { if (!red.algunoListo) red.caido = true }, 20000)
}
</script>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'

// Un video de TikTok con el reproductor oficial. Se maneja por postMessage, con play, pausa
// y sonido, y avisa cuando el video da otra vuelta. Si TikTok dice que fallo, o si el video que
// se esta viendo no carga en quince segundos, avisa para que el feed ponga el respaldo. El reloj
// solo corre mientras el video esta a la vista: el de abajo se carga de antemano y antes se
// daba por caido si la persona se quedaba mas de quince segundos en el de arriba con la red lenta.
//
// El sonido. El reproductor que se carga de antemano arranca en silencio la primera vez que
// suena, y eso pisaba el unMute que le mandabamos al llegar. Ahora se escucha lo que TikTok
// dice de su sonido, y si se silencia mientras la persona quiere oir, se le vuelve a pedir.
const props = defineProps({ id: { type: String, required: true }, activo: Boolean, sonido: Boolean })
const emit = defineEmits(['falla', 'vuelta', 'listo'])
const marco = ref(null)
const listo = ref(false)
let ultimoT = 0
let espera = 0
let mudo = null
let pedidos = 0
let sono = false // ya llego a reproducirse alguna vez
let reintentos = 0

const src = computed(() => `https://www.tiktok.com/player/v1/${props.id}?autoplay=1&loop=1&controls=0&progress_bar=1&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`)

function mandar(type, value) {
  const w = marco.value && marco.value.contentWindow
  if (!w) return
  w.postMessage({ type, value, 'x-tiktok-player': true }, 'https://www.tiktok.com')
}
function aplicar() {
  if (!listo.value) return
  if (props.activo) {
    pedidos = 0
    mandar('play')
    mandar(props.sonido ? 'unMute' : 'mute')
  } else {
    mandar('pause')
  }
}
// si quiere oir y TikTok se quedo en silencio, se le pide otra vez, con tope para no pelear
function cuidarSonido() {
  if (props.activo && props.sonido && mudo !== false && pedidos < 4) {
    pedidos++
    setTimeout(() => { if (props.activo && props.sonido && mudo !== false) mandar('unMute') }, 120)
  }
}
function alMensaje(e) {
  if (e.origin !== 'https://www.tiktok.com' || !marco.value || e.source !== marco.value.contentWindow) return
  let d = e.data
  if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return } }
  if (!d || !d['x-tiktok-player']) return
  if (d.type === 'onPlayerReady') {
    listo.value = true
    red.algunoListo = true
    red.caido = false
    clearTimeout(espera)
    emit('listo')
    aplicar()
  } else if (d.type === 'onMute') {
    mudo = d.value === true
    if (mudo) cuidarSonido()
  } else if (d.type === 'onStateChange') {
    if (d.value === 1) { sono = true; reintentos = 0; cuidarSonido() }
  } else if (d.type === 'onCurrentTime' && d.value) {
    const t = Number(d.value.currentTime) || 0
    if (t + 1 < ultimoT) emit('vuelta')
    ultimoT = t
  } else if (d.type === 'onPlayerError' || d.type === 'onError') {
    // Solo un video que no existe pasa al respaldo para siempre, como el borrado del 04-11, que
    // da 1001 INVALID_VIDEO. Al deslizar rapido a un video se le manda play y enseguida pause, y
    // TikTok contesta 3001 PLAYBACK_ERROR o un onError 1; antes eso lo daba por caido y salia
    // "Este video no cargo aqui" con TikTok funcionando. Ahora se le pide play otra vez, y si a
    // la vista nunca llega a reproducirse despues de dos intentos, ahi si pasa al respaldo.
    const cod = Number(d.value && (d.value.errorCode ?? d.value))
    if (cod >= 1000 && cod < 2000) { emit('falla'); return }
    if (!props.activo || sono) return
    if (reintentos < 2) {
      reintentos++
      setTimeout(() => { if (props.activo && !sono) mandar('play') }, 700)
    } else emit('falla')
  }
}
watch(() => [props.activo, props.sonido], aplicar)
function esperarListo() {
  clearTimeout(espera)
  if (listo.value) return
  if (!props.activo && !bloqueado()) return // fuera de la vista no se da por caido a nadie
  espera = setTimeout(() => {
    if (listo.value || (!props.activo && !bloqueado())) return
    if (!red.algunoListo) red.caido = true
    emit('falla')
  }, bloqueado() ? 300 : 15000) // con TikTok ya bloqueado, el respaldo sale enseguida
}
watch(() => props.activo, esperarListo)
watch(bloqueado, b => { if (b) esperarListo() })
onMounted(() => {
  window.addEventListener('message', alMensaje)
  vigilarRed()
  esperarListo()
})
// Al ir a leer, keep-alive saca el feed del documento: el reproductor se queda sin cargar y el
// reloj de quince segundos seguia corriendo, asi que al volver el video de abajo salia como
// que no cargo (04-11). Afuera el reloj se para, y al volver el navegador recarga el
// reproductor, asi que se espera otra vez a que diga que esta listo.
let fuera = false
onDeactivated(() => { fuera = true; clearTimeout(espera) })
onActivated(() => {
  if (!fuera) return
  fuera = false
  listo.value = false
  mudo = null
  ultimoT = 0
  sono = false
  reintentos = 0
  esperarListo()
})
onBeforeUnmount(() => {
  window.removeEventListener('message', alMensaje)
  clearTimeout(espera)
})
</script>

<template>
  <div class="tk">
    <iframe ref="marco" :src="src" title="Video de TikTok" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>
    <div class="tk-carga" v-if="!listo"><i></i></div>
  </div>
</template>

<style scoped>
.tk { position: absolute; inset: 0; background: #000; }
iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.tk-carga { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--piel) 22%, #12101C), #000 70%); }
.tk-carga i { width: 46px; height: 46px; border-radius: 50%; border: 4px solid rgba(255, 255, 255, .15); border-top-color: var(--piel); animation: gira .8s linear infinite; }
@keyframes gira { to { transform: rotate(360deg); } }
</style>
