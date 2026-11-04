<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { estado, ponerYo, avisar } from '../estado.js'
import Icono from '../componentes/Icono.vue'
import Gusto from '../componentes/Gusto.vue'
import Instalar from '../componentes/Instalar.vue'

const yo = computed(() => estado.yo || {})
const correo = ref('')
const enviado = ref(false)
const ayuda = ref('')
const ayudaCorreo = ref('')
const verInstalar = ref(false)
const ocupado = ref(false)
const router = useRouter()
const libros = ref([])
onMounted(async () => { try { libros.value = (await api.paraMi()).libros.slice(0, 3) } catch { /* nada */ } })

async function pedirEnlace() {
  ocupado.value = true
  try {
    const r = await api.correo(correo.value.trim())
    enviado.value = true
    avisar(r.modo === 'local' ? 'Correo apagado en esta computadora, el enlace quedó en el registro del servidor' : 'Te mandamos el enlace, revisa tu correo')
  } catch (e) { avisar(e.message, 'mal') } finally { ocupado.value = false }
}
async function mandarAyuda() {
  ocupado.value = true
  try {
    const r = await api.ayuda(ayuda.value.trim(), ayudaCorreo.value.trim())
    ayuda.value = ''
    avisar(`Recibimos tu mensaje, número ${r.numero}`)
  } catch (e) { avisar(e.message, 'mal') } finally { ocupado.value = false }
}
async function salir() {
  await api.salir().catch(() => {})
  ponerYo(await api.hola())
  avisar('Saliste de tu cuenta')
}
</script>

<template>
  <div class="pagina">
    <p class="etiqueta">Tu perfil</p>
    <h1 class="titulo grande">{{ yo.alias ? '@' + yo.alias : (estado.yo ? 'Sin alias' : 'Sin conexión') }}</h1>

    <div class="cifras">
      <div class="tarjeta racha"><Icono n="llama" /><b>{{ yo.racha || 0 }}</b><span>días de racha</span></div>
      <div class="tarjeta"><b>{{ yo.nivel || 1 }}</b><span>nivel</span></div>
      <div class="tarjeta"><b>{{ yo.paginas || 0 }}</b><span>páginas</span></div>
      <div class="tarjeta"><b>{{ yo.terminadas || 0 }}</b><span>terminadas</span></div>
    </div>

    <section class="tarjeta bloque"><Gusto compacto /></section>

    <section class="tarjeta bloque" v-if="libros.length">
      <p class="etiqueta"><Icono n="libro" /> Tus libros</p>
      <div v-for="x in libros" :key="x.libro.id" class="mi-libro">
        <img :src="x.libro.portada" :alt="x.libro.titulo" loading="lazy">
        <div><b>{{ x.libro.titulo }}</b><small>{{ x.parecido }}% parecido a tu gusto</small></div>
        <a class="boton claro" :href="`/ir/${x.libro.id}?desde=perfil`" target="_blank" rel="noopener">Conseguir</a>
      </div>
      <button class="ver-motor" @click="router.push('/motor')"><Icono n="chispa" />Cómo los elige la red neuronal</button>
    </section>

    <section class="tarjeta bloque">
      <p class="etiqueta"><Icono n="correo" /> Guarda tu racha</p>
      <template v-if="yo.correo">
        <p class="texto">Tu racha está guardada en <b>{{ yo.correo }}</b>. Entra desde cualquier teléfono con un enlace a ese correo.</p>
      </template>
      <template v-else>
        <p class="texto">Escribe tu correo y te mandamos un enlace para entrar. Sin contraseña, y tu racha te sigue a cualquier teléfono.</p>
        <div class="fila">
          <input v-model="correo" class="campo" type="email" inputmode="email" placeholder="tu@correo.com" autocomplete="email" @keyup.enter="pedirEnlace">
          <button class="boton" :disabled="ocupado || !correo" @click="pedirEnlace">{{ enviado ? 'Reenviar' : 'Mandar enlace' }}</button>
        </div>
      </template>
    </section>

    <section class="tarjeta bloque">
      <p class="etiqueta"><Icono n="descargar" /> lectortie en tu teléfono</p>
      <p class="texto" v-if="estado.instalada">Ya la tienes instalada.</p>
      <template v-else>
        <p class="texto">Instálalo y se abre a pantalla completa, sin la barra del navegador.</p>
        <button class="boton piel" @click="verInstalar = true"><Icono n="descargar" />Instalar lectortie</button>
      </template>
    </section>

    <section class="tarjeta bloque">
      <p class="etiqueta"><Icono n="ayuda" /> Ayuda</p>
      <p class="texto">¿Algo no funciona o tienes una idea? Cuéntanos. Cada mensaje entra como un ticket de soporte.</p>
      <textarea v-model="ayuda" class="campo" rows="3" maxlength="2000" placeholder="Cuéntanos qué pasó"></textarea>
      <div class="fila">
        <input v-model="ayudaCorreo" class="campo" type="email" placeholder="Tu correo, si quieres respuesta">
        <button class="boton claro" :disabled="ocupado || ayuda.trim().length < 5" @click="mandarAyuda">Enviar</button>
      </div>
    </section>

    <p class="pie">Sin anuncios. <button @click="salir">Salir de esta cuenta</button></p>
    <Instalar v-if="verInstalar" @cerrar="verInstalar = false" />
  </div>
</template>

<style scoped>
.grande { font-size: clamp(34px, 9vw, 56px); margin: 6px 0 20px; overflow-wrap: anywhere; }
.cifras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.cifras .tarjeta { padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
.cifras b { font: 900 40px/1 var(--tit); }
.cifras span { color: var(--gris); font-size: 12px; font-weight: 700; }
.cifras .racha { color: var(--oro); }
.cifras .racha .ico { width: 22px; height: 22px; }
.bloque { padding: 20px; margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
.bloque .etiqueta { display: flex; align-items: center; gap: 8px; }
.bloque .etiqueta .ico { width: 16px; height: 16px; }
.texto { color: var(--suave); line-height: 1.5; }
.fila { display: flex; gap: 10px; flex-wrap: wrap; }
.fila .campo { flex: 1 1 220px; }
textarea.campo { resize: vertical; min-height: 90px; }
.pie { margin-top: 24px; color: var(--gris); text-align: center; }
.mi-libro { display: grid; grid-template-columns: 44px 1fr auto; gap: 12px; align-items: center; }
.mi-libro img { width: 44px; height: 66px; object-fit: cover; border-radius: 6px; }
.mi-libro b { display: block; font-size: 15px; line-height: 1.25; }
.mi-libro small { color: var(--gris); font-size: 13px; }
.mi-libro .boton { min-height: 40px; padding: 0 16px; font-size: 14px; }
.ver-motor { display: flex; align-items: center; gap: 8px; font-weight: 800; color: var(--piel); align-self: flex-start; }
.ver-motor .ico { width: 18px; height: 18px; }
.pie button { color: var(--suave); text-decoration: underline; }
@media (max-width: 520px) { .cifras { grid-template-columns: repeat(2, 1fr); } }
</style>
