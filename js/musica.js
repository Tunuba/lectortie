/* La musica de Deslizar. Cada grupo de lectura tiene su cancion corta en bucle
   (musica/generar.py) y al pasar de un video a otro cruza a la siguiente.

   Las canciones se piden solo cuando hacen falta y quedan en memoria. El audio
   arranca con el toque que abre Deslizar, que es lo que piden los telefonos. */

window.Musica = (function () {

  let AC = null, maestro = null, meta = null, actual = null, pedido = null;
  const cache = {};
  let prendida = true;
  try { prendida = localStorage.getItem('lectortie.musica') !== 'no'; } catch (e) { /* modo privado */ }

  async function cargarMeta() {
    if (!meta) { try { meta = await (await fetch('datos/musica.json')).json(); } catch (e) { meta = {}; } }
    return meta;
  }
  function asegurar() {
    try {
      if (!AC) {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        maestro = AC.createGain();
        maestro.gain.value = prendida ? 1 : 0;
        maestro.connect(AC.destination);
      }
      if (AC.state !== 'running') AC.resume();
    } catch (e) { AC = null; }
    return !!AC;
  }
  function buffer(id) {
    if (!cache[id]) {
      cache[id] = fetch('audio/musica/' + id + '.mp3').then(r => r.arrayBuffer())
        .then(b => new Promise((ok, mal) => AC.decodeAudioData(b, ok, mal)))
        .catch(e => { delete cache[id]; throw e; });
    }
    return cache[id];
  }
  function apagar(a, rapido) {
    if (!a || !AC) return;
    const t = AC.currentTime, d = rapido ? .15 : .6;
    a.g.gain.cancelScheduledValues(t);
    a.g.gain.setValueAtTime(a.g.gain.value, t);
    a.g.gain.linearRampToValueAtTime(0, t + d);
    try { a.src.stop(t + d + .05); } catch (e) { /* ya parada */ }
  }
  async function tocar(id) {
    await cargarMeta();
    if (!meta[id]) id = 'tuyo';
    if (actual && actual.id === id) return;
    if (!asegurar() || !meta[id]) return;
    pedido = id;
    let buf;
    try { buf = await buffer(id); } catch (e) { return; }
    if (pedido !== id) return;
    const src = AC.createBufferSource(), g = AC.createGain(), t = AC.currentTime;
    src.buffer = buf; src.loop = true; src.loopStart = meta[id].ini; src.loopEnd = meta[id].fin;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.6, t + .6);
    src.connect(g); g.connect(maestro);
    src.start(t, meta[id].ini);
    apagar(actual);
    actual = { id, src, g };
  }
  function parar(rapido) { pedido = null; apagar(actual, rapido); actual = null; }
  function alternar() {
    prendida = !prendida;
    try { localStorage.setItem('lectortie.musica', prendida ? 'si' : 'no'); } catch (e) { /* modo privado */ }
    if (AC) maestro.gain.setTargetAtTime(prendida ? 1 : 0, AC.currentTime, .08);
    return prendida;
  }
  /* Con una ficha abierta encima, la musica baja para no estorbar. */
  function bajar(si) { if (AC && prendida) maestro.gain.setTargetAtTime(si ? .25 : 1, AC.currentTime, .2); }
  function nombre(id) { return meta && meta[id] ? meta[id].nombre : (meta && meta.tuyo ? meta.tuyo.nombre : ''); }
  function sonando() { return !!actual && prendida; }

  cargarMeta();
  return { tocar, parar, alternar, bajar, nombre, asegurar, prendida: () => prendida, sonando };
})();
