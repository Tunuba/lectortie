<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { estado, ponerYo, avisar, empezarALeer, dejarDeLeer } from '../estado.js'
import Icono from '../componentes/Icono.vue'

// La sesion de lectura. Una pagina por pantalla, el reloj corre solo con la pestana a la
// vista, y al terminar se prende la racha. Si la persona se va a medias, se guarda lo leido.
const route = useRoute()
const router = useRouter()
const d = ref(null)
const pag = ref(0)
const fin = ref(false)
const resultado = ref(null)
const texto = ref('')
const comentarios = ref([])
const ellis = ref(false)
let seg = 0
let t = 0
let guardado = false
const segundos = ref(0)

const total = computed(() => (d.value ? d.value.lectura.paginas.length : 1))
const avance = computed(() => Math.round(((pag.value + 1) / total.value) * 100))

function correr() {
  clearInterval(t)
  t = setInterval(() => { if (!document.hidden) { seg++; segundos.value = seg } }, 1000)
}
function siguiente() {
  if (pag.value < total.value - 1) { pag.value++; window.scrollTo({ top: 0, behavior: 'smooth' }) }
  else terminar()
}
function anterior() { if (pag.value > 0) pag.value-- }

async function terminar() {
  if (guardado) return
  // la racha se prende leyendo de verdad, unos segundos por pagina
  const falta = (d.value.minimo || 0) - seg
  if (falta > 0) {
    avisar(`Léela con calma, te faltan ${falta} ${falta === 1 ? 'segundo' : 'segundos'} para que cuente`)
    return
  }
  guardado = true
  clearInterval(t)
  try {
    const p = await api.terminar(d.value.lectura.id, { segundos: seg, paginas: total.value, terminada: true })
    p.entro = true
    ponerYo(p)
    resultado.value = p
    if (typeof p.lectores === 'number') d.value.lectores = p.lectores
    fin.value = true
    if (p.contada) estado.terminada = d.value.lectura.id
    if (p.contada && !p.encuesta) setTimeout(() => { ellis.value = true }, 1800)
  } catch (e) {
    guardado = false
    avisar(e.message, 'mal')
  }
}
function otraVez() {
  fin.value = false
  guardado = false
  pag.value = 0
  seg = 0
  segundos.value = 0
  correr()
  window.scrollTo({ top: 0 })
}
async function responderEllis(r) {
  ellis.value = false
  try { await api.ellis(r); if (estado.yo) estado.yo.encuesta = true; avisar('Gracias, eso nos ayuda a mejorar') } catch (e) { avisar(e.message, 'mal') }
}
async function comentar() {
  const x = texto.value.trim()
  if (!x) return
  try {
    const c = await api.comentar(d.value.lectura.id, x)
    comentarios.value.unshift(c)
    texto.value = ''
  } catch (e) { avisar(e.message, 'mal') }
}
function teclas(e) {
  if (e.target.closest('input, textarea')) return
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (!fin.value) siguiente() }
  else if (e.key === 'ArrowLeft') anterior()
}

onMounted(async () => {
  empezarALeer()
  try {
    d.value = await api.lectura(route.params.id)
    comentarios.value = d.value.comentarios || []
    document.documentElement.style.setProperty('--piel', d.value.color)
    correr()
  } catch (e) {
    avisar(e.message, 'mal')
    router.replace('/')
  }
  window.addEventListener('keydown', teclas)
})
onBeforeUnmount(() => {
  clearInterval(t)
  window.removeEventListener('keydown', teclas)
  dejarDeLeer()
  if (!guardado && d.value && pag.value > 0) {
    api.terminar(d.value.lectura.id, { segundos: seg, paginas: pag.value, terminada: false }).then(ponerYo).catch(() => {})
  }
})
function hace(f) {
  const s = Math.max(1, Math.round((Date.now() - new Date(f)) / 1000))
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  return `hace ${Math.round(s / 86400)} d`
}
</script>

<template>
  <div class="lector" :class="{ leyendo: !fin }" v-if="d">
    <header class="cab">
      <button class="redondo" aria-label="Volver al feed" @click="router.push('/')"><Icono n="atras" /></button>
      <div class="avance"><i :style="{ width: (fin ? 100 : avance) + '%' }"></i></div>
      <span class="reloj"><Icono n="reloj" />{{ Math.floor(segundos / 60) }}:{{ String(segundos % 60).padStart(2, '0') }}</span>
    </header>

    <article v-if="!fin" class="papel" :key="pag">
      <template v-if="pag === 0">
        <p class="etiqueta">{{ d.temaNombre }}, {{ d.lectura.minutos }} min</p>
        <h1>{{ d.lectura.titulo }}</h1>
        <p class="autor">{{ d.lectura.autor }}</p>
      </template>
      <p v-for="(p, i) in d.lectura.paginas[pag]" :key="i" class="parrafo">{{ p }}</p>
      <p class="num">{{ pag + 1 }} de {{ total }}</p>
    </article>

    <div v-if="!fin" class="mandos">
      <button class="boton claro" :disabled="pag === 0" @click="anterior">Atrás</button>
      <button class="boton piel" @click="siguiente">{{ pag < total - 1 ? 'Siguiente página' : 'Terminé' }}<Icono n="flecha" /></button>
    </div>

    <section v-else-if="resultado && !resultado.contada" class="final">
      <p class="etiqueta">Fue muy rápido</p>
      <h1 class="titulo">Léela con calma</h1>
      <p class="sub">Guardamos lo que leíste. La racha se prende cuando le das unos segundos a cada página.</p>
      <button class="boton" @click="otraVez"><Icono n="otra" />Leerla otra vez</button>
      <button class="boton claro" @click="router.push('/')">Seguir deslizando</button>
    </section>

    <section v-else class="final">
      <div class="llamas"><Icono n="llama" /></div>
      <p class="etiqueta">Lo terminaste</p>
      <h1 class="titulo">{{ resultado?.racha || 1 }} {{ (resultado?.racha || 1) === 1 ? 'día' : 'días' }} de racha</h1>
      <p class="sub">{{ d.lectura.titulo }} en {{ Math.max(1, Math.round(segundos / 60)) }} min. Llevas {{ resultado?.paginas }} páginas y {{ resultado?.puntos }} puntos.</p>
      <div class="moda tarjeta" v-if="d.libro">
        <img :src="d.libro.portada" :alt="d.libro.titulo">
        <div><p class="etiqueta">El siguiente en tu ruta</p><b>{{ d.libro.titulo }}</b><p>{{ d.libro.gancho }}</p>
          <a class="boton claro conseguir" :href="`/ir/${d.libro.id}?desde=final`" target="_blank" rel="noopener"><Icono n="libro" />Conseguir el libro</a></div>
      </div>
      <button class="boton" @click="router.push('/')">Seguir deslizando</button>
      <button class="boton claro" @click="router.push('/comunidad')"><Icono n="comunidad" />Ver la comunidad</button>

      <div class="comentar">
        <p class="etiqueta">{{ d.lectores }} {{ d.lectores === 1 ? 'persona lo ha leído' : 'personas lo han leído' }}</p>
        <div class="fila"><input v-model="texto" class="campo" maxlength="280" placeholder="¿Qué te pareció?" @keyup.enter="comentar"><button class="boton piel" @click="comentar">Publicar</button></div>
        <ul>
          <li v-for="(c, i) in comentarios" :key="i"><b>@{{ c.alias }}</b> {{ c.texto }} <span>{{ hace(c.creado) }}</span></li>
        </ul>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="ellis" class="velo" @click.self="ellis = false">
        <div class="hoja ellis">
          <p class="etiqueta">Una pregunta rápida</p>
          <h2 class="titulo">¿Qué tan decepcionado estarías si lectortie desapareciera?</h2>
          <button class="boton" @click="responderEllis(1)">Muy decepcionado</button>
          <button class="boton claro" @click="responderEllis(2)">Algo decepcionado</button>
          <button class="boton claro" @click="responderEllis(3)">Nada, me da igual</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.lector { min-height: 100dvh; max-width: 720px; margin: 0 auto; padding: calc(12px + env(safe-area-inset-top)) 16px calc(30px + env(safe-area-inset-bottom)); }
/* sin fondo propio, que tapaba con una caja el brillo de la piel; al leer solo se mueve la hoja */
.cab { display: flex; align-items: center; gap: 14px; padding: 8px 0 14px; }
.avance { flex: 1; height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .08); overflow: hidden; }
.avance i { display: block; height: 100%; background: var(--piel); border-radius: 999px; transition: width .5s var(--ease); }
.reloj { display: flex; align-items: center; gap: 6px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--suave); }
.reloj .ico { width: 18px; height: 18px; }
.papel { background: #F6EFE3; color: #1D1A14; border-radius: 26px; padding: 30px 24px; box-shadow: 0 30px 90px rgba(0, 0, 0, .5); animation: hoja .45s var(--ease); }
@keyframes hoja { from { opacity: 0; transform: translateX(24px); } }
.papel .etiqueta { color: #7A715F; }
.papel h1 { font: 900 44px/.95 var(--tit); text-transform: uppercase; margin-top: 8px; color: #14110C; }
.autor { font-family: var(--cita); font-style: italic; color: #5C5444; margin: 6px 0 18px; font-size: 18px; }
.parrafo { font: 400 20px/1.7 var(--libro); color: #2A251C; margin-bottom: 16px; }
.num { text-align: right; font-size: 13px; color: #8A806C; font-weight: 700; }
.mandos { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; padding: 14px 0 calc(14px + env(safe-area-inset-bottom)); }
.mandos .boton.claro { background: var(--alto); }
.mandos .boton { padding: 0 14px; white-space: nowrap; }
.lector.leyendo { height: 100dvh; display: flex; flex-direction: column; padding-bottom: 0; }
.lector.leyendo .cab { flex: none; }
.lector.leyendo .papel { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(20, 17, 12, .25) transparent; }
.lector.leyendo .mandos { flex: none; }
.final { display: flex; flex-direction: column; gap: 16px; padding-top: 20px; text-align: center; align-items: center; }
.llamas { width: 120px; height: 120px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle, rgba(242, 193, 78, .35), transparent 70%); animation: late 1.2s ease-in-out infinite; }
.llamas .ico { width: 84px; height: 84px; color: var(--oro); fill: rgba(242, 193, 78, .25); }
.final .titulo { font-size: 56px; color: var(--oro); text-shadow: 0 0 40px rgba(242, 193, 78, .35); }
.final > .boton { min-width: 250px; }
.sub { color: var(--suave); line-height: 1.5; max-width: 460px; }
.moda { display: flex; gap: 14px; padding: 14px; text-align: left; width: 100%; }
.moda img { width: 64px; height: 96px; object-fit: cover; border-radius: 8px; flex: none; }
.moda b { display: block; font-size: 18px; margin: 4px 0; }
.moda p:last-of-type { color: var(--gris); font-size: 14px; line-height: 1.4; }
.moda .conseguir { min-height: 40px; padding: 0 16px; font-size: 14px; margin-top: 10px; }
.moda .conseguir .ico { width: 18px; height: 18px; }
.comentar { width: 100%; text-align: left; margin-top: 10px; display: flex; flex-direction: column; gap: 12px; }
.comentar .fila { display: flex; gap: 10px; }
.comentar ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.comentar li { background: var(--panel); border: 1px solid var(--borde); border-radius: 16px; padding: 12px 14px; line-height: 1.4; }
.comentar li span { color: var(--gris); font-size: 12px; margin-left: 6px; }
.ellis { display: flex; flex-direction: column; gap: 12px; text-align: center; }
.ellis .titulo { font-size: 34px; margin-bottom: 8px; }
@media (min-width: 900px) { .lector { padding-top: 30px; } .papel { padding: 44px 48px; } }
</style>
