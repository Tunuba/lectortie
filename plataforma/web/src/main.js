import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Feed from './vistas/Feed.vue'
import { estado } from './estado.js'
import './estilos.css'

// El aviso de instalar de Android llega antes de que Vue monte. Se guarda aqui.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  window.__instalar = e
  estado.instalable = true
})
window.addEventListener('appinstalled', () => { estado.instalada = true; estado.instalable = false })
estado.ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
estado.instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'feed', component: Feed },
    { path: '/leer/:id', name: 'leer', component: () => import('./vistas/Lector.vue') },
    { path: '/comunidad', name: 'comunidad', component: () => import('./vistas/Comunidad.vue') },
    { path: '/perfil', name: 'perfil', component: () => import('./vistas/Perfil.vue') },
    { path: '/panel', name: 'panel', component: () => import('./vistas/Panel.vue') },
    { path: '/motor', name: 'motor', component: () => import('./vistas/Motor.vue') },
    { path: '/:todo(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
})

// Si se publica una version nueva mientras alguien tiene la app abierta, los pedazos de antes
// (Comunidad, la lectura, el perfil) ya no estan y tocarlos no hacia nada (04-11). Ahora la app
// se recarga en la pagina a la que iba, con la version nueva. Una vez cada 15 segundos como
// mucho, para no quedar en un ciclo si el servidor de verdad no responde.
router.onError((err, to) => {
  const msg = String((err && err.message) || err)
  if (!/dynamically imported module|module script failed|preload CSS|error loading dynamically/i.test(msg)) return
  let antes = 0
  try { antes = Number(sessionStorage.getItem('lt-recarga') || 0) } catch { /* sin almacenamiento */ }
  if (Date.now() - antes < 15000) return
  try { sessionStorage.setItem('lt-recarga', String(Date.now())) } catch { /* igual se recarga */ }
  location.assign(to && to.fullPath ? to.fullPath : location.href)
})

createApp(App).use(router).mount('#app')

if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
