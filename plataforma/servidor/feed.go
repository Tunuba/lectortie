package main

// El feed. Cada video que alguien deja de ver llega aqui con cuanto se quedo, y el trigger de
// vistas mueve su gusto por tema. El siguiente lote se sortea con ese gusto, y cada tres videos
// el cliente pide una micro lectura, que sale del tema que mas lo atrapo y trae escrito el motivo.
//
// Al principio no se ataca con libros. Los primeros videos son de lo que ya ven los jovenes,
// frutinovelas, risa, armar cosas, cubo Rubik, pixel art, caricaturas, leyendas y el espacio, y
// cada uno empuja el gusto hacia un tema de lectura. Mientras mas mira la persona, mas BookTok le
// sale, sin quitar nunca del todo lo otro.
//
// Como se elige cada video, desde el 03-11 en la noche (José David vio puras leyendas de terror y
// le seguia saliendo romantasy):
//  1. Primero el tema, sorteado con el gusto. El 85 % sigue al gusto y el 15 % explora entre los
//     temas que la persona no ha rechazado. Puede repetir tema hasta tres veces seguidas.
//  2. Luego el video dentro de ese tema. Uno que no ha visto gana siempre; si ya vio todos los
//     del tema, se repite uno en el que se quedo, el que vio hace mas tiempo. Nunca se repite uno
//     que paso rapido. Antes de esto, si el tema se acababa, el feed llenaba con lo que quedara,
//     que casi siempre era justo lo que la persona pasaba.

import (
	"context"
	"fmt"
	"math"
	"math/rand/v2"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

type gusto struct {
	Tema     string  `json:"tema"`
	Nombre   string  `json:"nombre"`
	Color    string  `json:"color"`
	Peso     float64 `json:"peso"`
	Segundos int     `json:"segundos"`
	Vistas   int     `json:"vistas"`
}

// gustos lee el gusto pasando por la cache de cada lector.
func (s *Srv) gustos(ctx context.Context, lector string) ([]gusto, error) {
	e, err := s.estado(ctx, lector)
	if err != nil {
		return nil, err
	}
	return e.gustos, nil
}

func (s *Srv) leerGustos(ctx context.Context, lector string) ([]gusto, error) {
	rows, err := s.db.Query(ctx, `SELECT tema, peso, ms_total, vistas FROM gustos WHERE lector = $1 ORDER BY peso DESC`, lector)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cat := s.catalogo()
	out := []gusto{}
	for rows.Next() {
		var g gusto
		var ms int64
		if err := rows.Scan(&g.Tema, &g.Peso, &ms, &g.Vistas); err != nil {
			return nil, err
		}
		g.Segundos = int(ms / 1000)
		t := cat.Temas[g.Tema]
		g.Nombre, g.Color = t.Nombre, t.Color
		g.Peso = math.Round(g.Peso*10) / 10
		out = append(out, g)
	}
	return out, rows.Err()
}

type itemVideo struct {
	ID       int    `json:"id"`
	Fuente   string `json:"fuente"`
	Ref      string `json:"ref"`
	Autor    string `json:"autor"`
	Texto    string `json:"texto"`
	Tema     string `json:"tema"`
	Nombre   string `json:"temaNombre"`
	Color    string `json:"color"`
	Clase    string `json:"clase"`
	Etiqueta string `json:"etiqueta"`
	Enlace   string `json:"enlace"`
	Libro    *Libro `json:"libro,omitempty"`
}

func (s *Srv) aItem(v Video) itemVideo {
	cat := s.catalogo()
	t := cat.Temas[v.Tema]
	it := itemVideo{ID: v.ID, Fuente: v.Fuente, Ref: v.Ref, Autor: v.Autor, Texto: v.Texto, Tema: v.Tema, Nombre: t.Nombre,
		Color: t.Color, Clase: v.Clase, Etiqueta: v.Etiqueta}
	if v.Fuente == "tiktok" {
		it.Enlace = "https://www.tiktok.com/" + v.Autor + "/video/" + v.Ref
	}
	if l, ok := cat.Libros[v.Libro]; ok {
		it.Libro = &l
	}
	return it
}

// partGeneral es cuanto del feed es contenido general, segun cuantos videos lleva la persona.
// Los tres primeros son todos generales; despues baja poco a poco hasta uno de cada cuatro.
func partGeneral(visto int) float64 {
	if visto < 3 {
		return 1
	}
	return math.Max(0.25, 1-float64(visto-2)/14)
}

const (
	explorar     = 0.15 // parte del feed que explora, despues de los primeros videos
	explorarAl   = 0.40 // y al principio, para que la persona alcance a mostrar lo que le gusta
	rechazado    = -1.5 // con menos peso que esto un tema ya no entra en lo que se explora
	maxSeguidos  = 3    // cuantos videos seguidos puede haber del mismo tema
	reciente     = 8    // los ultimos videos que tiene el cliente nunca se repiten
	pasoRapidoMS = 2000 // un video visto menos que esto cuenta como pasado
)

// cansancio dice cuanto se le quiere bajar a cada tema por lo ultimo que hizo la persona. Si los
// videos mas recientes de un tema los paso rapido, dos o mas seguidos, ese tema baja de golpe,
// aunque su gusto de largo plazo siga alto. Sin esto, quien vio mucho terror y se aburrio seguia
// recibiendo terror durante unos catorce videos. Devuelve un factor por tema, 1 es sin cambio.
func cansancio(cat *Catalogo, e *estadoLector) map[string]float64 {
	type v struct {
		tema   string
		cuando time.Time
		paso   bool
	}
	ult := []v{}
	for id, h := range e.vistos {
		if vid, ok := cat.Videos[id]; ok {
			ult = append(ult, v{vid.Tema, h.ultima, h.salto || h.ms < pasoRapidoMS})
		}
	}
	sort.Slice(ult, func(i, j int) bool { return ult[i].cuando.After(ult[j].cuando) })
	if len(ult) > 12 {
		ult = ult[:12]
	}
	seguidos := map[string]int{}
	cerrado := map[string]bool{}
	for _, x := range ult {
		if cerrado[x.tema] {
			continue
		}
		if x.paso {
			seguidos[x.tema]++
		} else {
			cerrado[x.tema] = true
		}
	}
	f := map[string]float64{}
	for _, t := range cat.Orden {
		f[t] = 1
		if k := seguidos[t]; k >= 2 {
			f[t] = math.Pow(0.35, float64(k-1))
		}
	}
	return f
}

// probTemas reparte la probabilidad de cada tema con el gusto. El que ya va maxSeguidos veces
// seguidas queda fuera para este video. Lo que se explora va primero a los temas que la persona
// casi no ha visto; si no, el primer tema que le gusta un poco se queda con todo y nunca llega a
// ver el que de verdad le gusta. Al principio se explora mas y baja hasta el 15 por ciento.
func probTemas(cat *Catalogo, peso map[string]float64, vistasTema map[string]int, cans map[string]float64, visto int, conGusto bool, cortado string) map[string]float64 {
	p := map[string]float64{}
	if !conGusto {
		for _, t := range cat.Orden {
			if t != cortado {
				p[t] = 1
			}
		}
		return normalizar(p)
	}
	sig := map[string]float64{}
	for _, t := range cat.Orden {
		if t != cortado {
			sig[t] = math.Exp(math.Max(-5, math.Min(30, peso[t]))/4) * cans[t]
		}
	}
	sig = normalizar(sig)
	ex := math.Max(explorar, explorarAl-float64(visto)*0.02)
	nuevo := map[string]float64{}
	for _, t := range cat.Orden {
		if t != cortado && peso[t] > rechazado {
			nuevo[t] = 1 / float64(1+vistasTema[t])
		}
	}
	nuevo = normalizar(nuevo)
	for _, t := range cat.Orden {
		if t == cortado {
			continue
		}
		p[t] = (1-ex)*sig[t] + ex*nuevo[t]
	}
	return normalizar(p)
}

func normalizar(p map[string]float64) map[string]float64 {
	total := 0.0
	for _, v := range p {
		total += v
	}
	if total <= 0 {
		return p
	}
	for k := range p {
		p[k] /= total
	}
	return p
}

// sortear elige una clave con su probabilidad, en orden fijo para que sea reproducible.
func sortear(p map[string]float64) string {
	claves := make([]string, 0, len(p))
	total := 0.0
	for k, v := range p {
		if v > 0 {
			claves = append(claves, k)
			total += v
		}
	}
	if len(claves) == 0 {
		return ""
	}
	sort.Strings(claves)
	x := rand.Float64() * total
	for _, k := range claves {
		x -= p[k]
		if x <= 0 {
			return k
		}
	}
	return claves[len(claves)-1]
}

// feed devuelve n videos para esta persona, sorteados con su gusto.
func (s *Srv) feed(w http.ResponseWriter, r *http.Request, lector string) {
	n, _ := strconv.Atoi(r.URL.Query().Get("n"))
	if n < 1 || n > 12 {
		n = 6
	}
	cat := s.catalogo()
	// lo que el cliente ya tiene, en orden; los ultimos son lo que esta viendo o va a ver
	pantalla := leerPantalla(cat, r)
	e, err := s.estado(r.Context(), lector)
	if err != nil {
		fallo(w, 500, "no pude leer tu gusto")
		return
	}
	responder(w, 200, map[string]any{"videos": s.elegirVideos(cat, e, pantalla, n), "gustos": e.gustos})
}

func (s *Srv) elegirVideos(cat *Catalogo, e *estadoLector, pantalla []int, n int) []itemVideo {
	peso := map[string]float64{}
	vistasTema := map[string]int{}
	for _, g := range e.gustos {
		peso[g.Tema] = g.Peso
		vistasTema[g.Tema] = g.Vistas
	}
	conGusto := false
	for _, g := range e.gustos {
		if g.Peso != 0 {
			conGusto = true
		}
	}
	visto := e.visto
	// lo que el cliente ya tiene cargado tambien cuenta para la mezcla, aunque aun no lo vea
	if len(pantalla) > visto {
		visto = len(pantalla)
	}
	enPantalla := map[int]bool{}
	for _, id := range pantalla {
		enPantalla[id] = true
	}
	cerca := map[int]bool{}
	for i := len(pantalla) - 1; i >= 0 && i >= len(pantalla)-reciente; i-- {
		cerca[pantalla[i]] = true
	}
	// los temas de lo ultimo, para no pasar de maxSeguidos
	temas := []string{}
	for _, id := range pantalla {
		temas = append(temas, cat.Videos[id].Tema)
	}
	ultimoAutor, ultimaEtiqueta := "", ""
	if len(pantalla) > 0 {
		v := cat.Videos[pantalla[len(pantalla)-1]]
		ultimoAutor, ultimaEtiqueta = v.Autor, v.Etiqueta
	}
	ahora := time.Now()
	cans := cansancio(cat, e)
	out := []itemVideo{}
	usados := map[int]bool{}

	// puntaje de un video para este lugar del feed; ok es falso si no se puede poner
	puntaje := func(v Video, clase string) (float64, bool) {
		if usados[v.ID] || cerca[v.ID] {
			return 0, false
		}
		p := 0.0
		h, lo_vio := e.vistos[v.ID]
		switch {
		case !lo_vio && !enPantalla[v.ID]:
			p = 10
		case !lo_vio:
			p = 1 // lo tiene el cliente desde hace rato y aun no llega la vista
		case h.salto || h.ms < pasoRapidoMS:
			return 0, false
		default:
			p = 2 + math.Min(ahora.Sub(h.ultima).Minutes()/20, 3) + math.Min(float64(h.ms)/10000, 2)
		}
		if v.Clase == clase {
			p += 3
		}
		if v.Autor == ultimoAutor {
			p -= 4
		}
		if v.Clase == "general" && v.Etiqueta == ultimaEtiqueta {
			p -= 2
		}
		return p + rand.Float64()*1.5, true
	}
	elegir := func(tema, clase string) (Video, bool) {
		var mejor Video
		mejorP, hay := math.Inf(-1), false
		for _, id := range cat.PorTema[tema] {
			v := cat.Videos[id]
			if p, ok := puntaje(v, clase); ok && p > mejorP {
				mejor, mejorP, hay = v, p, true
			}
		}
		return mejor, hay
	}

	for len(out) < n {
		clase := "libros"
		if rand.Float64() < partGeneral(visto+len(out)) {
			clase = "general"
		}
		cortado := ""
		if k := len(temas); k >= maxSeguidos {
			igual := true
			for _, t := range temas[k-maxSeguidos:] {
				if t != temas[k-1] {
					igual = false
				}
			}
			if igual {
				cortado = temas[k-1]
			}
		}
		prob := probTemas(cat, peso, vistasTema, cans, visto+len(out), conGusto, cortado)
		var v Video
		listo := false
		for intento := 0; intento < len(cat.Orden) && !listo; intento++ {
			t := sortear(prob)
			if t == "" {
				break
			}
			if v, listo = elegir(t, clase); !listo {
				delete(prob, t)
			}
		}
		if !listo {
			// ningun tema tiene nada que se pueda poner; se suelta lo de cerca, menos este lote
			cerca = map[int]bool{}
			for _, t := range cat.Orden {
				if c, ok := elegir(t, clase); ok {
					v, listo = c, true
					break
				}
			}
			if !listo {
				break
			}
		}
		usados[v.ID] = true
		temas = append(temas, v.Tema)
		ultimoAutor, ultimaEtiqueta = v.Autor, v.Etiqueta
		out = append(out, s.aItem(v))
	}
	return out
}

type pedidoVista struct {
	Video   int  `json:"video"`
	MS      int  `json:"ms"`
	Vueltas int  `json:"vueltas"`
	Salto   bool `json:"salto"`
	Gusta   bool `json:"gusta"`
}

func (s *Srv) vista(w http.ResponseWriter, r *http.Request, lector string) {
	var p pedidoVista
	if !leerJSON(w, r, &p) {
		return
	}
	if _, ok := s.catalogo().Videos[p.Video]; !ok {
		fallo(w, 400, "video desconocido")
		return
	}
	if p.MS < 0 {
		p.MS = 0
	}
	if p.MS > 600000 {
		p.MS = 600000
	}
	if p.Vueltas < 0 || p.Vueltas > 50 {
		p.Vueltas = 0
	}
	// cada vuelta suma 2 al gusto. Mas de tres no dicen mas interes: un video que se repite solo
	// mientras alguien habla en una presentacion daba 20 vueltas y se quedaba con todo el gusto.
	if p.Vueltas > 3 {
		p.Vueltas = 3
	}
	if !s.limites.deja("vista:"+lector, 3, 20) {
		fallo(w, 429, "muy rapido")
		return
	}
	// la vista se guarda aunque la persona cierre la app a media peticion
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 10*time.Second)
	defer cancel()
	if _, err := s.db.Exec(ctx, `INSERT INTO vistas (lector, video, ms, vueltas, salto, gusta) VALUES ($1,$2,$3,$4,$5,$6)`,
		lector, p.Video, p.MS, p.Vueltas, p.Salto, p.Gusta); err != nil {
		fallo(w, 500, "no pude guardar la vista")
		return
	}
	s.cache.olvidar(lector)
	gs, _ := s.gustos(ctx, lector)
	responder(w, 200, map[string]any{"gustos": gs})
}

type itemMicro struct {
	ID      int64   `json:"id"`
	Lectura Lectura `json:"lectura"`
	Motivo  string  `json:"motivo"`
	Color   string  `json:"color"`
	Nombre  string  `json:"temaNombre"`
	Libro   *Libro  `json:"libro,omitempty"`
	Gustos  []gusto `json:"gustos"`
}

// recienteTema es lo que la persona acaba de hacer con un tema, en sus ultimos videos.
type recienteTema struct {
	ms       int64  // lo que se quedo de verdad, sin contar lo que paso rapido
	vistas   int    // los videos en los que se quedo
	etiqueta string // la etiqueta en la que mas se quedo dentro del tema
	etiMS    int64
	mezcla   bool // se quedo en videos de mas de una etiqueta
	saltos   int
	etiSalto string // la etiqueta que mas paso rapido
}

// por que se eligio una micro lectura, para escribir el motivo sin mentir
const (
	porGusto    = iota // es del tema que mas le gusta
	porGuardada        // es del tema que mas le gusta y ya se la habian puesto sin que la abriera
	porOtro            // es de otro tema, porque del suyo ya no hay
	porEmpezar         // todavia no hay ningun gusto
)

const quedoMS = 4000 // para decir te quedaste, la persona tuvo que quedarse al menos esto

// La micro lectura sale de lo que la persona acaba de ver, no de su gusto de dias. El 04-11 Meme
// vio una leyenda de terror 43 segundos y le salio una de Latinoamerica, porque su terror venia
// abajo de otros dias; al pasar tres videos rapido le salia igual un texto adivinado; y al volver
// a un texto que se habia elegido minutos antes seguia el viejo. Desde entonces la micro sale del
// tema que lo atrapo en sus ultimos videos, y si todavia no hay uno claro no se adivina: en ese
// lugar va otro video y la lectura espera al siguiente lugar.
const (
	ventanaMicro  = 20 * time.Minute // lo que cuenta como lo que acaba de ver
	maxVentana    = 12               // y a lo mas tantos videos
	bajaPorVideo  = 0.8              // cada video mas atras pesa esto del que sigue
	umbralAtrapo  = 3.0              // puntos para estar seguro, unos 4 segundos en el ultimo video
	forzarDespues = 9                // videos seguidos sin lectura; despues sale la del gusto de siempre
)

type vistaReciente struct {
	tema, etiqueta string
	ms             int
	paso, gusta    bool
	cuando         time.Time
}

// recientes son las ultimas vistas de la persona, la mas nueva primero. Salen del estado que ya
// esta en la cache, sin otra consulta.
func recientes(cat *Catalogo, e *estadoLector, ahora time.Time) []vistaReciente {
	out := []vistaReciente{}
	for id, h := range e.vistos {
		v, ok := cat.Videos[id]
		if !ok || ahora.Sub(h.ultima) > ventanaMicro {
			continue
		}
		out = append(out, vistaReciente{v.Tema, v.Etiqueta, h.ms, h.salto || h.ms < pasoRapidoMS, h.gusta, h.ultima})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].cuando.After(out[j].cuando) })
	if len(out) > maxVentana {
		out = out[:maxVentana]
	}
	return out
}

// resumenReciente junta por tema lo de recientes, para escribir el motivo.
func resumenReciente(rs []vistaReciente) map[string]*recienteTema {
	rec := map[string]*recienteTema{}
	quedo, paso := map[string]map[string]int64{}, map[string]map[string]int64{}
	for _, r := range rs {
		x := rec[r.tema]
		if x == nil {
			x = &recienteTema{}
			rec[r.tema] = x
			quedo[r.tema], paso[r.tema] = map[string]int64{}, map[string]int64{}
		}
		if r.paso {
			x.saltos++
			paso[r.tema][r.etiqueta]++
		} else {
			x.ms += int64(r.ms)
			x.vistas++
			quedo[r.tema][r.etiqueta] += int64(r.ms)
		}
	}
	for t, x := range rec {
		x.mezcla = len(quedo[t]) > 1
		for eti, ms := range quedo[t] {
			if ms > x.etiMS {
				x.etiqueta, x.etiMS = eti, ms
			}
		}
		n := int64(0)
		for eti, k := range paso[t] {
			if k > n {
				x.etiSalto, n = eti, k
			}
		}
	}
	return rec
}

// atrapo le da puntos a cada tema con lo ultimo que vio. Cada segundo que se quedo suma, hasta
// 30 por video, el corazon suma 5 y pasarlo rapido resta 1.5; lo mas nuevo pesa mas.
func atrapo(rs []vistaReciente) map[string]float64 {
	p := map[string]float64{}
	w := 1.0
	for _, r := range rs {
		if r.paso {
			p[r.tema] -= 1.5 * w
		} else {
			p[r.tema] += w * math.Min(float64(r.ms), 30000) / 1000
		}
		if r.gusta {
			p[r.tema] += 5 * w
		}
		w *= bajaPorVideo
	}
	return p
}

// cansados son los temas cuyos dos o mas videos mas recientes los paso rapido. Aunque antes se
// haya quedado mucho en ellos, ya no se esta seguro de que lo atrapen.
func cansados(rs []vistaReciente) map[string]bool {
	seguidos, cerrado := map[string]int{}, map[string]bool{}
	for _, r := range rs {
		if cerrado[r.tema] {
			continue
		}
		if r.paso {
			seguidos[r.tema]++
		} else {
			cerrado[r.tema] = true
		}
	}
	out := map[string]bool{}
	for t, k := range seguidos {
		if k >= 2 {
			out[t] = true
		}
	}
	return out
}

// desdeLaUltima cuenta los videos que vio desde la ultima micro lectura que se le puso.
func desdeLaUltima(e *estadoLector, rs []vistaReciente) int {
	var ult time.Time
	for _, m := range e.micros {
		if m.ultima.After(ult) {
			ult = m.ultima
		}
	}
	n := 0
	for _, r := range rs {
		if r.cuando.After(ult) {
			n++
		}
	}
	return n
}

// leerPantalla son los videos que el cliente ya tiene, en orden.
func leerPantalla(cat *Catalogo, r *http.Request) []int {
	pantalla := []int{}
	for _, p := range strings.Split(r.URL.Query().Get("excluir"), ",") {
		if id, err := strconv.Atoi(p); err == nil {
			if _, ok := cat.Videos[id]; ok {
				pantalla = append(pantalla, id)
			}
		}
	}
	return pantalla
}

// micro elige la lectura corta que va despues de tres videos, o dice que todavia no.
func (s *Srv) micro(w http.ResponseWriter, r *http.Request, lector string) {
	ctx := r.Context()
	cat := s.catalogo()
	e, err := s.estado(ctx, lector)
	if err != nil {
		fallo(w, 500, "no pude leer tu gusto")
		return
	}
	gs := e.gustos
	rs := recientes(cat, e, time.Now())
	rec := resumenReciente(rs)
	var nivel int
	s.db.QueryRow(ctx, `SELECT nivel FROM lectores WHERE id = $1`, lector).Scan(&nivel)

	l, por, ok := elegirPorAtrapo(cat, e, rs, rec, nivel)
	if !ok {
		// todavia no esta claro que lo atrapo; en vez de adivinar, otro video. Si ya van muchos
		// sin lectura, sale la de su gusto de siempre, con el motivo que de verdad tiene.
		// solo el cliente nuevo sabe poner un video en el lugar de la lectura; uno viejo que siga
		// en cache recibe siempre lectura
		if r.URL.Query().Get("espera") == "1" && desdeLaUltima(e, rs) < forzarDespues {
			if vs := s.elegirVideos(cat, e, leerPantalla(cat, r), 1); len(vs) > 0 {
				responder(w, 200, map[string]any{"espera": true, "video": vs[0], "gustos": gs})
				return
			}
		}
		l, por, ok = elegirMicro(cat, e, rec, nivel)
	}
	if !ok {
		fallo(w, 404, "no hay lecturas")
		return
	}
	t := cat.Temas[l.Tema]
	motivo := motivoMicro(t, por, gs, rec, cat)
	var id int64
	if err := s.db.QueryRow(ctx, `INSERT INTO micros (lector, lectura, motivo) VALUES ($1,$2,$3) RETURNING id`, lector, l.ID, motivo).Scan(&id); err != nil {
		fallo(w, 500, "no pude guardar la micro lectura")
		return
	}
	s.cache.olvidar(lector)
	s.estado(ctx, lector)
	corta := l
	corta.Paginas = nil
	it := itemMicro{ID: id, Lectura: corta, Motivo: motivo, Color: t.Color, Nombre: t.Nombre, Gustos: gs}
	if lb, ok := cat.Libros[l.Libro]; ok {
		it.Libro = &lb
	}
	responder(w, 200, it)
}

// elegirPorAtrapo busca la lectura del tema que de verdad atrapo a la persona en sus ultimos
// videos: con puntos de sobra y al menos 4 segundos que se quedo. Del tema, primero una que no
// ha visto; si no, una suya que ya se le puso y no termino, la de hace mas tiempo, mejor si no
// estuvo entre las tres ultimas y nunca la que se le acaba de poner. Un tema cuyos dos ultimos
// videos paso rapido no cuenta. Si ningun tema lo atrapo, no hay lectura.
func elegirPorAtrapo(cat *Catalogo, e *estadoLector, rs []vistaReciente, rec map[string]*recienteTema, nivel int) (Lectura, int, bool) {
	puntos := atrapo(rs)
	cans := cansados(rs)
	peso := map[string]float64{}
	for _, g := range e.gustos {
		peso[g.Tema] = g.Peso
	}
	cand := []string{}
	for t, p := range puntos {
		if p >= umbralAtrapo && !cans[t] && rec[t] != nil && rec[t].ms >= quedoMS && len(cat.LectTema[t]) > 0 {
			cand = append(cand, t)
		}
	}
	// si dos temas lo atraparon casi igual, desempata un poco su gusto de siempre
	valor := func(t string) float64 { return puntos[t] + 0.2*math.Max(-3, math.Min(3, peso[t])) }
	sort.Slice(cand, func(i, j int) bool {
		if valor(cand[i]) != valor(cand[j]) {
			return valor(cand[i]) > valor(cand[j])
		}
		return cand[i] < cand[j]
	})
	tres, una := ultimasMicros(e, 3), ultimasMicros(e, 1)
	for _, t := range cand {
		if c := nuevasDeTema(cat, e, t); len(c) > 0 {
			return mejorLectura(c, nivel, len(e.terminadas)), porOtro, true
		}
		for _, evitar := range []map[string]bool{tres, una} {
			var mejor Lectura
			var cuando time.Time
			for _, id := range cat.LectTema[t] {
				m, ya := e.micros[id]
				if ya && !e.terminadas[id] && !evitar[id] && (cuando.IsZero() || m.ultima.Before(cuando)) {
					mejor, cuando = cat.Lecturas[id], m.ultima
				}
			}
			if !cuando.IsZero() {
				return mejor, porGuardada, true
			}
		}
	}
	return Lectura{}, porOtro, false
}

// nuevasDeTema son las lecturas del tema que no se le han puesto ni termino.
func nuevasDeTema(cat *Catalogo, e *estadoLector, t string) []Lectura {
	c := []Lectura{}
	for _, id := range cat.LectTema[t] {
		if _, ya := e.micros[id]; !ya && !e.terminadas[id] {
			c = append(c, cat.Lecturas[id])
		}
	}
	return c
}

// mejorLectura prefiere lo de su nivel y, para quien todavia no termina ninguna, lo mas corto
// de todo.
// Asi la primera lectura es facil de terminar, como pidio José David.
func mejorLectura(cand []Lectura, nivel, terminadas int) Lectura {
	dist := func(l Lectura) int {
		d := l.Nivel - nivel
		if d < 0 {
			d = -d
		}
		return d
	}
	// la primera de todas, la mas corta aunque sea de otro nivel: en la demo del 04-11 salio una
	// de 7 paginas de su nivel habiendo de 3 del siguiente
	primera := terminadas == 0
	sort.SliceStable(cand, func(i, j int) bool {
		pi, pj := len(cand[i].Paginas), len(cand[j].Paginas)
		if primera && pi != pj {
			return pi < pj
		}
		if dist(cand[i]) != dist(cand[j]) {
			return dist(cand[i]) < dist(cand[j])
		}
		return pi < pj
	})
	tope := 1
	for tope < len(cand) && tope < 2 && dist(cand[tope]) == dist(cand[0]) && (!primera || len(cand[tope].Paginas) == len(cand[0].Paginas)) {
		tope++
	}
	return cand[rand.IntN(tope)]
}

// elegirMicro busca la lectura en este orden. Una que no ha visto del tema que mas le gusta, o
// de uno casi igual de fuerte. Si ya se acabaron, otra vez una del tema que mas le gusta que se
// le puso hace rato y no abrio. Si tampoco, una nueva de otro tema, por gusto. Y si ya vio todo,
// la que vio hace mas tiempo. Nunca una que ya termino, mientras haya otra.
func elegirMicro(cat *Catalogo, e *estadoLector, rec map[string]*recienteTema, nivel int) (Lectura, int, bool) {
	gs := e.gustos
	// orden de temas, primero el de mas peso; si aun no hay gusto, el de mas segundos recientes
	// el peso de cada tema, bajado si la persona se aburrio de el hace poco
	cans := cansancio(cat, e)
	efectivo := map[string]float64{}
	orden := []string{}
	topPeso := 0.0
	for _, g := range gs {
		if g.Peso > 0 {
			efectivo[g.Tema] = g.Peso * cans[g.Tema]
			orden = append(orden, g.Tema)
		}
	}
	sort.SliceStable(orden, func(i, j int) bool { return efectivo[orden[i]] > efectivo[orden[j]] })
	if len(orden) > 0 {
		topPeso = efectivo[orden[0]]
	}
	if len(orden) == 0 {
		for t := range rec {
			orden = append(orden, t)
		}
		sort.Slice(orden, func(i, j int) bool { return rec[orden[i]].ms > rec[orden[j]].ms })
	}
	for _, t := range cat.Orden {
		ya := false
		for _, o := range orden {
			if o == t {
				ya = true
			}
		}
		if !ya {
			orden = append(orden, t)
		}
	}
	peso := efectivo
	top := ""
	if topPeso > 0 {
		top = orden[0]
	}
	// lo que mas le gusta de verdad, por el gusto de largo plazo; solo de ese se dice que es lo que
	// mas le gusta, aunque por cansancio la lectura salga de otro tema
	deVerdad := ""
	for _, g := range gs {
		if g.Peso > 0 {
			deVerdad = g.Tema
			break
		}
	}
	gusto := func(t string) int {
		if t == deVerdad {
			return porGusto
		}
		return porOtro
	}
	terminadas := len(e.terminadas)
	mejorDe := func(c []Lectura) Lectura { return mejorLectura(c, nivel, terminadas) }
	nuevas := func(t string) []Lectura { return nuevasDeTema(cat, e, t) }
	// 1. nuevas del tema que mas le gusta, o de uno que le gusta casi igual
	for _, t := range orden {
		if top == "" || peso[t] < 0.6*topPeso {
			break
		}
		if c := nuevas(t); len(c) > 0 {
			if t == top {
				return mejorDe(c), gusto(t), true
			}
			return mejorDe(c), porOtro, true
		}
	}
	// 2. del tema que mas le gusta, una que no abrio y que no estuvo entre las tres ultimas
	if top != "" {
		ultimas := ultimasMicros(e, 3)
		var mejor Lectura
		var cuando time.Time
		for _, id := range cat.LectTema[top] {
			m, ya := e.micros[id]
			if ya && !m.abierta && !e.terminadas[id] && !ultimas[id] && (cuando.IsZero() || m.ultima.Before(cuando)) {
				mejor, cuando = cat.Lecturas[id], m.ultima
			}
		}
		if !cuando.IsZero() {
			if top != deVerdad {
				return mejor, porOtro, true
			}
			return mejor, porGuardada, true
		}
	}
	// 3. nuevas de otro tema, por gusto
	for _, t := range orden {
		if c := nuevas(t); len(c) > 0 {
			switch {
			case top == "":
				return mejorDe(c), porEmpezar, true
			case t == top:
				return mejorDe(c), gusto(t), true
			}
			return mejorDe(c), porOtro, true
		}
	}
	// 4. ya vio todo; la que vio hace mas tiempo, primero de su tema
	var mejor Lectura
	var cuando time.Time
	hay := false
	for _, t := range orden {
		for _, id := range cat.LectTema[t] {
			if e.terminadas[id] {
				continue
			}
			m := e.micros[id]
			if !hay || m.ultima.Before(cuando) {
				mejor, cuando, hay = cat.Lecturas[id], m.ultima, true
			}
		}
		if hay {
			if t == top && t == deVerdad && !e.micros[mejor.ID].abierta {
				return mejor, porGuardada, true
			}
			return mejor, porOtro, true
		}
	}
	for _, id := range cat.Orden {
		for _, lid := range cat.LectTema[id] {
			return cat.Lecturas[lid], porOtro, true
		}
	}
	return Lectura{}, porOtro, false
}

// ultimasMicros son las n micro lecturas que se le pusieron mas recientemente.
func ultimasMicros(e *estadoLector, n int) map[string]bool {
	ids := make([]string, 0, len(e.micros))
	for id := range e.micros {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return e.micros[ids[i]].ultima.After(e.micros[ids[j]].ultima) })
	out := map[string]bool{}
	for i := 0; i < n && i < len(ids); i++ {
		out[ids[i]] = true
	}
	return out
}

// lo que se vio, dicho como lo diria una persona, en singular y en plural
var queSeVio = map[string][2]string{
	"Frutinovela": {"una frutinovela", "frutinovelas"},
	"Risa":        {"un video de risa", "videos de risa"},
	"Para armar":  {"un video de armar cosas", "videos de armar cosas"},
	"Cubo Rubik":  {"un video del cubo Rubik", "videos del cubo Rubik"},
	"Pixel art":   {"un video de pixel art", "videos de pixel art"},
	"Caricatura":  {"una caricatura", "caricaturas"},
	"Leyenda":     {"una leyenda", "leyendas"},
	"Espacio":     {"un video del espacio", "videos del espacio"},
}

// el puente de lo que se vio a lo que se va a leer, uno por tema
var puente = map[string]string{
	"terror":        "Esta da más miedo",
	"romantasy":     "Aquí va una historia de amor de verdad",
	"fantasia":      "Aquí va un cuento con magia",
	"misterio":      "Aquí va un misterio para resolver",
	"distopia":      "Aquí va un futuro que da que pensar",
	"espacio":       "Aquí va una historia fuera de este mundo",
	"clasicos":      "Aquí va un clásico con más drama que una telenovela",
	"latinoamerica": "Aquí va una historia de nuestra tierra",
}

func loQueVio(x *recienteTema, tema string) string {
	if f, ok := queSeVio[x.etiqueta]; ok && !x.mezcla {
		if x.vistas > 1 {
			return f[1]
		}
		return f[0]
	}
	if x.vistas > 1 {
		return fmt.Sprintf("%d videos de %s", x.vistas, tema)
	}
	return "un video de " + tema
}

// motivoMicro escribe por que salio esta lectura, con lo que la persona acaba de hacer, y solo
// dice que es lo que mas le gusta cuando de verdad lo es.
func motivoMicro(t Tema, por int, gs []gusto, rec map[string]*recienteTema, cat *Catalogo) string {
	nombre := strings.ToLower(t.Nombre)
	peso := map[string]float64{}
	for _, g := range gs {
		peso[g.Tema] = g.Peso
	}
	propio := rec[t.Clave]
	if por == porGuardada && (propio == nil || propio.ms < quedoMS) {
		return "Te la guardamos, va con lo que más te gusta, " + nombre
	}
	if propio == nil || propio.ms < quedoMS {
		switch {
		case por == porGusto:
			return "Va con lo que más te gusta, " + nombre
		case por == porEmpezar:
			return "Para empezar, " + minuscula(puente[t.Clave])
		case peso[t.Clave] > 0:
			return "También te gusta " + nombre + ". " + puente[t.Clave]
		}
		return "Para variar, " + minuscula(puente[t.Clave])
	}
	vio := loQueVio(propio, nombre)
	m := fmt.Sprintf("Te quedaste %s en %s", segundosTexto(propio.ms), vio)
	// lo que paso rapido, dos o mas veces, de otro tema
	otro, saltos := "", 1
	for k, x := range rec {
		if k != t.Clave && (x.saltos > saltos || (x.saltos == saltos && otro != "" && k < otro)) {
			otro, saltos = k, x.saltos
		}
	}
	if otro != "" {
		x, nom := rec[otro], strings.ToLower(cat.Temas[otro].Nombre)
		paso := loQueVio(&recienteTema{vistas: x.saltos, etiqueta: x.etiSalto}, nom)
		// hay leyendas de terror y de Latinoamerica; si suena igual que lo que vio, se dice el tema
		if paso == vio || x.etiSalto == propio.etiqueta || x.etiSalto == "Leyenda" {
			paso = fmt.Sprintf("%d videos de %s", x.saltos, nom)
		}
		m += " y pasaste rápido " + paso
	}
	p := puente[t.Clave]
	// el chiste de la telenovela es para quien viene de una frutinovela; despues de una caricatura
	// de 1933 o de un video de armar cosas sonaba raro (04-11)
	if t.Clave == "clasicos" && propio.etiqueta != "Frutinovela" {
		p = "Aquí va un clásico que no pasa de moda"
	}
	if p != "" {
		m += ". " + p
	}
	if por == porGuardada {
		m = "Te la guardamos. " + m
	}
	return m
}

func minuscula(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	r[0] = []rune(strings.ToLower(string(r[0])))[0]
	return string(r)
}

// segundosTexto dice el tiempo como lo diria una persona; desde un minuto, en minutos, que
// "te quedaste 312 segundos" suena a maquina.
func segundosTexto(ms int64) string {
	seg := int(math.Round(float64(ms) / 1000))
	switch {
	case seg == 1:
		return "1 segundo"
	case seg < 60:
		return fmt.Sprintf("%d segundos", seg)
	case seg < 90:
		return "1 minuto"
	}
	return fmt.Sprintf("%d minutos", int(math.Round(float64(seg)/60)))
}
