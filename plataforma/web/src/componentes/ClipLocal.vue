<script setup>
import { computed, watch, onBeforeUnmount, ref } from 'vue'
import Icono from './Icono.vue'

// El respaldo cuando un video de TikTok no carga. Si el video lleva libro, se arma un clip con
// la portada arriba y el gancho abajo, como un video corto de BookTok, que da vueltas de nueve
// segundos. Si no lleva libro, se dice que no cargo y se ofrece verlo en TikTok.
const props = defineProps({ libro: Object, texto: String, color: String, activo: Boolean, etiqueta: String, enlace: String })
const emit = defineEmits(['vuelta'])
const DURA = 9000
const vuelta = ref(0)
let t = 0
const palabras = computed(() => (props.texto || '').split(/\s+/).filter(Boolean))

function seguir() {
  clearInterval(t)
  if (!props.activo || !props.libro) return
  t = setInterval(() => { vuelta.value++; emit('vuelta') }, DURA)
}
watch(() => props.activo, seguir, { immediate: true })
onBeforeUnmount(() => clearInterval(t))
</script>

<template>
  <div class="clip" :class="{ activo }" :style="{ '--c': color }">
    <div class="fondo" :style="libro ? { backgroundImage: `url(${libro.portada})` } : {}"></div>
    <div class="luz"></div>
    <div v-if="libro" class="pila">
      <div class="portada" :key="'p' + vuelta"><img :src="libro.portada" :alt="libro.titulo"></div>
      <p class="gancho" :key="'g' + vuelta">
        <span v-for="(p, i) in palabras" :key="i" :style="{ animationDelay: (0.5 + i * 0.1) + 's' }">{{ p }}</span>
      </p>
    </div>
    <div v-else class="pila sin-libro">
      <p class="eti">{{ etiqueta }}</p>
      <p class="que">{{ texto }}</p>
      <p class="nota">Este video no cargó aquí</p>
      <a v-if="enlace" class="boton claro" :href="enlace" target="_blank" rel="noopener"><Icono n="afuera" />Verlo en TikTok</a>
    </div>
    <div v-if="libro" class="progreso"><i :key="'b' + vuelta"></i></div>
  </div>
</template>

<style scoped>
.clip { position: absolute; inset: 0; overflow: hidden; background: #07060C; }
.fondo { position: absolute; inset: -40px; background-size: cover; background-position: center; filter: blur(34px) saturate(1.4) brightness(.45); transform: scale(1.1); }
.luz { position: absolute; inset: 0; background: radial-gradient(60% 40% at 50% 28%, color-mix(in srgb, var(--c) 40%, transparent), transparent 70%), linear-gradient(180deg, transparent 50%, rgba(5, 4, 10, .9)); }
/* portada arriba y gancho abajo, en columna, para que el texto nunca vaya encima de la imagen */
.pila { position: absolute; left: 0; right: 0; top: 8%; bottom: 34%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 0 9%; }
.portada { height: min(52%, 330px); aspect-ratio: 2 / 3; flex: none; border-radius: 12px; overflow: hidden; transform: rotate(-3deg); box-shadow: 0 26px 70px rgba(0, 0, 0, .7), 0 0 50px color-mix(in srgb, var(--c) 45%, transparent); }
.portada img { width: 100%; height: 100%; object-fit: cover; }
.activo .portada { animation: acerca 9s ease-in-out both; }
@keyframes acerca { 0% { transform: rotate(-5deg) scale(.88); opacity: 0; } 8% { opacity: 1; } 100% { transform: rotate(2deg) scale(1.03); } }
.gancho { font: 900 clamp(22px, 3.4vh, 32px)/1.12 var(--tit); text-transform: uppercase; text-align: center; text-shadow: 0 4px 24px rgba(0, 0, 0, .8); }
.gancho span { display: inline-block; opacity: 0; margin-right: .26em; }
.activo .gancho span { animation: palabra .5s var(--ease) both; }
@keyframes palabra { from { opacity: 0; transform: translateY(14px) scale(.9); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
.sin-libro { gap: 14px; text-align: center; }
.eti { font: 900 clamp(40px, 7vh, 64px)/1 var(--tit); text-transform: uppercase; color: var(--c); }
.que { font-size: 19px; font-weight: 800; line-height: 1.3; max-width: 320px; }
.nota { color: var(--gris); font-size: 14px; font-weight: 700; }
.sin-libro .boton { position: relative; z-index: 6; margin-top: 6px; }
.progreso { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255, 255, 255, .15); }
.progreso i { display: block; height: 100%; width: 0; background: var(--c); }
.activo .progreso i { animation: barra 9s linear both; }
@keyframes barra { to { width: 100%; } }
</style>
