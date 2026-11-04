<script setup>
import { computed } from 'vue'
import { estado } from '../estado.js'
import Icono from './Icono.vue'

// La micro lectura que sale despues de tres videos. Mientras el servidor la elige se ve como
// la app lee lo que acabas de ver; despues aparece el texto con el motivo escrito.
const props = defineProps({ item: Object })
const emit = defineEmits(['leer'])
const m = computed(() => props.item.micro)
const barras = computed(() => (estado.gustos || []).filter(g => g.peso > 0).slice(0, 4))
</script>

<template>
  <div class="micro" :style="{ '--c': m?.color || 'var(--piel)' }">
    <div v-if="!m" class="pensando">
      <p class="etiqueta">lectortie está leyendo lo que viste</p>
      <div class="barras">
        <div v-for="g in barras" :key="g.tema" :style="{ '--c': g.color }"><span>{{ g.nombre }}</span><i></i></div>
      </div>
      <p class="fallo" v-if="item.error">{{ item.error }}</p>
    </div>
    <article v-else class="hoja-micro">
      <p class="motivo"><Icono n="chispa" />{{ m.motivo }}</p>
      <p class="etiqueta">Para ti, en un minuto</p>
      <h2>{{ m.lectura.titulo }}</h2>
      <p class="autor">{{ m.lectura.autor }}</p>
      <div class="texto"><p>{{ m.lectura.micro }}</p></div>
      <button class="boton seguir" @click="emit('leer')"><Icono n="libro" />Seguir leyendo, {{ m.lectura.minutos }} min</button>
      <div class="moda" v-if="m.libro">
        <img :src="m.libro.portada" :alt="m.libro.titulo" loading="lazy">
        <p>Si te atrapa, en BookTok suena <b>{{ m.libro.titulo }}</b></p>
        <a class="conseguir" :href="`/ir/${m.libro.id}?desde=micro`" target="_blank" rel="noopener">Conseguir</a>
      </div>
    </article>
  </div>
</template>

<style scoped>
.micro { position: absolute; inset: 0; display: flex; align-items: safe center; justify-content: center; padding: 14px 14px; overflow-y: auto; background: radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--c) 30%, transparent), transparent 70%), var(--textura) 0 0 / var(--textura-tam), var(--fondo); }
.pensando { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px; animation: aparece .3s ease; }
.barras { display: flex; flex-direction: column; gap: 12px; }
.barras div { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 12px; font-weight: 700; font-size: 14px; }
.barras i { height: 12px; border-radius: 999px; background: var(--c); animation: mide 1s ease-in-out infinite alternate; transform-origin: left; }
.barras div:nth-child(2) i { animation-delay: .15s; } .barras div:nth-child(3) i { animation-delay: .3s; } .barras div:nth-child(4) i { animation-delay: .45s; }
@keyframes mide { from { transform: scaleX(.25); opacity: .6; } to { transform: scaleX(1); opacity: 1; } }
.fallo { color: #FF8FA8; font-weight: 700; }
.hoja-micro { width: 100%; max-width: 460px; max-height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 20px 20px; border-radius: 28px; background: #F6EFE3; color: #1D1A14; box-shadow: 0 30px 90px rgba(0, 0, 0, .6), 0 0 0 1px rgba(255, 255, 255, .06); animation: abre .6s var(--ease); overflow: hidden; }
@keyframes abre { from { opacity: 0; transform: translateY(30px) rotate(-2deg) scale(.95); } }
.motivo { display: flex; gap: 8px; align-items: flex-start; font-weight: 800; font-size: 14px; line-height: 1.35; color: #3B2BB0; background: rgba(91, 61, 245, .1); padding: 10px 12px; border-radius: 14px; }
.motivo .ico { width: 18px; height: 18px; flex: none; margin-top: 1px; }
.hoja-micro .etiqueta { color: #7A715F; margin-top: 4px; }
h2 { font: 900 34px/1 var(--tit); text-transform: uppercase; color: #14110C; }
.autor { font-family: var(--cita); font-style: italic; color: #5C5444; }
/* el texto es lo unico que se encoge si la pantalla es baja, el boton y el libro siempre se ven */
.texto { position: relative; overflow: hidden; flex: 0 1 auto; min-height: 70px; max-height: 34vh; }
.motivo, .etiqueta, h2, .autor, .seguir, .moda { flex: none; }
.texto p { font: 400 19px/1.55 var(--libro); color: #2A251C; }
.texto::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 70px; background: linear-gradient(transparent, #F6EFE3); }
.seguir { background: #14110C; color: #F6EFE3; margin-top: 6px; }
.moda { display: flex; gap: 12px; align-items: center; padding-top: 10px; border-top: 1px solid rgba(20, 17, 12, .12); }
.moda img { width: 40px; height: 60px; object-fit: cover; border-radius: 6px; flex: none; }
.moda p { font-size: 14px; line-height: 1.35; color: #5C5444; }
.moda b { color: #14110C; }
.moda p { flex: 1; }
.conseguir { flex: none; padding: 8px 14px; border-radius: 999px; background: #14110C; color: #F6EFE3; font-weight: 800; font-size: 13px; }
</style>
