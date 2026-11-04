<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { estado, tiempo } from '../estado.js'
import Icono from './Icono.vue'

// El gusto en vivo. Cada video que pasas mueve estas barras, y la barra de arriba es la que
// decide la proxima lectura. Es el algoritmo a la vista, sin esconder nada.
const props = defineProps({ compacto: Boolean })
const router = useRouter()
const filas = computed(() => {
  const por = Object.fromEntries((estado.gustos || []).map(g => [g.tema, g]))
  const lista = (estado.temas || []).map(t => ({ tema: t.clave, nombre: t.nombre, color: t.color, peso: por[t.clave]?.peso || 0, segundos: por[t.clave]?.segundos || 0 }))
  lista.sort((a, b) => b.peso - a.peso)
  const max = Math.max(4, ...lista.map(f => f.peso))
  return lista.map(f => ({ ...f, ancho: Math.max(3, Math.round(Math.max(0, f.peso) / max * 100)) }))
})
const top = computed(() => filas.value.find(f => f.peso > 0))
const ultimo = computed(() => estado.ultimo)
</script>

<template>
  <section class="gusto" :class="{ compacto: props.compacto }">
    <p class="etiqueta">Tu gusto en vivo</p>
    <h2 class="titulo">{{ top ? top.nombre : 'Aprendiendo' }}</h2>
    <p class="explica">Medimos cuánto te quedas en cada video. Lo que más te atrapa decide tu próxima lectura.</p>
    <div v-if="ultimo" :key="ultimo.k" class="ultimo" :style="{ '--c': ultimo.color }">
      <Icono n="chispa" /><span>{{ ultimo.texto }}</span>
    </div>
    <ul>
      <li v-for="f in filas" :key="f.tema" :style="{ '--c': f.color }">
        <div class="fila"><span>{{ f.nombre }}</span><b>{{ tiempo(f.segundos) }}</b></div>
        <div class="barra"><i :style="{ width: f.ancho + '%' }"></i></div>
      </li>
    </ul>
    <button class="por-dentro" @click="router.push('/motor')"><Icono n="chispa" />Así funciona por dentro</button>
  </section>
</template>

<style scoped>
.gusto { display: flex; flex-direction: column; gap: 12px; }
.titulo { font-size: 44px; color: var(--piel); transition: color .8s; }
.explica { color: var(--gris); font-size: 15px; line-height: 1.45; }
.ultimo { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 16px; background: color-mix(in srgb, var(--c) 16%, transparent); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); font-weight: 700; font-size: 14px; animation: llega .5s var(--ease); }
.ultimo .ico { color: var(--c); }
@keyframes llega { from { opacity: 0; transform: translateY(-8px) scale(.97); } }
ul { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.fila { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-bottom: 6px; }
.fila b { color: var(--gris); font-weight: 600; font-variant-numeric: tabular-nums; }
.barra { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, .06); overflow: hidden; }
.barra i { display: block; height: 100%; border-radius: 999px; background: var(--c); box-shadow: 0 0 14px color-mix(in srgb, var(--c) 70%, transparent); transition: width .9s var(--ease); }
.compacto .titulo { font-size: 34px; }
.por-dentro { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-weight: 800; font-size: 14px; color: var(--piel); align-self: flex-start; padding: 6px 0; }
.por-dentro .ico { width: 18px; height: 18px; }
</style>
