/* EL GUSTO, la parte que se ve. Cliente de /api/gusto.

   COMO FUNCIONA EL CICLO, QUE ES LO QUE SE ENSENA EN LA DEMO
   ----------------------------------------------------------
   1. El primer minuto la pagina es la de todos y por debajo va anotando lo
      que haces: que abres, que guardas, que buscas.
   2. Al cumplirse el ciclo, la pagina se rearma con tu gusto y te dice por
      que, con nombre de libro.
   3. Sigue anotando mientras miras la version tuya, y al siguiente ciclo se
      vuelve a rearmar con lo nuevo. No para.

   Si antes del minuto ya diste cinco senales fuertes, no te hace esperar: se
   rearma en cuanto puede. Aprender rapido no es hacer trampa.

   LAS SENALES NO SE MANDAN DE UNA EN UNA. Se juntan y salen cada pocos
   segundos. Un feed dispara una senal de "visto" por tarjeta que pasa: con
   una peticion por cada una, desplazarse rapido serian treinta viajes. */

window.Gusto = (function () {

  const CADA_MS = 4000;          /* cada cuanto se vacia la cola */
  const CICLO_MS = 60 * 1000;    /* cada cuanto se rearma la pagina */

  const cola = [];
  let ultimo = null;      /* el ultimo perfil que devolvio el servidor */
  let alSaber = null;     /* a quien avisarle cuando cambia */
  let reloj = null;
  let arrancado = 0;      /* cuando empezo el ciclo que corre ahora */

  function avisar() { if (alSaber) alSaber(ultimo, restante()); }

  function restante() {
    if (!arrancado) return CICLO_MS;
    return Math.max(0, CICLO_MS - (Date.now() - arrancado));
  }

  /* Una senal se anota aunque no haya servidor: si la peticion falla, la cola
     se vuelve a llenar con lo que no salio y se intenta en la siguiente
     vuelta. Perder lo que hizo el usuario por un bache de red seria borrar
     justo la parte que cuesta conseguir. */
  function registrar(que, datos) {
    const s = Object.assign({ que }, datos || {});
    cola.push(s);
    if (cola.length > 60) cola.splice(0, cola.length - 60);
  }

  async function empujar() {
    if (!cola.length) return ultimo;
    const salen = cola.splice(0, cola.length);
    try {
      const r = await fetch('/api/gusto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senales: salen })
      });
      const j = await r.json();
      ultimo = j.perfil;
      avisar();
    } catch (e) {
      cola.unshift(...salen);
    }
    return ultimo;
  }

  async function cargar() {
    try {
      ultimo = await (await fetch('/api/perfil')).json();
      avisar();
    } catch (e) { /* sin servidor la pagina sigue, solo que sin aprender */ }
    return ultimo;
  }

  async function olvidar() {
    cola.length = 0;
    try {
      const j = await (await fetch('/api/olvidar', { method: 'POST' })).json();
      ultimo = j.perfil;
      arrancado = Date.now();
      avisar();
    } catch (e) { /* nada que olvidar si no hay servidor */ }
    return ultimo;
  }

  /* Cuando toca rearmar.

     LA PRIMERA VEZ NO ESPERA. En cuanto hay con que, la pagina se arma: si
     ya te conoce y aun asi te deja mirando la de todos hasta que se cumpla
     el reloj, lo unico que consigue es que no veas nunca la parte buena.
     A partir de ahi si va por ciclos, para no rearmar debajo de tu dedo
     cada vez que tocas algo. */
  let armada = false;
  function marcarArmada(si) { armada = !!si; }

  function toca() {
    if (!ultimo || !ultimo.listo) return false;
    return !armada || restante() === 0;
  }

  function reiniciarCiclo() { arrancado = Date.now(); avisar(); }

  function empezar(cuandoCambie, cuandoToque) {
    alSaber = cuandoCambie;
    arrancado = Date.now();
    cargar();

    reloj = setInterval(async () => {
      await empujar();
      avisar();
      if (toca()) { reiniciarCiclo(); cuandoToque(); }
    }, CADA_MS);

    /* Al salir de la pagina se manda lo que quede. sendBeacon existe justo
       para esto: fetch se cancela cuando la pestana se cierra. */
    window.addEventListener('pagehide', () => {
      if (!cola.length || !navigator.sendBeacon) return;
      navigator.sendBeacon('/api/gusto',
        new Blob([JSON.stringify({ senales: cola })], { type: 'application/json' }));
    });
  }

  return { registrar, empujar, cargar, olvidar, empezar, reiniciarCiclo, restante,
           marcarArmada, perfil: () => ultimo, CICLO_MS };
})();
