<script setup>
import { estado } from '../estado.js'
import Icono from './Icono.vue'

// Instalar lectortie como app. En Android sale el aviso del sistema; en iPhone se explica
// el camino por Compartir, porque Safari no deja hacerlo con un boton.
const emit = defineEmits(['cerrar'])
async function instalar() {
  const p = window.__instalar
  if (!p) return
  p.prompt()
  const r = await p.userChoice.catch(() => null)
  window.__instalar = null
  estado.instalable = false
  if (r && r.outcome === 'accepted') estado.instalada = true
  emit('cerrar')
}
</script>

<template>
  <Teleport to="body">
  <div class="velo" @click.self="emit('cerrar')">
    <div class="hoja inst">
      <button class="cerrar redondo" aria-label="Cerrar" @click="emit('cerrar')"><Icono n="cerrar" /></button>
      <img src="/iconos/icono-192.png" width="84" height="84" alt="" class="icono">
      <h2 class="titulo">lectortie en tu pantalla</h2>
      <p class="sub">Se abre a pantalla completa y sin la barra del navegador. Sin anuncios.</p>
      <button v-if="estado.instalable" class="boton" @click="instalar"><Icono n="descargar" />Instalar</button>
      <ol v-else-if="estado.ios">
        <li>Toca <b>Compartir</b> <Icono n="compartir" /> abajo en Safari</li>
        <li>Elige <b>Agregar a inicio</b> <Icono n="mas" /></li>
        <li>Toca <b>Agregar</b> y listo</li>
      </ol>
      <ol v-else>
        <li>Abre el menú del navegador, los tres puntos</li>
        <li>Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b></li>
      </ol>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.inst { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; }
.cerrar { position: absolute; right: 16px; top: 16px; }
.icono { border-radius: 22px; box-shadow: 0 18px 50px rgba(91, 61, 245, .45); }
.titulo { font-size: 40px; }
.sub { color: var(--suave); line-height: 1.45; max-width: 380px; }
ol { text-align: left; display: flex; flex-direction: column; gap: 12px; padding-left: 22px; font-size: 16px; line-height: 1.4; margin: 0; }
ol .ico { width: 18px; height: 18px; vertical-align: -3px; color: var(--piel); }
</style>
