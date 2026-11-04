<script setup>
import { ref, computed } from 'vue'
import { api } from '../api.js'
import { estado, ponerYo } from '../estado.js'

// La entrada, tres toques. Que ves en redes, como te dicen y a deslizar.
const paso = ref(1)
const elegidos = ref([])
const alias = ref('')
const enviando = ref(false)
const error = ref('')
const temas = computed(() => estado.temas)

// Al pasar al paso 2 los temas se mandan ya, y el feed empieza a cargar los primeros videos
// detras mientras la persona escribe su alias: al tocar Empezar el primer video ya esta listo.
// Antes se mandaba todo junto al final y el primer video tardaba unos 3 segundos (04-11).
let temasMandados = null
function seguir() {
  paso.value = 2
  temasMandados = api.entrada('', elegidos.value).then(p => { ponerYo(p); estado.temasListos = true; return true }).catch(() => false)
}
function tocar(t) {
  const i = elegidos.value.indexOf(t)
  if (i >= 0) elegidos.value.splice(i, 1)
  else if (elegidos.value.length < 3) elegidos.value.push(t)
}
async function empezar(saltar) {
  error.value = ''
  // José queda jose y Juan Pablo queda juan_pablo, en vez de un error por una tilde o un espacio
  const a = saltar ? '' : alias.value.trim().toLowerCase().replace(/^@/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_')
  if (!saltar) alias.value = a
  if (!saltar && !/^[a-z0-9._]{3,20}$/.test(a)) {
    error.value = 'Usa de 3 a 20 letras, números, punto o guion bajo'
    return
  }
  enviando.value = true
  try {
    const ya = temasMandados ? await temasMandados : false
    const p = await api.entrada(a, ya ? [] : elegidos.value)
    p.entro = true
    ponerYo(p)
  } catch (e) {
    error.value = e.message
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="velo entrada" v-if="!estado.yo?.entro">
    <div class="hoja">
      <template v-if="paso === 1">
        <p class="etiqueta">1 de 2</p>
        <h2 class="titulo">¿Qué te sale en redes?</h2>
        <p class="sub">Elige hasta tres. Después lectortie aprende solo con lo que veas.</p>
        <div class="temas">
          <button v-for="t in temas" :key="t.clave" class="tema" :class="{ si: elegidos.includes(t.clave) }" :style="{ '--c': t.color }" @click="tocar(t.clave)">
            <i></i>{{ t.nombre }}
          </button>
        </div>
        <button class="boton" :disabled="!elegidos.length" @click="seguir">Seguir</button>
      </template>
      <template v-else>
        <p class="etiqueta">2 de 2</p>
        <h2 class="titulo">¿Cómo te dicen?</h2>
        <p class="sub">Es tu nombre en el ranking. Sin correo ni contraseña.</p>
        <label class="campo-alias"><span>@</span><input v-model="alias" class="campo" maxlength="20" placeholder="sofi.lee" autocomplete="off" autocapitalize="off" @keyup.enter="empezar(false)"></label>
        <p class="error" v-if="error">{{ error }}</p>
        <button class="boton" :disabled="enviando" @click="empezar(false)">Empezar a deslizar</button>
        <button class="saltar" :disabled="enviando" @click="empezar(true)">Ahora no</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.entrada { z-index: 85; }
.hoja { display: flex; flex-direction: column; gap: 16px; }
.titulo { font-size: 46px; }
.sub { color: var(--suave); font-size: 16px; line-height: 1.45; }
.temas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 6px 0 8px; }
.tema { display: flex; align-items: center; gap: 10px; padding: 16px 14px; border-radius: 18px; background: var(--alto); border: 2px solid transparent; font-weight: 800; font-size: 16px; text-align: left; transition: border-color .2s, background .2s, transform .15s; }
.tema i { width: 14px; height: 14px; border-radius: 50%; background: var(--c); flex: none; }
.tema.si { border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, var(--alto)); }
.tema:active { transform: scale(.97); }
.campo-alias { position: relative; display: block; }
.campo-alias span { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); color: var(--gris); font-weight: 800; }
.campo-alias .campo { padding-left: 38px; }
.error { color: #FF8FA8; font-weight: 700; font-size: 14px; }
.saltar { color: var(--gris); font-weight: 700; padding: 8px; }
</style>
