package main

// Cache aside del estado de cada lector. El feed, la micro lectura, el perfil y Por dentro leen
// en cada pedido el gusto de la persona y lo que ya vio. Se busca primero aqui; si no esta o ya
// vencio, se lee de la base y se guarda. Cualquier escritura de ese lector (una vista, abrir o
// terminar una lectura, entrar) borra su entrada, asi el siguiente pedido vuelve a leer de la
// base ya con lo que hicieron los triggers. El contenido (temas, videos, lecturas) no pasa por
// aqui, ya vive en memoria en el catalogo.

import (
	"context"
	"sync"
	"time"
)

const duraCache = 2 * time.Minute

// yaVisto es lo ultimo que hizo la persona con un video en las ultimas 24 horas.
type yaVisto struct {
	ultima time.Time
	ms     int
	salto  bool
	gusta  bool
}

// microVista es una micro lectura que ya se le puso en las ultimas 12 horas.
type microVista struct {
	ultima  time.Time
	abierta bool
}

type estadoLector struct {
	gustos     []gusto
	visto      int // vistas en total
	vistos     map[int]yaVisto
	micros     map[string]microVista
	terminadas map[string]bool
	hasta      time.Time
}

type cacheLectores struct {
	mu               sync.Mutex
	m                map[string]*estadoLector
	gen              map[string]uint64 // sube cada vez que se olvida a un lector
	aciertos, fallos int64
}

func nuevoCache() *cacheLectores {
	return &cacheLectores{m: map[string]*estadoLector{}, gen: map[string]uint64{}}
}

func (c *cacheLectores) buscar(id string) *estadoLector {
	c.mu.Lock()
	defer c.mu.Unlock()
	e := c.m[id]
	if e == nil || time.Now().After(e.hasta) {
		c.fallos++
		return nil
	}
	c.aciertos++
	return e
}

// generacion es el numero de veces que se ha olvidado a un lector. Quien lee de la base lo
// toma antes de leer y solo guarda si no cambio: si a medio leer llego una vista, lo que leyo
// ya es viejo. Sin esto, un feed que leia justo antes de una vista guardaba el gusto de antes
// encima del nuevo, y asi quedaba hasta dos minutos (04-11).
func (c *cacheLectores) generacion(id string) uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.gen[id]
}

func (c *cacheLectores) guardarSi(id string, e *estadoLector, g uint64) {
	c.mu.Lock()
	if c.gen[id] == g {
		c.m[id] = e
	}
	c.mu.Unlock()
}

func (c *cacheLectores) olvidar(id string) {
	c.mu.Lock()
	delete(c.m, id)
	c.gen[id]++
	c.mu.Unlock()
}

func (c *cacheLectores) limpiar() {
	c.mu.Lock()
	defer c.mu.Unlock()
	ahora := time.Now()
	for k, e := range c.m {
		if ahora.After(e.hasta) {
			delete(c.m, k)
		}
	}
}

func (c *cacheLectores) cifras() (int, int64, int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.m), c.aciertos, c.fallos
}

// estado devuelve lo que se sabe de un lector, de la cache o de la base. No se modifica lo
// que devuelve, lo comparten los pedidos.
func (s *Srv) estado(ctx context.Context, lector string) (*estadoLector, error) {
	if e := s.cache.buscar(lector); e != nil {
		return e, nil
	}
	gen := s.cache.generacion(lector)
	e := &estadoLector{vistos: map[int]yaVisto{}, micros: map[string]microVista{}, terminadas: map[string]bool{}}
	var err error
	if e.gustos, err = s.leerGustos(ctx, lector); err != nil {
		return nil, err
	}
	if err = s.db.QueryRow(ctx, `SELECT count(*) FROM vistas WHERE lector = $1`, lector).Scan(&e.visto); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT DISTINCT ON (video) video, creado, ms, salto, gusta FROM vistas
		WHERE lector = $1 AND creado > now() - interval '24 hours' ORDER BY video, creado DESC`, lector)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int
		var y yaVisto
		if err := rows.Scan(&id, &y.ultima, &y.ms, &y.salto, &y.gusta); err != nil {
			rows.Close()
			return nil, err
		}
		e.vistos[id] = y
	}
	rows.Close()
	rows, err = s.db.Query(ctx, `SELECT lectura, max(creado), bool_or(abierta) FROM micros
		WHERE lector = $1 AND creado > now() - interval '12 hours' GROUP BY lectura`, lector)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id string
		var m microVista
		if err := rows.Scan(&id, &m.ultima, &m.abierta); err != nil {
			rows.Close()
			return nil, err
		}
		e.micros[id] = m
	}
	rows.Close()
	rows, err = s.db.Query(ctx, `SELECT DISTINCT lectura FROM lecturas_hechas WHERE lector = $1 AND terminada`, lector)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		e.terminadas[id] = true
	}
	rows.Close()
	e.hasta = time.Now().Add(duraCache)
	s.cache.guardarSi(lector, e, gen)
	return e, nil
}

// cifrasCache es lo que /api/salud cuenta de la cache, para ver que de verdad se usa.
func (s *Srv) cifrasCache() map[string]any {
	n, a, f := s.cache.cifras()
	pct := 0.0
	if a+f > 0 {
		pct = float64(a) * 100 / float64(a+f)
	}
	return map[string]any{"lectores": n, "aciertos": a, "fallos": f, "porcentaje": int(pct + 0.5)}
}
