/* LA RED DE VERDAD. Lo que hace cada persona se comparte con las demas por
   Supabase: su lugar en el ranking, sus comentarios y lo que va pasando.

   Si no hay conexion o falta la configuracion, no pasa nada. La app sigue
   con la comunidad que arma ella misma y nadie nota el corte. La llave que
   va en red-config.js es la publica de Supabase, hecha para ir en la pagina,
   y lo que se puede hacer con ella lo limitan las reglas de la base.

   Desde la pagina no se escribe directo en ninguna tabla. Todo pasa por tres
   funciones de la base (soy, contar y comentar, en supabase/esquema.sql) que
   revisan las palabras, frenan a quien manda demasiado y no dejan tocar la
   fila de otro. Cada telefono guarda una clave suya que solo el conoce. */

window.Red = (function () {

  const C = window.LECTORTIE_RED || {};
  let db = null;
  const oyentes = { suceso: [], comentario: [] };
  let lectores = [];

  function lista() { return !!db; }

  let sesion = null;
  function miId() {
    if (sesion && sesion.user) return sesion.user.id;
    try {
      let id = localStorage.getItem('lectortie.id');
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        }));
        localStorage.setItem('lectortie.id', id);
      }
      return id;
    } catch (e) { return null; }
  }

  /* La clave de este telefono. Prueba que su fila del ranking es suya. */
  function miClave() {
    try {
      let c = localStorage.getItem('lectortie.clave');
      if (!c) {
        const r = new Uint8Array(24); crypto.getRandomValues(r);
        c = [...r].map(x => x.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('lectortie.clave', c);
      }
      return c;
    } catch (e) { return ''; }
  }

  /* Las palabras que no salen en pantalla. La misma lista vive en la funcion
     limpio de la base; si se cambia aqui, hay que cambiarla alla. */
  const CAMBIO = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
  const MALAS = /(^|[^a-zñ])(put[ao]|mierd|verga|pendej|cerot|culer|hijueput|hijodeput|malparid|chingad|chingar|mamad|maric|imbecil|estupid|cabron|follar|porno|nazi|hitler|idiota|zorra|cagad|jodid|coño|sexo|vrg|culos?([^a-zñ]|$)|pija([^a-zñ]|$)|hdp([^a-zñ]|$)|ptm([^a-zñ]|$)|penes?([^a-zñ]|$)|jotos?([^a-zñ]|$))/;
  function limpio(texto) {
    const t = String(texto || '').toLowerCase().replace(/[áéíóúü013457@$]/g, c => CAMBIO[c]);
    return !MALAS.test(t);
  }

  function semana() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  async function arrancar() {
    if (!C.url || !C.llave || !window.supabase) return false;
    try {
      db = window.supabase.createClient(C.url, C.llave, { auth: { persistSession: true, storageKey: 'lectortie.sesion', autoRefreshToken: true } });
      const { data } = await db.auth.getSession();
      sesion = data && data.session || null;
      db.auth.onAuthStateChange((_, s) => { sesion = s; });
      if (sesion) { await bajar(); setInterval(subir, 12000); addEventListener('pagehide', subir); }
      db.channel('lectortie')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sucesos' }, p => avisar('suceso', p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comentarios' }, p => avisar('comentario', p.new))
        .subscribe();
      await traerLectores();
      setInterval(traerLectores, 30000);
      return true;
    } catch (e) { db = null; return false; }
  }

  function avisar(tipo, fila) {
    if (fila && fila.quien === miId()) return;
    if (!fila || !limpio(fila.alias) || !limpio(fila.texto)) return;
    for (const f of oyentes[tipo]) { try { f(fila); } catch (e) { /* un oyente roto no tumba a los demas */ } }
  }
  function al(tipo, f) { oyentes[tipo].push(f); }

  async function traerLectores() {
    if (!db) return lectores;
    const desde = new Date(Date.now() - 864e5 * 8).toISOString();
    const { data } = await db.from('lectores').select('*').eq('semana', semana()).gte('actualizado', desde)
      .order('paginas', { ascending: false }).limit(40);
    if (data) lectores = data.filter(x => x.id !== miId() && limpio(x.alias));
    return lectores;
  }

  /* Lo propio: alias, paginas de la semana, racha y el libro que va leyendo. */
  async function soy(datos) {
    if (!db) return;
    const id = miId(); if (!id) return;
    try {
      await db.rpc('soy', { p_id: id, p_clave: miClave(), p_alias: datos.alias, p_color: datos.color || null,
        p_paginas: datos.paginas || 0, p_racha: datos.racha || 0, p_libro: datos.libro || null });
    } catch (e) { /* sin red, ya se mandara en el siguiente gesto */ }
  }

  async function contar(alias, color, texto, libro) {
    if (!db) return;
    try { await db.rpc('contar', { p_quien: miId(), p_alias: alias, p_color: color, p_texto: String(texto).slice(0, 120), p_libro: libro || null }); }
    catch (e) { /* sin red no se cuenta, la app sigue */ }
  }

  async function sucesos(n) {
    if (!db) return [];
    const { data } = await db.from('sucesos').select('*').order('creado', { ascending: false }).limit(n || 8);
    return (data || []).filter(x => limpio(x.alias) && limpio(x.texto));
  }

  async function comentar(libro, alias, color, texto) {
    if (!db) return;
    try { await db.rpc('comentar', { p_quien: miId(), p_libro: libro, p_alias: alias, p_color: color, p_texto: String(texto).slice(0, 140) }); }
    catch (e) { /* queda guardado en este navegador igual */ }
  }

  async function comentarios(libro) {
    if (!db) return [];
    const { data } = await db.from('comentarios').select('*').eq('libro', libro).order('creado', { ascending: true }).limit(30);
    return (data || []).filter(x => x.quien !== miId() && limpio(x.alias) && limpio(x.texto));
  }

  function activos() {
    const hace = Date.now() - 15 * 60000;
    return lectores.filter(x => new Date(x.actualizado).getTime() > hace).length;
  }

  /* ── la cuenta, que es opcional ────────────────────────────────────────
     La app se usa entera sin cuenta. Quien quiera guardar su avance para
     abrirlo en otro telefono crea una con correo y contrasena, y desde ahi
     su racha, paginas, medallas, ruta y gusto viajan con el. */
  const LLAVES = ['lectortie.lectura', 'lectortie.gusto', 'lectortie.estante', 'lectortie.gusta',
    'lectortie.para', 'lectortie.piel', 'lectortie.variante', 'lectortie.entro'];
  function foto() {
    const o = {};
    for (const k of LLAVES) { try { const v = localStorage.getItem(k); if (v !== null) o[k] = v; } catch (e) { /* nada */ } }
    return o;
  }
  let ultimaSubida = '';
  async function subir() {
    if (!db || !sesion) return;
    const datos = foto();
    const texto = JSON.stringify(datos);
    if (texto === ultimaSubida) return;
    let alias = '';
    try { alias = JSON.parse(datos['lectortie.lectura'] || '{}').alias || ''; } catch (e) { /* nada */ }
    const { error } = await db.from('perfiles').upsert({ id: sesion.user.id, alias: alias.slice(0, 18), datos, actualizado: new Date().toISOString() });
    if (!error) ultimaSubida = texto;
  }
  /* Al entrar, si la nube ya tiene avance, gana la nube y la pagina se recarga
     con el. Si no tiene, se sube lo de este telefono. Devuelve true si cambio. */
  async function bajar() {
    if (!db || !sesion) return false;
    const { data } = await db.from('perfiles').select('datos').eq('id', sesion.user.id).maybeSingle();
    if (!data || !data.datos || !Object.keys(data.datos).length) { await subir(); return false; }
    const texto = JSON.stringify(data.datos);
    if (texto === JSON.stringify(foto())) { ultimaSubida = texto; return false; }
    for (const k of LLAVES) { try { if (k in data.datos) localStorage.setItem(k, data.datos[k]); else localStorage.removeItem(k); } catch (e) { /* nada */ } }
    ultimaSubida = texto;
    return true;
  }
  function traducir(e) {
    const m = String(e && e.message || e || '').toLowerCase();
    if (m.includes('invalid login')) return 'Correo o contraseña no coinciden';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene cuenta, entra con tu contraseña';
    if (m.includes('password')) return 'La contraseña necesita al menos 6 caracteres';
    if (m.includes('email')) return 'Revisa el correo, parece que tiene un error';
    if (m.includes('fetch') || m.includes('network')) return 'Sin conexión, intenta otra vez';
    return 'No se pudo, intenta otra vez';
  }
  async function crearCuenta(correo, clave) {
    if (!db) return { error: 'Las cuentas no están disponibles ahora' };
    const { data, error } = await db.auth.signUp({ email: correo, password: clave });
    if (error) return { error: traducir(error) };
    if (!data.session) return { error: 'Te mandamos un correo para confirmar la cuenta' };
    sesion = data.session;
    await subir();
    return { ok: true, cambio: false };
  }
  async function entrar(correo, clave) {
    if (!db) return { error: 'Las cuentas no están disponibles ahora' };
    const { data, error } = await db.auth.signInWithPassword({ email: correo, password: clave });
    if (error) return { error: traducir(error) };
    sesion = data.session;
    const cambio = await bajar();
    return { ok: true, cambio };
  }
  async function salir() {
    if (!db) return;
    await subir();
    await db.auth.signOut();
    sesion = null;
  }
  function cuenta() { return sesion && sesion.user ? { correo: sesion.user.email } : null; }

  return { arrancar, lista, al, soy, contar, sucesos, comentar, comentarios, lectores: () => lectores, activos, miId, limpio,
           crearCuenta, entrar, salir, cuenta, subir };
})();
