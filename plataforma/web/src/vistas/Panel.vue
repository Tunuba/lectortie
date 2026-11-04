<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../api.js'

// El panel del equipo. Lo que el pitch decia que faltaba medir, medido de verdad desde la base.
const clave = ref(sessionStorage.getItem('panel') || '')
const d = ref(null)
const error = ref('')
let t = 0

async function cargar() {
  try {
    d.value = await api.panel(clave.value)
    sessionStorage.setItem('panel', clave.value)
    error.value = ''
  } catch (e) {
    error.value = e.codigo === 401 ? 'Esa no es la clave' : e.message
    d.value = null
  }
}
const embudo = computed(() => {
  if (!d.value) return []
  const e = d.value.embudo
  const pasos = [['Videos vistos', e.videos], ['Micro lecturas puestas', e.puestas], ['Abiertas', e.abiertas], ['Terminadas', e.terminadas], ['Clics a comprar', e.salidas || 0]]
  const max = Math.max(1, ...pasos.map(p => p[1]))
  return pasos.map(([n, v]) => ({ n, v, ancho: Math.max(2, Math.round(v / max * 100)) }))
})
const maxDia = computed(() => Math.max(1, ...((d.value && d.value.dias) || []).map(x => x.videos)))
onMounted(() => { if (clave.value) cargar(); t = setInterval(() => { if (d.value) cargar() }, 15000) })
onBeforeUnmount(() => clearInterval(t))
</script>

<template>
  <div class="pagina panel">
    <p class="etiqueta">Equipo lectortie</p>
    <h1 class="titulo grande">Lo que medimos</h1>
    <form v-if="!d" class="tarjeta entrar" @submit.prevent="cargar">
      <input v-model="clave" class="campo" type="password" placeholder="Clave del panel" autocomplete="current-password">
      <button class="boton">Ver el panel</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
    <template v-else>
      <div class="grandes">
        <div class="tarjeta"><span class="etiqueta">Vuelven en la semana</span><b>{{ d.retencion.pct }}%</b><small>{{ d.retencion.vuelven }} de {{ d.retencion.lectores }}. La meta del piloto es 40%</small></div>
        <div class="tarjeta"><span class="etiqueta">Sean Ellis, muy decepcionados</span><b>{{ d.ellis.pct }}%</b><small>{{ d.ellis.respuestas }} respuestas. Con 40% o más se persevera</small></div>
        <div class="tarjeta"><span class="etiqueta">Lectores</span><b>{{ d.embudo.lectores }}</b><small>{{ d.embudo.correos }} con correo, {{ d.embudo.ayuda }} pedidos de ayuda</small></div>
      </div>

      <section class="tarjeta bloque">
        <p class="etiqueta">Del video al libro</p>
        <div v-for="p in embudo" :key="p.n" class="emb"><span>{{ p.n }}</span><div><i :style="{ width: p.ancho + '%' }"></i></div><b>{{ p.v }}</b></div>
      </section>

      <section class="tarjeta bloque" v-if="d.buscados && d.buscados.length">
        <p class="etiqueta">Los libros que más quieren conseguir</p>
        <div v-for="b in d.buscados" :key="b.titulo" class="emb"><span>{{ b.titulo }}</span><div><i :style="{ width: Math.max(4, b.clics / d.buscados[0].clics * 100) + '%' }"></i></div><b>{{ b.clics }}</b></div>
      </section>

      <section class="tarjeta bloque">
        <p class="etiqueta">Por tema</p>
        <div class="tabla">
        <table>
          <thead><tr><th>Tema</th><th>Vistas</th><th>Se quedan</th><th>Saltan</th><th>Abiertas</th></tr></thead>
          <tbody>
            <tr v-for="t in d.temas" :key="t.tema"><td><i :style="{ background: t.color }"></i>{{ t.nombre }}</td><td>{{ t.vistas }}</td><td>{{ t.segundos }} s</td><td>{{ t.saltos }}%</td><td>{{ t.abiertas }} de {{ t.puestas }}</td></tr>
          </tbody>
        </table>
        </div>
      </section>

      <section class="tarjeta bloque">
        <p class="etiqueta">Últimos 30 días, videos vistos</p>
        <div class="dias"><i v-for="x in d.dias" :key="x.dia" :title="`${x.dia}, ${x.videos} videos, ${x.activos} activos`" :style="{ height: Math.max(2, x.videos / maxDia * 100) + '%' }"></i></div>
      </section>
      <p class="pie">Se actualiza cada 15 segundos.</p>
    </template>
  </div>
</template>

<style scoped>
.panel { max-width: 980px; }
.grande { font-size: 60px; margin: 10px 0 20px; }
.tabla { overflow-x: auto; margin: 0 -6px; }
.entrar { padding: 20px; display: flex; flex-direction: column; gap: 12px; max-width: 420px; }
.error { color: #FF8FA8; font-weight: 700; }
.grandes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.grandes .tarjeta { padding: 18px; display: flex; flex-direction: column; gap: 8px; }
.grandes b { font: 900 60px/1 var(--tit); color: var(--piel); }
.grandes small { color: var(--gris); line-height: 1.4; }
.bloque { padding: 20px; margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
.emb { display: grid; grid-template-columns: 180px 1fr 60px; gap: 12px; align-items: center; font-weight: 700; }
.emb div { height: 14px; border-radius: 999px; background: rgba(255, 255, 255, .06); overflow: hidden; }
.emb i { display: block; height: 100%; background: var(--vivo); border-radius: 999px; transition: width .8s var(--ease); }
.emb b { text-align: right; font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-size: 15px; }
th { text-align: left; color: var(--gris); font-size: 12px; text-transform: uppercase; letter-spacing: .1em; padding: 6px 8px; }
td { padding: 10px 8px; border-top: 1px solid var(--borde); font-variant-numeric: tabular-nums; }
td i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
td:first-child { white-space: nowrap; }
.dias { height: 140px; display: flex; align-items: flex-end; gap: 4px; }
.dias i { flex: 1; background: var(--piel); border-radius: 4px 4px 0 0; min-height: 2px; }
.pie { color: var(--gris); text-align: center; margin-top: 16px; }
@media (max-width: 700px) { .grandes { grid-template-columns: 1fr; } .emb { grid-template-columns: 1fr 60px; } .emb div { grid-column: 1 / -1; grid-row: 2; } table { font-size: 13px; } th { letter-spacing: .04em; padding: 6px 5px; } td { padding: 10px 5px; } }
</style>
