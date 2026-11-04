<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../api.js'
import { avisar } from '../estado.js'
import Icono from '../componentes/Icono.vue'

// La comunidad, el ranking de la semana y lo que pasa ahora mismo, en vivo por el servidor.
const d = ref(null)
const eventos = ref([])
const conectado = ref(false)
let es = null

function hace(f) {
  const s = Math.max(1, Math.round((Date.now() - new Date(f)) / 1000))
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  return `hace ${Math.round(s / 86400)} d`
}
onMounted(async () => {
  try {
    d.value = await api.comunidad()
    eventos.value = d.value.eventos.map((e, i) => ({ ...e, k: 'e' + i }))
  } catch (e) { avisar(e.message, 'mal') }
  es = new EventSource('/api/vivo')
  es.onopen = () => { conectado.value = true }
  es.onerror = () => { conectado.value = false }
  es.onmessage = m => {
    try {
      const e = JSON.parse(m.data)
      eventos.value.unshift({ ...e, k: 'n' + Date.now(), nuevo: true })
      eventos.value = eventos.value.slice(0, 40)
    } catch { /* latido */ }
  }
})
onBeforeUnmount(() => { if (es) es.close() })
</script>

<template>
  <div class="pagina">
    <p class="etiqueta">Esta semana</p>
    <h1 class="titulo grande">Comunidad</h1>
    <div class="cifras" v-if="d">
      <div class="tarjeta"><b>{{ d.semana.lectores }}</b><span>lectores activos</span></div>
      <div class="tarjeta"><b>{{ d.semana.paginas }}</b><span>páginas leídas</span></div>
      <div class="tarjeta"><b>{{ d.semana.terminadas }}</b><span>lecturas terminadas</span></div>
    </div>

    <h2 class="sec">Ranking</h2>
    <ol class="ranking" v-if="d && d.ranking.length">
      <li v-for="(r, i) in d.ranking" :key="r.alias" :class="{ yo: r.yo, podio: i < 3 }">
        <span class="pos">{{ i + 1 }}</span>
        <div><b>@{{ r.alias }}</b><small>Nivel {{ r.nivel }}, {{ r.terminadas }} terminadas</small></div>
        <span class="pag">{{ r.paginas }} pág</span>
        <span class="racha"><Icono n="llama" />{{ r.racha }}</span>
      </li>
    </ol>
    <p v-else class="vacio">Nadie ha leído esta semana. Termina una lectura y aparece tu nombre aquí.</p>

    <h2 class="sec">Ahora mismo <i :class="{ on: conectado }"></i></h2>
    <ul class="vivo">
      <li v-for="e in eventos" :key="e.k" :class="{ nuevo: e.nuevo }"><Icono :n="e.tipo === 'termino' ? 'llama' : e.tipo === 'comento' ? 'correo' : 'chispa'" />{{ e.texto }}<span>{{ hace(e.creado) }}</span></li>
    </ul>
  </div>
</template>

<style scoped>
.grande { font-size: 60px; margin: 10px 0 20px; }
.cifras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.cifras .tarjeta { padding: 16px 14px; display: flex; flex-direction: column; gap: 4px; }
.cifras b { font: 900 40px/1 var(--tit); color: var(--piel); }
.cifras span { color: var(--gris); font-size: 13px; font-weight: 700; }
.sec { font: 900 30px/1 var(--tit); text-transform: uppercase; margin: 30px 0 14px; display: flex; align-items: center; gap: 10px; }
.sec i { width: 10px; height: 10px; border-radius: 50%; background: var(--gris); }
.sec i.on { background: var(--vivo); box-shadow: 0 0 12px var(--vivo); animation: late 1.6s ease infinite; }
.ranking { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.ranking li { display: grid; grid-template-columns: 40px 1fr auto auto; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 18px; background: var(--panel); border: 1px solid var(--borde); }
.ranking li.yo { border-color: var(--piel); background: color-mix(in srgb, var(--piel) 12%, var(--panel)); }
.pos { font: 900 26px/1 var(--tit); color: var(--gris); text-align: center; }
.podio .pos { color: var(--oro); }
.ranking small { display: block; color: var(--gris); font-size: 12px; margin-top: 2px; }
.pag { font-weight: 800; }
.racha { display: flex; align-items: center; gap: 4px; font-weight: 800; color: var(--oro); }
.racha .ico { width: 18px; height: 18px; }
.vacio { color: var(--gris); line-height: 1.5; }
.vivo { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.vivo li { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 16px; background: var(--panel); border: 1px solid var(--borde); font-size: 15px; }
.vivo li .ico { width: 18px; height: 18px; color: var(--piel); }
.vivo li span { margin-left: auto; color: var(--gris); font-size: 12px; white-space: nowrap; }
.vivo li.nuevo { animation: entra .6s var(--ease); border-color: var(--piel); }
@keyframes entra { from { opacity: 0; transform: translateY(-12px); } }
</style>
