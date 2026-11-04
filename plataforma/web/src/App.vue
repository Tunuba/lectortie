<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from './api.js'
import { estado, ponerYo, avisar } from './estado.js'
import Icono from './componentes/Icono.vue'
import Gusto from './componentes/Gusto.vue'
import Entrada from './componentes/Entrada.vue'
import Instalar from './componentes/Instalar.vue'

const route = useRoute()
const router = useRouter()
const verInstalar = ref(false)
const enFeed = computed(() => route.name === 'feed')
const necesitaEntrada = computed(() => estado.listo && estado.yo && !estado.yo.alias && estado.yo.videos === 0 && route.name !== 'panel' && route.name !== 'motor')
const racha = computed(() => (estado.yo && estado.yo.racha) || 0)
const puedeInstalar = computed(() => !estado.instalada && (estado.instalable || estado.ios || true))

// Sin esta primera llamada no hay sesion y todo lo demas responde 401. Si falla por la red,
// por el tunel o por ir muy rapido, se reintenta unos segundos antes de rendirse.
const pausa = ms => new Promise(r => setTimeout(r, ms))
async function saludar() {
  for (let i = 0; ; i++) {
    try {
      ponerYo(await api.hola())
      return
    } catch (e) {
      const pasajero = e.codigo === 0 || e.codigo === 429 || e.codigo >= 500
      if (!pasajero || i >= 5) { avisar(e.message, 'mal'); return }
      if (i === 0) avisar('Conectando con lectortie')
      await pausa(1500 * (i + 1))
    }
  }
}

onMounted(async () => {
  try {
    await saludar()
  } finally {
    estado.listo = true
  }
  const q = new URLSearchParams(location.search)
  const en = q.get('entrada')
  if (en) {
    if (en === 'ok') avisar('Listo, tu racha quedó guardada en tu correo')
    else if (en === 'vencido') avisar('Ese enlace ya se usó o venció, pide otro', 'mal')
    else avisar('No pudimos abrir ese enlace', 'mal')
    router.replace({ path: route.path, query: {} })
  }
})
</script>

<template>
  <div class="app" :class="{ 'sin-derecha': !enFeed, 'en-feed': enFeed, 'en-leer': route.name === 'leer' }">
    <aside class="lado">
      <router-link to="/" class="marca"><img src="/favicon.svg" width="34" height="34" alt=""><b>lector<span>tie</span></b></router-link>
      <nav>
        <router-link to="/"><Icono n="inicio" />Para ti</router-link>
        <router-link to="/comunidad"><Icono n="comunidad" />Comunidad</router-link>
        <router-link to="/perfil"><Icono n="perfil" />Tu perfil</router-link>
        <router-link to="/motor"><Icono n="chispa" />Por dentro</router-link>
      </nav>
      <div class="pie">
        <div class="tarjeta racha-lado" v-if="estado.yo">
          <Icono n="llama" class="llama" />
          <div><b>{{ racha }} {{ racha === 1 ? 'día' : 'días' }}</b><span>de racha</span></div>
        </div>
        <button class="boton claro" v-if="puedeInstalar" @click="verInstalar = true"><Icono n="descargar" />Instalar</button>
      </div>
    </aside>

    <header class="barra-sup" v-if="route.name !== 'leer'">
      <router-link to="/" class="marca">lector<span>tie</span></router-link>
      <div class="acciones">
        <router-link to="/perfil" class="redondo racha" :aria-label="`Racha de ${racha} días`"><Icono n="llama" class="llama" />{{ racha }}</router-link>
        <button class="redondo" v-if="puedeInstalar" aria-label="Instalar lectortie" @click="verInstalar = true"><Icono n="descargar" /></button>
      </div>
    </header>

    <main class="principal">
      <router-view v-slot="{ Component }">
        <keep-alive include="Feed"><component :is="Component" /></keep-alive>
      </router-view>
    </main>

    <aside class="derecha" v-if="enFeed"><Gusto /></aside>

    <nav class="tabs" v-if="route.name !== 'leer'">
      <router-link to="/"><Icono n="inicio" />Para ti</router-link>
      <router-link to="/comunidad"><Icono n="comunidad" />Comunidad</router-link>
      <router-link to="/perfil"><Icono n="perfil" />Perfil</router-link>
    </nav>

    <Entrada v-if="necesitaEntrada" />
    <Instalar v-if="verInstalar" @cerrar="verInstalar = false" />
    <div v-if="estado.aviso" :key="estado.aviso.k" class="aviso" :class="estado.aviso.tipo" role="status">{{ estado.aviso.texto }}</div>
  </div>
</template>

<style>
.racha-lado { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.racha-lado .ico { width: 30px; height: 30px; }
.racha-lado b { display: block; font-size: 18px; }
.racha-lado span { font-size: 13px; color: var(--gris); }
</style>
