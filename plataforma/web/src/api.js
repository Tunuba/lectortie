// La API de lectortie. Todo va con la cookie de la sesion, nunca con llaves en la pagina.
async function pedir(metodo, ruta, cuerpo) {
  const op = { method: metodo, headers: {}, credentials: 'same-origin' }
  if (cuerpo !== undefined) {
    op.headers['Content-Type'] = 'application/json'
    op.body = JSON.stringify(cuerpo)
  }
  let r
  try {
    r = await fetch(ruta, op)
  } catch {
    const e = new Error('Sin conexión, revisa tu internet')
    e.codigo = 0
    throw e
  }
  let d = null
  try { d = await r.json() } catch { d = null }
  if (!r.ok) {
    const e = new Error((d && d.error) || 'Algo falló, intenta otra vez')
    e.codigo = r.status
    throw e
  }
  return d
}

// Lo pasajero (sin red, el tunel, un salon entero en la misma red que llega al limite) se
// reintenta en silencio un par de veces antes de decirle nada a la persona.
const pausa = ms => new Promise(r => setTimeout(r, ms))
export async function conReintento(fn, veces = 3) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      const pasajero = e.codigo === 0 || e.codigo === 429 || e.codigo >= 500
      if (!pasajero || i >= veces - 1) throw e
      await pausa(1200 * (i + 1))
    }
  }
}

export const api = {
  hola: () => pedir('POST', '/api/hola'),
  yo: () => pedir('GET', '/api/yo'),
  entrada: (alias, temas) => pedir('POST', '/api/entrada', { alias, temas }),
  feed: (n, excluir) => pedir('GET', `/api/feed?n=${n}&excluir=${encodeURIComponent(excluir || '')}`),
  vista: v => pedir('POST', '/api/vista', v),
  micro: excluir => pedir('POST', `/api/micro?espera=1&excluir=${encodeURIComponent(excluir || '')}`),
  abrirMicro: id => pedir('POST', `/api/micro/${id}/abrir`),
  lectura: id => pedir('GET', `/api/lectura/${encodeURIComponent(id)}`),
  terminar: (id, datos) => pedir('POST', `/api/lectura/${encodeURIComponent(id)}/terminar`, datos),
  comentar: (id, texto) => pedir('POST', `/api/lectura/${encodeURIComponent(id)}/comentar`, { texto }),
  comunidad: () => pedir('GET', '/api/comunidad'),
  paraMi: () => pedir('GET', '/api/para-mi'),
  correo: correo => pedir('POST', '/api/correo', { correo }),
  ellis: respuesta => pedir('POST', '/api/ellis', { respuesta }),
  ayuda: (texto, correo) => pedir('POST', '/api/ayuda', { texto, correo }),
  salir: () => pedir('POST', '/api/salir'),
  panel: clave => fetch('/api/panel', { headers: { 'X-Panel-Clave': clave } }).then(async r => {
    const d = await r.json().catch(() => null)
    if (!r.ok) { const e = new Error((d && d.error) || 'No se pudo'); e.codigo = r.status; throw e }
    return d
  })
}

// Si la persona cierra la app a media vista, la vista se manda igual.
export function vistaAlCerrar(v) {
  try {
    const b = new Blob([JSON.stringify(v)], { type: 'application/json' })
    navigator.sendBeacon('/api/vista', b)
  } catch { /* nada que hacer */ }
}
