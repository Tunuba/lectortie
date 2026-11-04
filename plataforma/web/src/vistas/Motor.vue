<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { estado, ponerYo } from '../estado.js'
import Icono from '../componentes/Icono.vue'

// Asi recomienda lectortie, la red neuronal a la vista. Todo sale de /motor/red.json, que
// escribe contenido/red/entrenar.py con la red de verdad, y la red corre aqui mismo en el
// navegador con los mismos pesos que usa el servidor. Nada de esta pagina es de adorno.
const router = useRouter()
const red = ref(null)
const error = ref('')
const texto = ref('')
const escribio = ref(false)
const ejemplo = ref(0)
const misLibros = ref(null)
const verPunto = ref(null)
let reloj = 0

const EJEMPLOS = [
  'Cocardo sale de la cárcel y va por venganza #frutinovelas',
  'La leyenda del Sombrerón en La Antigua Guatemala',
  'Cómo armar el cubo Rubik paso a paso',
  'Pixel art de Among Us en cuadritos',
  'Datos curiosos del universo y la NASA',
  'Recomendaciones de romantasy para llorar #booktok',
  'El realismo mágico de García Márquez',
  'El gato que creyó que podía volar #humor'
]

const temas = computed(() => (red.value ? red.value.temas : []))
const infoTema = computed(() => Object.fromEntries((estado.temas || []).map(t => [t.clave, t])))
const color = k => (infoTema.value[k] && infoTema.value[k].color) || '#8B6BFF'
const nombre = k => (infoTema.value[k] && infoTema.value[k].nombre) || k

// la misma limpieza de palabras que en entrenar.py
function palabras(t, vacias) {
  const s = (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')
  const out = []
  for (const p of s.split(' ')) {
    if (p.length < 3 || /^\d+$/.test(p) || vacias.has(p) || p.startsWith('parati') || p.startsWith('fyp')) continue
    out.push(p.slice(0, 6))
  }
  return out
}
const vacias = computed(() => new Set(red.value ? red.value.vacias : []))

// la red, capa por capa
function pasar(t) {
  const r = red.value
  const todas = [...new Set(palabras(t, vacias.value))]
  const conocidas = todas.filter(p => p in r.vocab)
  let n = 0
  const x = conocidas.map(p => { const i = r.vocab[p]; n += r.idf[i] * r.idf[i]; return [i, r.idf[i]] })
  n = Math.sqrt(n) || 1
  const h = r.b1.map((b, j) => { let s = b; for (const [i, v] of x) s += (v / n) * r.W1[i][j]; return Math.max(0, s) })
  const z = r.b2.map((b, k) => { let s = b; for (let j = 0; j < h.length; j++) s += h[j] * r.W2[j][k]; return s })
  const m = Math.max(...z)
  const e = z.map(v => Math.exp(v - m))
  const suma = e.reduce((a, b) => a + b, 0)
  return { todas, conocidas, h, p: e.map(v => v / suma), x: x.map(([i, v]) => [i, v / n]) }
}

const frase = computed(() => (escribio.value ? texto.value : EJEMPLOS[ejemplo.value]))
const paso = computed(() => (red.value && frase.value.trim() ? pasar(frase.value) : null))
const ganador = computed(() => {
  if (!paso.value || !paso.value.conocidas.length) return null
  const k = paso.value.p.indexOf(Math.max(...paso.value.p))
  return temas.value[k]
})

// el dibujo de la red, palabras a la izquierda, 16 neuronas al centro y 8 temas a la derecha
const ALTO = 520
const entrada = computed(() => {
  if (!paso.value) return []
  const ps = paso.value.conocidas.slice(0, 9)
  const paso_y = ALTO / (ps.length + 1)
  return ps.map((p, i) => ({ p, i: red.value.vocab[p], y: paso_y * (i + 1) }))
})
const ocultas = computed(() => {
  if (!paso.value) return []
  const h = paso.value.h
  const max = Math.max(...h, 0.0001)
  return h.map((v, j) => ({ j, a: v / max, y: 22 + j * ((ALTO - 44) / (h.length - 1)) }))
})
const salidas = computed(() => {
  if (!paso.value) return []
  return temas.value.map((t, k) => ({ t, k, p: paso.value.p[k], y: 40 + k * ((ALTO - 80) / 7) }))
})
// solo las conexiones que mas pesan, para que se lea
const lineas1 = computed(() => {
  const out = []
  for (const e of entrada.value) {
    const fila = red.value.W1[e.i]
    const orden = fila.map((w, j) => [Math.abs(w), j, w]).sort((a, b) => b[0] - a[0]).slice(0, 4)
    for (const [, j, w] of orden) out.push({ k: e.p + j, y1: e.y, y2: ocultas.value[j].y, w })
  }
  return out
})
const lineas2 = computed(() => {
  const out = []
  for (const o of ocultas.value) {
    if (o.a < 0.08) continue
    for (const s of salidas.value) {
      const w = red.value.W2[o.j][s.k]
      if (w > 0.6) out.push({ k: 'o' + o.j + s.t, y1: o.y, y2: s.y, w, a: o.a, t: s.t })
    }
  }
  return out
})

// el mapa, cada video es un punto y cada libro un cuadro; tu lugar es el promedio de los temas
// pesado con tu gusto
const centros = computed(() => {
  if (!red.value) return {}
  const acc = {}
  for (const pt of red.value.puntos) {
    const t = red.value.temas[pt.tema]
    acc[t] = acc[t] || [0, 0, 0]
    acc[t][0] += pt.xy[0]; acc[t][1] += pt.xy[1]; acc[t][2]++
  }
  return Object.fromEntries(Object.entries(acc).map(([t, [x, y, n]]) => [t, [x / n, y / n]]))
})
const tu = computed(() => {
  const gs = (estado.gustos || []).filter(g => g.peso > 0)
  if (!gs.length || !red.value) return null
  let x = 0, y = 0, s = 0
  for (const g of gs) { const c = centros.value[g.tema]; if (!c) continue; x += c[0] * g.peso; y += c[1] * g.peso; s += g.peso }
  return s ? [x / s, y / s] : null
})
const MX = v => 30 + v * 940
const MY = v => 24 + (1 - v) * 492

const pasos = computed(() => {
  const m = red.value && red.value.metricas
  return [
    { n: 1, t: m ? `${m.videos} videos clasificados a mano` : 'Videos clasificados a mano', s: 'Cada uno con el tema de lectura que le queda' },
    { n: 2, t: 'Una red neuronal aprende', s: m ? `Acierta ${Math.round(m.acierto * 100)} de cada 100 videos que nunca vio` : '' },
    { n: 3, t: 'Tu gusto suma lo que miras', s: 'Los segundos que te quedas en cada video' },
    { n: 4, t: 'Sale el libro más parecido', s: 'Y un toque te lleva a conseguirlo' }
  ]
})
const muro = computed(() => {
  if (!red.value) return []
  return red.value.temas.map((t, k) => ({ t, k, puntos: red.value.puntos.filter(p => p.tema === k) }))
})
const perdida = computed(() => {
  if (!red.value) return ''
  const l = red.value.metricas.perdida
  const max = Math.max(...l)
  return l.map((v, i) => `${(i / (l.length - 1)) * 200},${60 - (v / max) * 56}`).join(' ')
})

function usar(t) { escribio.value = true; texto.value = t }
function siguienteEjemplo() { if (!escribio.value) ejemplo.value = (ejemplo.value + 1) % EJEMPLOS.length }

async function cargarLibros() {
  try { misLibros.value = (await api.paraMi()).libros } catch { misLibros.value = [] }
}
onMounted(async () => {
  try {
    const r = await fetch('/motor/red.json')
    red.value = await r.json()
  } catch { error.value = 'No pude cargar la red' }
  if (!estado.yo) { try { ponerYo(await api.hola()) } catch { /* sin sesion */ } }
  else { try { ponerYo(await api.yo()) } catch { /* nada */ } }
  cargarLibros()
  reloj = setInterval(siguienteEjemplo, 4500)
})
onBeforeUnmount(() => clearInterval(reloj))
watch(() => estado.gustos, () => cargarLibros())
</script>

<template>
  <div class="pagina motor">
    <p class="etiqueta">Por dentro</p>
    <h1 class="titulo grande">Así recomienda lectortie</h1>
    <p class="sub">Una red neuronal nuestra, entrenada desde cero con videos que clasificamos a mano. No es una caja negra, aquí se ve cada paso.</p>

    <ol class="pasos">
      <li v-for="p in pasos" :key="p.n" class="tarjeta"><i>{{ p.n }}</i><div><b>{{ p.t }}</b><span>{{ p.s }}</span></div></li>
    </ol>

    <p v-if="error" class="vacio">{{ error }}</p>
    <template v-if="red">
      <!-- 1, el muro de videos clasificados a mano -->
      <section class="tarjeta bloque">
        <div class="cab-b"><span class="num">1</span><div><h2>Los videos que clasificamos a mano</h2><p>Cada cuadro es un video real de TikTok. Lo leímos y le pusimos el tema de lectura que le queda.</p></div></div>
        <div class="muro">
          <div v-for="f in muro" :key="f.t" class="fila-muro" :style="{ '--c': color(f.t) }">
            <span class="nom">{{ nombre(f.t) }}</span>
            <span class="cuantos">{{ f.puntos.length }}</span>
            <div class="cuadros"><i v-for="(p, i) in f.puntos" :key="i" :title="p.t" :style="{ animationDelay: (i * 6) + 'ms' }"></i></div>
          </div>
        </div>
      </section>

      <!-- 2, la red -->
      <section class="tarjeta bloque">
        <div class="cab-b"><span class="num">2</span><div><h2>La red neuronal</h2><p>Lee el comienzo de cada palabra de un video, lo pasa por 16 neuronas y dice a qué lectura se parece. Escribe algo y mírala pensar.</p></div></div>
        <div class="probar">
          <input v-model="texto" class="campo" maxlength="140" placeholder="Escribe de qué trata un video" @input="escribio = !!texto.trim()">
          <div class="chips"><button v-for="e in EJEMPLOS.slice(0, 5)" :key="e" class="chip" @click="usar(e)">{{ e.replace(/#\w+/g, '').trim() }}</button></div>
        </div>
        <p class="leyendo">Lee <b>{{ frase }}</b></p>
        <div class="red-movil" v-if="paso">
          <p class="capa-m">Palabras que reconoce</p>
          <div class="pals-m"><span v-for="e in entrada" :key="e.p">{{ e.p }}</span><span v-if="!entrada.length" class="nada-m">Ninguna todavía</span></div>
          <p class="capa-m">16 neuronas</p>
          <div class="neus-m"><i v-for="o in ocultas" :key="o.j" :style="{ '--a': o.a }"></i></div>
          <p class="capa-m">Temas de lectura</p>
          <div class="sals-m"><div v-for="s in salidas" :key="s.t" :class="{ gana: s.t === ganador }"><span>{{ nombre(s.t) }}</span><b>{{ Math.round(s.p * 100) }}%</b><i><em :style="{ width: Math.max(2, s.p * 100) + '%', background: color(s.t) }"></em></i></div></div>
        </div>
        <div class="red-caja">
          <svg class="red-svg" viewBox="0 0 1000 520" role="img" aria-label="La red neuronal pensando">
            <g class="l1"><line v-for="l in lineas1" :key="l.k" x1="250" :y1="l.y1" x2="500" :y2="l.y2" :stroke="l.w > 0 ? '#2AE58C' : '#FF5C7A'" :stroke-opacity="Math.min(0.85, Math.abs(l.w) * 0.35)" :stroke-width="1 + Math.min(3, Math.abs(l.w))" /></g>
            <g class="l2"><line v-for="l in lineas2" :key="l.k" x1="500" :y1="l.y1" x2="760" :y2="l.y2" :stroke="color(l.t)" :stroke-opacity="Math.min(0.9, l.a * l.w * 0.3)" :stroke-width="1 + Math.min(4, l.w * l.a)" /></g>
            <g v-for="e in entrada" :key="e.p" class="pal"><rect x="70" :y="e.y - 15" width="178" height="30" rx="15" /><text x="236" :y="e.y + 5" text-anchor="end">{{ e.p }}</text></g>
            <text v-if="!entrada.length" x="160" y="265" text-anchor="middle" class="nada">Ninguna palabra conocida</text>
            <g v-for="o in ocultas" :key="o.j" class="neu"><circle cx="500" :cy="o.y" r="11" :style="{ '--a': o.a }" /></g>
            <g v-for="s in salidas" :key="s.t" class="sal" :class="{ gana: s.t === ganador }">
              <circle cx="770" :cy="s.y" r="9" :fill="color(s.t)" :fill-opacity="0.25 + s.p * 0.75" />
              <text x="790" :y="s.y - 6">{{ nombre(s.t) }}</text>
              <rect x="790" :y="s.y + 2" width="190" height="8" rx="4" class="fondo-barra" />
              <rect x="790" :y="s.y + 2" :width="Math.max(3, s.p * 190)" height="8" rx="4" :fill="color(s.t)" />
              <text x="980" :y="s.y - 6" text-anchor="end" class="pct">{{ Math.round(s.p * 100) }}%</text>
            </g>
            <text x="160" y="512" text-anchor="middle" class="capa">Palabras</text>
            <text x="500" y="512" text-anchor="middle" class="capa">16 neuronas</text>
            <text x="880" y="512" text-anchor="middle" class="capa">Temas de lectura</text>
          </svg>
        </div>
        <div class="datos-red">
          <div><b>{{ Math.round(red.metricas.acierto * 100) }} de 100</b><span>videos que nunca vio, bien clasificados</span></div>
          <div><b>{{ Object.keys(red.vocab).length }}</b><span>palabras aprendidas</span></div>
          <div class="curva"><svg viewBox="0 0 200 64"><polyline :points="perdida" /></svg><span>El error bajando en {{ red.metricas.vueltas }} vueltas de entrenamiento</span></div>
        </div>
      </section>

      <!-- 3, el mapa -->
      <section class="tarjeta bloque">
        <div class="cab-b"><span class="num">3</span><div><h2>El mapa de lo que la red aprendió</h2><p>Cada punto es un video y cada cuadro un libro. Lo que la red ve parecido queda cerca.<template v-if="tu"> El círculo blanco eres tú.</template></p></div></div>
        <div class="mapa-caja">
          <svg class="mapa" viewBox="0 0 1000 540" role="img" aria-label="Mapa de videos y libros">
            <circle v-for="(p, i) in red.puntos" :key="'p' + i" :cx="MX(p.xy[0])" :cy="MY(p.xy[1])" r="4.2" :fill="color(red.temas[p.tema])" fill-opacity=".75" @mouseenter="verPunto = p.t" @mouseleave="verPunto = null" />
            <g v-for="l in red.libros" :key="l.id" class="libro-m" @mouseenter="verPunto = l.titulo" @mouseleave="verPunto = null">
              <rect :x="MX(l.xy[0]) - 6" :y="MY(l.xy[1]) - 6" width="12" height="12" rx="3" :fill="color(red.temas[l.tema])" />
            </g>
            <g v-if="tu" class="tu"><circle :cx="MX(tu[0])" :cy="MY(tu[1])" r="16" /><text :x="MX(tu[0])" :y="MY(tu[1]) + 5" text-anchor="middle">Tú</text></g>
          </svg>
          <p class="punto-vista" v-if="verPunto">{{ verPunto }}</p>
        </div>
        <div class="leyenda"><span v-for="t in temas" :key="t" :style="{ '--c': color(t) }"><i></i>{{ nombre(t) }}</span></div>
      </section>

      <!-- 4, tus libros -->
      <section class="tarjeta bloque">
        <div class="cab-b"><span class="num">4</span><div><h2>Tus libros</h2><p>Tu gusto contra cada libro. Gana el que más se parece.</p></div></div>
        <div v-if="misLibros && misLibros.length" class="libros">
          <article v-for="x in misLibros" :key="x.libro.id" class="libro">
            <img :src="x.libro.portada" :alt="x.libro.titulo" loading="lazy">
            <div class="dl">
              <b>{{ x.libro.titulo }}</b>
              <span class="autor">{{ x.libro.autor }}</span>
              <span class="parecido"><i :style="{ width: x.parecido + '%' }"></i></span>
              <small>{{ x.parecido }}% parecido<template v-if="x.porque.length">, por {{ x.porque.join(' y ').toLowerCase() }}</template></small>
              <a class="boton conseguir" :href="`/ir/${x.libro.id}?desde=motor`" target="_blank" rel="noopener"><Icono n="libro" />Conseguir</a>
            </div>
          </article>
        </div>
        <div v-else class="vacio-libros">
          <p>Desliza unos videos y aquí aparecen los libros que más se parecen a ti.</p>
          <button class="boton" @click="router.push('/')">Ir a deslizar</button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.motor { max-width: 1120px; }
.grande { font-size: clamp(38px, 7vw, 64px); margin: 10px 0 10px; }
.sub { color: var(--suave); line-height: 1.5; max-width: 720px; }
.pasos { list-style: none; padding: 0; margin: 22px 0 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.pasos li { display: flex; gap: 12px; align-items: flex-start; padding: 14px; }
.pasos i { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-weight: 900; background: var(--piel); color: #0A0912; }
.pasos b { display: block; font-size: 15px; line-height: 1.25; }
.pasos span { display: block; font-size: 13px; color: var(--gris); margin-top: 4px; line-height: 1.35; }
.bloque { padding: 22px; margin-top: 16px; }
.cab-b { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
.cab-b .num { flex: none; font: 900 40px/1 var(--tit); color: var(--piel); }
.cab-b h2 { font: 900 30px/1 var(--tit); text-transform: uppercase; }
.cab-b p { color: var(--suave); margin-top: 6px; line-height: 1.45; }
.muro { display: flex; flex-direction: column; gap: 8px; }
.fila-muro { display: grid; grid-template-columns: 120px 36px 1fr; gap: 10px; align-items: center; }
.nom { font-weight: 800; font-size: 14px; }
.cuantos { color: var(--gris); font-weight: 800; font-variant-numeric: tabular-nums; text-align: right; }
.cuadros { display: flex; flex-wrap: wrap; gap: 3px; }
.cuadros i { width: 9px; height: 9px; border-radius: 2px; background: var(--c); opacity: .85; animation: aparece .4s ease both; }
.probar { display: flex; flex-direction: column; gap: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips .chip { cursor: pointer; }
.leyendo { margin: 14px 0 6px; color: var(--gris); font-size: 14px; }
.leyendo b { color: var(--tinta); }
.red-caja { display: flex; justify-content: center; }
.red-svg { width: 100%; max-height: 60vh; height: auto; display: block; }
.red-movil { display: none; }
.capa-m { font: 800 12px/1 var(--txt); letter-spacing: .12em; text-transform: uppercase; color: var(--gris); margin: 14px 0 8px; }
.pals-m { display: flex; flex-wrap: wrap; gap: 6px; }
.pals-m span { padding: 6px 12px; border-radius: 999px; background: var(--alto); border: 1px solid var(--borde); font-weight: 700; font-size: 14px; }
.pals-m .nada-m { color: var(--gris); }
.neus-m { display: grid; grid-template-columns: repeat(16, 1fr); gap: 4px; }
.neus-m i { aspect-ratio: 1; border-radius: 50%; background: color-mix(in srgb, var(--piel) calc(var(--a) * 100%), #26233A); border: 1px solid rgba(255, 255, 255, .2); transition: background .5s; }
.sals-m { display: flex; flex-direction: column; gap: 8px; }
.sals-m div { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; font-size: 14px; font-weight: 700; color: var(--suave); }
.sals-m div.gana { color: var(--tinta); font-weight: 900; }
.sals-m i { grid-column: 1 / -1; height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .07); overflow: hidden; }
.sals-m em { display: block; height: 100%; border-radius: 999px; transition: width .5s var(--ease); }
.red-svg line { transition: stroke-opacity .5s, stroke-width .5s; }
.pal rect { fill: var(--alto); stroke: var(--borde); }
.pal text { fill: var(--tinta); font: 700 16px var(--txt); }
.nada { fill: var(--gris); font: 700 15px var(--txt); }
.neu circle { fill: color-mix(in srgb, var(--piel) calc(var(--a) * 100%), #26233A); stroke: rgba(255, 255, 255, .25); transition: fill .5s; }
.sal text { fill: var(--suave); font: 700 15px var(--txt); }
.sal .pct { fill: var(--gris); font-size: 14px; }
.sal.gana text { fill: var(--tinta); font-weight: 900; }
.fondo-barra { fill: rgba(255, 255, 255, .07); }
.sal rect:not(.fondo-barra) { transition: width .5s var(--ease); }
.capa { fill: var(--gris); font: 800 13px var(--txt); letter-spacing: .12em; text-transform: uppercase; }
.datos-red { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 12px; margin-top: 12px; }
.datos-red > div { background: var(--alto); border: 1px solid var(--borde); border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.datos-red b { font: 900 34px/1 var(--tit); color: var(--piel); }
.datos-red span { color: var(--gris); font-size: 13px; line-height: 1.35; }
.curva svg { width: 100%; height: 48px; }
.curva polyline { fill: none; stroke: var(--piel); stroke-width: 2.5; }
.mapa-caja { position: relative; }
.mapa { width: 100%; height: auto; display: block; background: color-mix(in srgb, var(--fondo) 70%, transparent); border-radius: 18px; border: 1px solid var(--borde); }
.libro-m rect { stroke: #fff; stroke-width: 1.5; }
.tu circle { fill: rgba(255, 255, 255, .15); stroke: #fff; stroke-width: 3; }
.tu text { fill: #fff; font: 900 14px var(--txt); }
.punto-vista { position: absolute; left: 12px; bottom: 12px; right: 12px; background: rgba(10, 9, 18, .85); border: 1px solid var(--borde); border-radius: 12px; padding: 8px 12px; font-size: 13px; font-weight: 700; pointer-events: none; }
.leyenda { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px; font-size: 13px; font-weight: 700; color: var(--suave); }
.leyenda i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--c); margin-right: 6px; }
.libros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.libro { display: flex; gap: 12px; background: var(--alto); border: 1px solid var(--borde); border-radius: 18px; padding: 12px; }
.libro img { width: 64px; height: 96px; object-fit: cover; border-radius: 8px; flex: none; }
.dl { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.dl b { font-size: 15px; line-height: 1.25; }
.dl .autor { font-size: 13px; color: var(--gris); }
.parecido { display: block; height: 6px; border-radius: 999px; background: rgba(255, 255, 255, .08); overflow: hidden; margin-top: 4px; }
.parecido i { display: block; height: 100%; background: var(--piel); border-radius: 999px; }
.dl small { color: var(--suave); font-size: 12px; line-height: 1.35; }
.conseguir { min-height: 38px; padding: 0 16px; font-size: 14px; align-self: flex-start; margin-top: 4px; }
.conseguir .ico { width: 18px; height: 18px; }
.vacio-libros { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; color: var(--suave); }
@media (max-width: 1100px) { .pasos { grid-template-columns: 1fr 1fr; } .libros { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) {
  .pasos, .libros, .datos-red { grid-template-columns: 1fr; }
  .red-caja { display: none; }
  .red-movil { display: block; }
  .fila-muro { grid-template-columns: 1fr auto; }
  .fila-muro .cuadros { grid-column: 1 / -1; }
  .cuadros i { width: 7px; height: 7px; }
  .bloque { padding: 16px; }
}
</style>
