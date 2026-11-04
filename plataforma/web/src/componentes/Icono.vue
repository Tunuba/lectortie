<script setup>
// Iconos de linea, todos del mismo grosor. Se pintan con currentColor.
defineProps({ n: { type: String, required: true } })
const P = {
  inicio: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  comunidad: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3',
  perfil: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 22a9 9 0 0 1 18 0',
  descargar: 'M12 3v12M7 10l5 5 5-5M4 19h16',
  corazon: 'M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 5.6 5 5 0 0 1 21.2 11C19 15.6 12 20 12 20z',
  sonido: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  mudo: 'M11 5L6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6',
  libro: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7',
  llama: 'M12 22c4 0 7-2.7 7-7 0-3.5-2.3-6-4-8-.5 2-1.7 3-3 3 .5-3-1-6-4-8 .3 3.5-3 6-3 10.5C5 19.3 8 22 12 22z',
  cerrar: 'M6 6l12 12M18 6L6 18',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  atras: 'M19 12H5M11 6l-6 6 6 6',
  ayuda: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5M12 17h.01',
  correo: 'M3 6h18v12H3zM3 7l9 6 9-6',
  chispa: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  panel: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  compartir: 'M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  mas: 'M12 5v14M5 12h14',
  reloj: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2',
  afuera: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  otra: 'M4 4v6h6M20 20v-6h-6M5.5 15a7.5 7.5 0 0 0 13 2.5M18.5 9A7.5 7.5 0 0 0 5.5 6.5'
}
</script>

<template>
  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path :d="P[n]" /></svg>
</template>
