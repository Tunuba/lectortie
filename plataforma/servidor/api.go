package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var aliasValido = regexp.MustCompile(`^[a-z0-9._]{3,20}$`)

type perfil struct {
	ID          string  `json:"id"`
	Alias       string  `json:"alias"`
	Correo      string  `json:"correo"`
	Nivel       int     `json:"nivel"`
	Racha       int     `json:"racha"`
	MejorRacha  int     `json:"mejorRacha"`
	Paginas     int     `json:"paginas"`
	Puntos      int     `json:"puntos"`
	Terminadas  int     `json:"terminadas"`
	Videos      int     `json:"videos"`
	Encuesta    bool    `json:"encuesta"`
	LeyoHoy     bool    `json:"leyoHoy"`
	Gustos      []gusto `json:"gustos"`
	Temas       []Tema  `json:"temas"`
	CorreoListo bool    `json:"correoListo"`
}

func (s *Srv) leerPerfil(ctx context.Context, id string) (perfil, error) {
	var p perfil
	var alias, correo *string
	err := s.db.QueryRow(ctx, `SELECT id::text, alias, correo, nivel, racha, mejor_racha, paginas, puntos,
		  coalesce(ultimo_dia = (now() AT TIME ZONE 'America/Guatemala')::date, false),
		  (SELECT count(DISTINCT lectura) FROM lecturas_hechas WHERE lector = l.id AND terminada),
		  (SELECT count(*) FROM vistas WHERE lector = l.id),
		  EXISTS (SELECT 1 FROM encuesta WHERE lector = l.id)
		FROM lectores l WHERE id = $1`, id).Scan(&p.ID, &alias, &correo, &p.Nivel, &p.Racha, &p.MejorRacha, &p.Paginas, &p.Puntos,
		&p.LeyoHoy, &p.Terminadas, &p.Videos, &p.Encuesta)
	if err != nil {
		return p, err
	}
	if alias != nil {
		p.Alias = *alias
	}
	if correo != nil {
		p.Correo = tapar(*correo)
	}
	// la racha se rompe si paso un dia entero sin leer
	if p.Racha > 0 {
		var viva bool
		s.db.QueryRow(ctx, `SELECT ultimo_dia >= (now() AT TIME ZONE 'America/Guatemala')::date - 1 FROM lectores WHERE id = $1`, id).Scan(&viva)
		if !viva {
			p.Racha = 0
		}
	}
	p.Gustos, err = s.gustos(ctx, id)
	cat := s.catalogo()
	for _, k := range cat.Orden {
		p.Temas = append(p.Temas, cat.Temas[k])
	}
	p.CorreoListo = s.cfg.correoListo()
	return p, err
}

func tapar(correo string) string {
	u, d, ok := strings.Cut(correo, "@")
	if !ok || len(u) < 2 {
		return correo
	}
	return u[:2] + strings.Repeat("•", min(6, len(u)-2)) + "@" + d
}

func (s *Srv) yo(w http.ResponseWriter, r *http.Request, id string) {
	p, err := s.leerPerfil(r.Context(), id)
	if err != nil {
		fallo(w, 500, "no pude leer tu perfil")
		return
	}
	responder(w, 200, p)
}

type pedidoEntrada struct {
	Alias string   `json:"alias"`
	Temas []string `json:"temas"`
}

// entrada guarda el alias y los temas que la persona eligio al entrar. Cada tema elegido
// arranca con un poco de peso, para que el primer lote ya se parezca a ella.
func (s *Srv) entrada(w http.ResponseWriter, r *http.Request, id string) {
	var p pedidoEntrada
	if !leerJSON(w, r, &p) {
		return
	}
	p.Alias = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(p.Alias, "@")))
	ctx := r.Context()
	if p.Alias != "" {
		if !aliasValido.MatchString(p.Alias) {
			fallo(w, 400, "El alias lleva de 3 a 20 letras, números, punto o guion bajo")
			return
		}
		if !aliasLimpio(p.Alias) {
			fallo(w, 400, "Ese alias no se puede usar")
			return
		}
		if _, err := s.db.Exec(ctx, `UPDATE lectores SET alias = $2 WHERE id = $1`, id, p.Alias); err != nil {
			if strings.Contains(err.Error(), "lectores_alias_key") {
				fallo(w, 409, "Ese alias ya lo tiene alguien")
				return
			}
			fallo(w, 500, "no pude guardar el alias")
			return
		}
	}
	cat := s.catalogo()
	for i, t := range p.Temas {
		if i >= 4 {
			break
		}
		if _, ok := cat.Temas[t]; !ok {
			continue
		}
		s.db.Exec(ctx, `INSERT INTO gustos (lector, tema, peso) VALUES ($1, $2, 3) ON CONFLICT (lector, tema) DO UPDATE SET peso = gustos.peso + 3`, id, t)
	}
	if p.Alias != "" {
		s.actividad(ctx, id, "entro", "@"+p.Alias+" se unió a lectortie")
	}
	s.yo(w, r, id)
}

// ---------- leer ----------

func (s *Srv) abrirMicro(w http.ResponseWriter, r *http.Request, lector string) {
	var lectura string
	err := s.db.QueryRow(r.Context(), `UPDATE micros SET abierta = true WHERE id = $1 AND lector = $2 RETURNING lectura`,
		r.PathValue("id"), lector).Scan(&lectura)
	if err != nil {
		fallo(w, 404, "esa micro lectura no es tuya")
		return
	}
	responder(w, 200, map[string]string{"lectura": lectura})
}

type comentario struct {
	Alias  string    `json:"alias"`
	Texto  string    `json:"texto"`
	Creado time.Time `json:"creado"`
}

func (s *Srv) lectura(w http.ResponseWriter, r *http.Request, lector string) {
	cat := s.catalogo()
	l, ok := cat.Lecturas[r.PathValue("id")]
	if !ok {
		fallo(w, 404, "no existe esa lectura")
		return
	}
	com := []comentario{}
	rows, err := s.db.Query(r.Context(), `SELECT coalesce(le.alias, 'alguien'), c.texto, c.creado FROM comentarios c
		JOIN lectores le ON le.id = c.lector WHERE c.lectura = $1 ORDER BY c.creado DESC LIMIT 20`, l.ID)
	if err == nil {
		for rows.Next() {
			var c comentario
			rows.Scan(&c.Alias, &c.Texto, &c.Creado)
			com = append(com, c)
		}
		rows.Close()
	}
	var lectores int
	s.db.QueryRow(r.Context(), `SELECT count(DISTINCT lector) FROM lecturas_hechas WHERE lectura = $1`, l.ID).Scan(&lectores)
	t := cat.Temas[l.Tema]
	res := map[string]any{"lectura": l, "comentarios": com, "lectores": lectores, "color": t.Color, "temaNombre": t.Nombre,
		"minimo": minimoSegundos(len(l.Paginas))}
	if lb, ok := cat.Libros[l.Libro]; ok {
		res["libro"] = lb
	}
	responder(w, 200, res)
}

type pedidoTerminar struct {
	Segundos  int  `json:"segundos"`
	Paginas   int  `json:"paginas"`
	Terminada bool `json:"terminada"`
}

func (s *Srv) terminar(w http.ResponseWriter, r *http.Request, lector string) {
	var p pedidoTerminar
	if !leerJSON(w, r, &p) {
		return
	}
	cat := s.catalogo()
	l, ok := cat.Lecturas[r.PathValue("id")]
	if !ok {
		fallo(w, 404, "no existe esa lectura")
		return
	}
	if p.Paginas < 0 || p.Paginas > len(l.Paginas) {
		p.Paginas = len(l.Paginas)
	}
	if p.Segundos < 0 || p.Segundos > 14400 {
		fallo(w, 400, "tiempo raro")
		return
	}
	// nadie lee una pagina en menos de tres segundos; si fue mas rapido se guarda lo leido,
	// pero no cuenta como terminada ni prende la racha, y la pantalla lo dice
	if p.Terminada && p.Segundos < minimoSegundos(len(l.Paginas)) {
		p.Terminada = false
	}
	if !s.limites.deja("leer:"+lector, 0.2, 6) {
		fallo(w, 429, "muy rapido")
		return
	}
	ctx := r.Context()
	if _, err := s.db.Exec(ctx, `INSERT INTO lecturas_hechas (lector, lectura, segundos, paginas, terminada) VALUES ($1,$2,$3,$4,$5)`,
		lector, l.ID, p.Segundos, p.Paginas, p.Terminada); err != nil {
		fallo(w, 500, "no pude guardar la lectura")
		return
	}
	pf, _ := s.leerPerfil(ctx, lector)
	quien := "Alguien"
	if pf.Alias != "" {
		quien = "@" + pf.Alias
	}
	if p.Terminada {
		s.actividad(ctx, lector, "termino", fmt.Sprintf("%s terminó %s", quien, l.Titulo))
	} else if p.Paginas > 0 {
		s.actividad(ctx, lector, "leyo", fmt.Sprintf("%s leyó %d páginas de %s", quien, p.Paginas, l.Titulo))
	}
	var lectores int
	s.db.QueryRow(ctx, `SELECT count(DISTINCT lector) FROM lecturas_hechas WHERE lectura = $1`, l.ID).Scan(&lectores)
	responder(w, 200, struct {
		perfil
		Contada  bool `json:"contada"`
		Lectores int  `json:"lectores"`
	}{pf, p.Terminada, lectores})
}

// minimoSegundos es lo menos que tarda alguien en leer de verdad tantas paginas.
func minimoSegundos(paginas int) int { return 3 * paginas }

type pedidoComentario struct {
	Texto string `json:"texto"`
}

func (s *Srv) comentar(w http.ResponseWriter, r *http.Request, lector string) {
	var p pedidoComentario
	if !leerJSON(w, r, &p) {
		return
	}
	p.Texto = strings.TrimSpace(p.Texto)
	l, ok := s.catalogo().Lecturas[r.PathValue("id")]
	if !ok {
		fallo(w, 404, "no existe esa lectura")
		return
	}
	if len([]rune(p.Texto)) < 1 || len([]rune(p.Texto)) > 280 {
		fallo(w, 400, "El comentario va de 1 a 280 letras")
		return
	}
	if !limpio(p.Texto) {
		fallo(w, 400, "Ese comentario no se puede publicar")
		return
	}
	if !s.limites.deja("comentar:"+lector, 0.05, 3) {
		fallo(w, 429, "Espera un poco antes de comentar otra vez")
		return
	}
	ctx := r.Context()
	if _, err := s.db.Exec(ctx, `INSERT INTO comentarios (lector, lectura, texto) VALUES ($1,$2,$3)`, lector, l.ID, p.Texto); err != nil {
		fallo(w, 500, "no pude guardar el comentario")
		return
	}
	var alias *string
	s.db.QueryRow(ctx, `SELECT alias FROM lectores WHERE id = $1`, lector).Scan(&alias)
	quien := "Alguien"
	if alias != nil {
		quien = "@" + *alias
	}
	s.actividad(ctx, lector, "comento", fmt.Sprintf("%s comentó %s", quien, l.Titulo))
	responder(w, 200, comentario{Alias: strings.TrimPrefix(quien, "@"), Texto: p.Texto, Creado: time.Now()})
}

func (s *Srv) libros(w http.ResponseWriter, r *http.Request) {
	cat := s.catalogo()
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	out := []Libro{}
	if q != "" {
		rows, err := s.db.Query(r.Context(), `SELECT id FROM libros WHERE titulo % $1 OR lower(titulo) LIKE '%' || $1 || '%' OR lower(autor) LIKE '%' || $1 || '%'
			ORDER BY similarity(titulo, $1) DESC LIMIT 20`, q)
		if err == nil {
			for rows.Next() {
				var id string
				rows.Scan(&id)
				out = append(out, cat.Libros[id])
			}
			rows.Close()
		}
	} else {
		for _, l := range cat.Libros {
			out = append(out, l)
		}
	}
	responder(w, 200, map[string]any{"libros": out})
}

// ---------- libros para ti, con la red neuronal ----------

type libroParaTi struct {
	Libro    Libro    `json:"libro"`
	Parecido int      `json:"parecido"`
	Porque   []string `json:"porque"`
}

// paraMi ordena los libros por cuanto se parecen a tu gusto. Tu gusto es el peso de cada tema,
// que suben los videos segun su vector, y cada libro tiene su vector de la red. Gana el que
// mas se parece, medido con el coseno entre los dos vectores.
func (s *Srv) paraMi(w http.ResponseWriter, r *http.Request, lector string) {
	gs, err := s.gustos(r.Context(), lector)
	if err != nil {
		fallo(w, 500, "no pude leer tu gusto")
		return
	}
	cat := s.catalogo()
	gusto := map[string]float64{}
	norma := 0.0
	for _, g := range gs {
		if g.Peso > 0 {
			gusto[g.Tema] = g.Peso
			norma += g.Peso * g.Peso
		}
	}
	out := []libroParaTi{}
	if norma == 0 {
		responder(w, 200, map[string]any{"libros": out, "gusto": gusto})
		return
	}
	norma = math.Sqrt(norma)
	for _, l := range cat.Libros {
		if len(l.Vector) == 0 {
			continue
		}
		punto, nl := 0.0, 0.0
		for t, v := range l.Vector {
			punto += gusto[t] * v
			nl += v * v
		}
		if nl == 0 {
			continue
		}
		parecido := punto / (norma * math.Sqrt(nl))
		// por que, los dos temas que mas aportan al parecido
		aportes := []string{}
		for t := range l.Vector {
			aportes = append(aportes, t)
		}
		sort.Slice(aportes, func(i, j int) bool {
			return gusto[aportes[i]]*l.Vector[aportes[i]] > gusto[aportes[j]]*l.Vector[aportes[j]]
		})
		porque := []string{}
		for _, t := range aportes[:min(2, len(aportes))] {
			if gusto[t]*l.Vector[t] > 0 {
				porque = append(porque, cat.Temas[t].Nombre)
			}
		}
		out = append(out, libroParaTi{Libro: l, Parecido: int(math.Round(parecido * 100)), Porque: porque})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Parecido != out[j].Parecido {
			return out[i].Parecido > out[j].Parecido
		}
		return out[i].Libro.ID < out[j].Libro.ID
	})
	if len(out) > 6 {
		out = out[:6]
	}
	responder(w, 200, map[string]any{"libros": out, "gusto": gusto})
}

// ---------- conseguir el libro ----------

var desdeValido = regexp.MustCompile(`^[a-z]{2,20}$`)

// tiendaDe es donde se consigue un libro. Por ahora la busqueda de Sophos, la libreria de
// Guatemala, con el titulo y el autor. No hay convenio todavia, el clic se cuenta para medir.
func tiendaDe(l Libro) string {
	return "https://tienda.sophosenlinea.com/busqueda/listaLibros.php?tipoBus=full&palabrasBusqueda=" + url.QueryEscape(l.Titulo+" "+l.Autor)
}

// irATienda anota el clic y lleva a la tienda. Es un enlace normal, sirve aunque no haya sesion.
func (s *Srv) irATienda(w http.ResponseWriter, r *http.Request) {
	l, ok := s.catalogo().Libros[r.PathValue("libro")]
	if !ok {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	desde := r.URL.Query().Get("desde")
	if !desdeValido.MatchString(desde) {
		desde = "app"
	}
	if s.limites.deja("ir:"+ipDe(r), 1, 30) {
		var lector any
		if id := s.lectorDe(r); id != "" {
			lector = id
		}
		if _, err := s.db.Exec(r.Context(), `INSERT INTO salidas (lector, libro, desde) VALUES ($1,$2,$3)`, lector, l.ID, desde); err != nil {
			log.Printf("salida: %v", err)
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, tiendaDe(l), http.StatusFound)
}

// ---------- comunidad ----------

type evento struct {
	Tipo   string    `json:"tipo"`
	Texto  string    `json:"texto"`
	Creado time.Time `json:"creado"`
}

func (s *Srv) actividad(ctx context.Context, lector, tipo, texto string) {
	var creado time.Time
	if err := s.db.QueryRow(ctx, `INSERT INTO actividad (lector, tipo, texto) VALUES ($1,$2,$3) RETURNING creado`, lector, tipo, texto).Scan(&creado); err != nil {
		log.Printf("actividad: %v", err)
		return
	}
	s.vivo.publicar(evento{Tipo: tipo, Texto: texto, Creado: creado})
}

func (s *Srv) comunidad(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	type fila struct {
		Alias      string `json:"alias"`
		Racha      int    `json:"racha"`
		Nivel      int    `json:"nivel"`
		Paginas    int    `json:"paginas"`
		Terminadas int    `json:"terminadas"`
		Yo         bool   `json:"yo"`
	}
	yo := s.lectorDe(r)
	ranking := []fila{}
	rows, err := s.db.Query(ctx, `SELECT id::text, alias, racha, nivel, paginas, terminadas FROM ranking_semana`)
	if err == nil {
		for rows.Next() {
			var f fila
			var id string
			rows.Scan(&id, &f.Alias, &f.Racha, &f.Nivel, &f.Paginas, &f.Terminadas)
			f.Yo = id == yo
			ranking = append(ranking, f)
		}
		rows.Close()
	}
	eventos := []evento{}
	rows, err = s.db.Query(ctx, `SELECT tipo, texto, creado FROM actividad ORDER BY creado DESC LIMIT 25`)
	if err == nil {
		for rows.Next() {
			var e evento
			rows.Scan(&e.Tipo, &e.Texto, &e.Creado)
			eventos = append(eventos, e)
		}
		rows.Close()
	}
	var lectores, paginas, terminadas int
	s.db.QueryRow(ctx, `SELECT (SELECT count(*) FROM lectores WHERE visto > now() - interval '7 days'),
		(SELECT coalesce(sum(paginas), 0) FROM lecturas_hechas WHERE creado >= date_trunc('week', now())),
		(SELECT count(*) FROM lecturas_hechas WHERE terminada AND creado >= date_trunc('week', now()))`).Scan(&lectores, &paginas, &terminadas)
	responder(w, 200, map[string]any{"ranking": ranking, "eventos": eventos,
		"semana": map[string]int{"lectores": lectores, "paginas": paginas, "terminadas": terminadas}})
}

// ---------- Sean Ellis ----------

type pedidoEllis struct {
	Respuesta int `json:"respuesta"`
}

func (s *Srv) ellis(w http.ResponseWriter, r *http.Request, lector string) {
	var p pedidoEllis
	if !leerJSON(w, r, &p) {
		return
	}
	if p.Respuesta < 1 || p.Respuesta > 3 {
		fallo(w, 400, "respuesta fuera de rango")
		return
	}
	if _, err := s.db.Exec(r.Context(), `INSERT INTO encuesta (lector, respuesta) VALUES ($1,$2)
		ON CONFLICT (lector) DO UPDATE SET respuesta = EXCLUDED.respuesta, creado = now()`, lector, p.Respuesta); err != nil {
		fallo(w, 500, "no pude guardar tu respuesta")
		return
	}
	responder(w, 200, map[string]bool{"ok": true})
}

// ---------- ayuda, con GLPI del proyecto de ITIL ----------

type pedidoAyuda struct {
	Texto  string `json:"texto"`
	Correo string `json:"correo"`
}

var correoValido = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$`)

func (s *Srv) ayuda(w http.ResponseWriter, r *http.Request, lector string) {
	var p pedidoAyuda
	if !leerJSON(w, r, &p) {
		return
	}
	p.Texto = strings.TrimSpace(p.Texto)
	p.Correo = strings.TrimSpace(p.Correo)
	if len([]rune(p.Texto)) < 5 || len([]rune(p.Texto)) > 2000 {
		fallo(w, 400, "Cuéntanos el problema en al menos 5 letras")
		return
	}
	if p.Correo != "" && !correoValido.MatchString(p.Correo) {
		fallo(w, 400, "Ese correo no parece válido")
		return
	}
	if !s.limites.deja("ayuda:"+lector, 0.01, 3) {
		fallo(w, 429, "Ya recibimos tus mensajes, en un rato puedes mandar otro")
		return
	}
	var id int64
	var correo any
	if p.Correo != "" {
		correo = p.Correo
	}
	if err := s.db.QueryRow(r.Context(), `INSERT INTO ayuda (lector, correo, texto) VALUES ($1,$2,$3) RETURNING id`, lector, correo, p.Texto).Scan(&id); err != nil {
		fallo(w, 500, "no pude guardar tu mensaje")
		return
	}
	go func() {
		c, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		s.mandarAyudaPendiente(c)
	}()
	responder(w, 200, map[string]any{"ok": true, "numero": id})
}

// mandarAyudaPendiente sube a GLPI los pedidos en cola, como incidentes de la categoria lectortie.
func (s *Srv) mandarAyudaPendiente(ctx context.Context) {
	if !s.cfg.glpiListo() {
		return
	}
	rows, err := s.db.Query(ctx, `SELECT id, coalesce(correo, ''), texto FROM ayuda WHERE estado = 'en cola' AND intentos < 5 ORDER BY id LIMIT 10`)
	if err != nil {
		return
	}
	type pend struct {
		id            int64
		correo, texto string
	}
	ps := []pend{}
	for rows.Next() {
		var p pend
		rows.Scan(&p.id, &p.correo, &p.texto)
		ps = append(ps, p)
	}
	rows.Close()
	if len(ps) == 0 {
		return
	}
	token, err := s.glpiSesion(ctx)
	if err != nil {
		log.Printf("glpi: %v", err)
		for _, p := range ps {
			s.db.Exec(ctx, `UPDATE ayuda SET intentos = intentos + 1 WHERE id = $1`, p.id)
		}
		return
	}
	defer s.glpiPedir(ctx, "GET", "/killSession", token, nil, nil)
	for _, p := range ps {
		cuerpo := map[string]any{"input": map[string]any{
			"name":    fmt.Sprintf("lectortie, pedido de ayuda %d", p.id),
			"content": fmt.Sprintf("%s\n\nCorreo de contacto, %s\nPedido %d de la app lectortie.", p.texto, map[bool]string{true: p.correo, false: "no dejó"}[p.correo != ""], p.id),
			"type":    1,
			"urgency": 3,
		}}
		var res struct {
			ID int `json:"id"`
		}
		if err := s.glpiPedir(ctx, "POST", "/Ticket", token, cuerpo, &res); err != nil || res.ID == 0 {
			log.Printf("glpi ticket %d: %v", p.id, err)
			s.db.Exec(ctx, `UPDATE ayuda SET intentos = intentos + 1 WHERE id = $1`, p.id)
			continue
		}
		s.db.Exec(ctx, `UPDATE ayuda SET estado = 'en glpi', glpi = $2 WHERE id = $1`, p.id, res.ID)
	}
}

func (s *Srv) glpiSesion(ctx context.Context) (string, error) {
	var res struct {
		Token string `json:"session_token"`
	}
	if err := s.glpiPedir(ctx, "GET", "/initSession", "", nil, &res); err != nil {
		return "", err
	}
	if res.Token == "" {
		return "", errors.New("glpi no dio sesion")
	}
	return res.Token, nil
}

func (s *Srv) glpiPedir(ctx context.Context, metodo, ruta, sesion string, cuerpo, salida any) error {
	var b []byte
	if cuerpo != nil {
		b, _ = json.Marshal(cuerpo)
	}
	req, err := http.NewRequestWithContext(ctx, metodo, s.cfg.GLPIURL+"/apirest.php"+ruta, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("App-Token", s.cfg.GLPIApp)
	if sesion != "" {
		req.Header.Set("Session-Token", sesion)
	} else {
		req.Header.Set("Authorization", "user_token "+s.cfg.GLPIUser)
	}
	cl := &http.Client{Timeout: 10 * time.Second}
	res, err := cl.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("glpi %s %d", ruta, res.StatusCode)
	}
	if salida != nil {
		return json.NewDecoder(res.Body).Decode(salida)
	}
	return nil
}

// ---------- salud y panel ----------

func (s *Srv) salud(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	db := s.db.Ping(ctx) == nil
	cat := s.catalogo()
	glpi := "apagado"
	if s.cfg.glpiListo() {
		glpi = "configurado"
	}
	cod := 200
	if !db {
		cod = 503
	}
	responder(w, cod, map[string]any{"ok": db, "db": db, "correo": s.cfg.correoListo(), "glpi": glpi,
		"videos": len(cat.Videos), "lecturas": len(cat.Lecturas), "libros": len(cat.Libros),
		"enVivo": s.vivo.cuantos(), "arranco": s.arranco.Format(time.RFC3339), "cache": s.cifrasCache()})
}

func (s *Srv) panel(w http.ResponseWriter, r *http.Request) {
	clave := r.Header.Get("X-Panel-Clave")
	if clave == "" {
		clave = r.URL.Query().Get("clave")
	}
	if subtle.ConstantTimeCompare([]byte(clave), []byte(s.cfg.PanelClave)) != 1 {
		if !s.limites.deja("panel:"+ipDe(r), 0.1, 5) {
			fallo(w, 429, "espera")
			return
		}
		fallo(w, 401, "clave del panel")
		return
	}
	ctx := r.Context()
	type temaRes struct {
		Tema      string  `json:"tema"`
		Nombre    string  `json:"nombre"`
		Vistas    int     `json:"vistas"`
		Segundos  float64 `json:"segundos"`
		Saltos    float64 `json:"saltos"`
		Corazones int     `json:"corazones"`
		Puestas   int     `json:"puestas"`
		Abiertas  int     `json:"abiertas"`
		Color     string  `json:"color"`
	}
	cat := s.catalogo()
	temas := []temaRes{}
	rows, err := s.db.Query(ctx, `SELECT tema, nombre, vistas, segundos_promedio, saltos_pct, corazones, micros_puestas, micros_abiertas FROM resumen_temas ORDER BY vistas DESC`)
	if err == nil {
		for rows.Next() {
			var t temaRes
			rows.Scan(&t.Tema, &t.Nombre, &t.Vistas, &t.Segundos, &t.Saltos, &t.Corazones, &t.Puestas, &t.Abiertas)
			t.Color = cat.Temas[t.Tema].Color
			temas = append(temas, t)
		}
		rows.Close()
	}
	type dia struct {
		Dia        string `json:"dia"`
		Activos    int    `json:"activos"`
		Videos     int    `json:"videos"`
		Abiertas   int    `json:"abiertas"`
		Terminadas int    `json:"terminadas"`
	}
	dias := []dia{}
	rows, err = s.db.Query(ctx, `SELECT to_char(dia, 'YYYY-MM-DD'), activos, videos, micros_abiertas, terminadas FROM metricas_dia ORDER BY dia`)
	if err == nil {
		for rows.Next() {
			var d dia
			rows.Scan(&d.Dia, &d.Activos, &d.Videos, &d.Abiertas, &d.Terminadas)
			dias = append(dias, d)
		}
		rows.Close()
	}
	var ret struct {
		Lectores int     `json:"lectores"`
		Vuelven  int     `json:"vuelven"`
		Pct      float64 `json:"pct"`
	}
	s.db.QueryRow(ctx, `SELECT lectores, vuelven, vuelven_pct FROM retencion_semana`).Scan(&ret.Lectores, &ret.Vuelven, &ret.Pct)
	var el struct {
		Respuestas int     `json:"respuestas"`
		Muy        int     `json:"muy"`
		Algo       int     `json:"algo"`
		Nada       int     `json:"nada"`
		Pct        float64 `json:"pct"`
	}
	s.db.QueryRow(ctx, `SELECT respuestas, muy, algo, nada, muy_pct FROM resultado_ellis`).Scan(&el.Respuestas, &el.Muy, &el.Algo, &el.Nada, &el.Pct)
	var emb struct {
		Lectores   int `json:"lectores"`
		Videos     int `json:"videos"`
		Puestas    int `json:"puestas"`
		Abiertas   int `json:"abiertas"`
		Terminadas int `json:"terminadas"`
		Correos    int `json:"correos"`
		Ayuda      int `json:"ayuda"`
		Salidas    int `json:"salidas"`
	}
	s.db.QueryRow(ctx, `SELECT (SELECT count(*) FROM lectores), (SELECT count(*) FROM vistas), (SELECT count(*) FROM micros),
		(SELECT count(*) FROM micros WHERE abierta), (SELECT count(*) FROM lecturas_hechas WHERE terminada),
		(SELECT count(*) FROM lectores WHERE correo IS NOT NULL), (SELECT count(*) FROM ayuda), (SELECT count(*) FROM salidas)`).Scan(
		&emb.Lectores, &emb.Videos, &emb.Puestas, &emb.Abiertas, &emb.Terminadas, &emb.Correos, &emb.Ayuda, &emb.Salidas)
	type buscado struct {
		Titulo string `json:"titulo"`
		Clics  int    `json:"clics"`
	}
	buscados := []buscado{}
	rows, err = s.db.Query(ctx, `SELECT l.titulo, count(*) FROM salidas s JOIN libros l ON l.id = s.libro GROUP BY l.titulo ORDER BY 2 DESC, 1 LIMIT 5`)
	if err == nil {
		for rows.Next() {
			var b buscado
			rows.Scan(&b.Titulo, &b.Clics)
			buscados = append(buscados, b)
		}
		rows.Close()
	}
	responder(w, 200, map[string]any{"temas": temas, "dias": dias, "retencion": ret, "ellis": el, "embudo": emb, "buscados": buscados})
}

var _ = pgx.ErrNoRows
