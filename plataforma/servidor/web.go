package main

// Lo comun de la web, cabeceras, limites por IP, sesiones con cookie, archivos y el canal en vivo.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

func init() {
	mime.AddExtensionType(".webmanifest", "application/manifest+json")
	mime.AddExtensionType(".js", "text/javascript; charset=utf-8")
	mime.AddExtensionType(".svg", "image/svg+xml")
}

// ---------- respuestas ----------

func responder(w http.ResponseWriter, codigo int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(codigo)
	json.NewEncoder(w).Encode(v)
}

func fallo(w http.ResponseWriter, codigo int, motivo string) {
	responder(w, codigo, map[string]string{"error": motivo})
}

func leerJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		fallo(w, 415, "manda json")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil && err != io.EOF {
		fallo(w, 400, "json invalido")
		return false
	}
	return true
}

// ---------- el envoltorio de todas las peticiones ----------

type grabador struct {
	http.ResponseWriter
	codigo int
}

func (g *grabador) WriteHeader(c int) { g.codigo = c; g.ResponseWriter.WriteHeader(c) }
func (g *grabador) Flush() {
	if f, ok := g.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func ipDe(r *http.Request) string {
	if ip := r.Header.Get("Cf-Connecting-Ip"); ip != "" {
		return ip
	}
	h, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return h
}

func (s *Srv) envolver(h http.Handler) http.Handler {
	csp := "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://*.ibyteimg.com; " +
		"media-src 'self' blob:; frame-src https://www.tiktok.com; connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hd := w.Header()
		hd.Set("X-Content-Type-Options", "nosniff")
		hd.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		hd.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		hd.Set("Content-Security-Policy", csp)
		if r.Header.Get("X-Forwarded-Proto") == "https" {
			hd.Set("Strict-Transport-Security", "max-age=31536000")
		}
		api := strings.HasPrefix(r.URL.Path, "/api/")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if o := r.Header.Get("Origin"); o != "" {
				if u, err := url.Parse(o); err != nil || u.Host != r.Host {
					fallo(w, 403, "origen ajeno")
					return
				}
			}
		}
		// un salon entero sale a internet con una sola IP, el limite por IP deja pasar a todo un grupo.
		// Con 60 personas a la vez de una IP, 60 por segundo ya se quedaba corto (04-11); el servidor
		// contesta 65 por segundo con el p95 en 20 ms, asi que se sube. Cada lector tiene ademas
		// sus propios limites en las vistas, las lecturas y los comentarios.
		if api && !s.limites.deja("ip:"+ipDe(r), 150, 1000) {
			w.Header().Set("Retry-After", "5")
			fallo(w, 429, "vas muy rapido")
			return
		}
		g := &grabador{ResponseWriter: w, codigo: 200}
		t0 := time.Now()
		h.ServeHTTP(g, r)
		if api && r.URL.Path != "/api/vivo" && (g.codigo >= 500 || time.Since(t0) > 800*time.Millisecond) {
			log.Printf("%s %s %d %v", r.Method, r.URL.Path, g.codigo, time.Since(t0).Round(time.Millisecond))
		}
	})
}

// ---------- limites ----------

type cubeta struct {
	fichas float64
	ultima time.Time
}

type Limites struct {
	mu sync.Mutex
	m  map[string]*cubeta
}

func nuevosLimites() *Limites { return &Limites{m: map[string]*cubeta{}} }

// deja es una cubeta de fichas, porSegundo de recarga y un maximo de rafaga.
func (l *Limites) deja(clave string, porSegundo, rafaga float64) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	ahora := time.Now()
	c, ok := l.m[clave]
	if !ok {
		c = &cubeta{fichas: rafaga, ultima: ahora}
		l.m[clave] = c
	}
	c.fichas += ahora.Sub(c.ultima).Seconds() * porSegundo
	if c.fichas > rafaga {
		c.fichas = rafaga
	}
	c.ultima = ahora
	if c.fichas < 1 {
		return false
	}
	c.fichas--
	return true
}

func (l *Limites) limpiar() {
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, c := range l.m {
		if time.Since(c.ultima) > 30*time.Minute {
			delete(l.m, k)
		}
	}
}

// ---------- sesiones ----------

type entradaSesion struct {
	lector string
	vence  time.Time
}

const nombreCookie = "lt"

func hashToken(t []byte) []byte { h := sha256.Sum256(t); return h[:] }

func tokenNuevo() ([]byte, string) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return b, base64.RawURLEncoding.EncodeToString(b)
}

func (s *Srv) ponerCookie(w http.ResponseWriter, r *http.Request, valor string, edad time.Duration) {
	http.SetCookie(w, &http.Cookie{Name: nombreCookie, Value: valor, Path: "/", HttpOnly: true,
		Secure: r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil, SameSite: http.SameSiteLaxMode,
		MaxAge: int(edad.Seconds())})
}

// abrirSesion crea la sesion de un lector y pone la cookie. Dura un ano.
func (s *Srv) abrirSesion(ctx context.Context, w http.ResponseWriter, r *http.Request, lector string) error {
	crudo, valor := tokenNuevo()
	if _, err := s.db.Exec(ctx, `INSERT INTO sesiones (token, lector, expira) VALUES ($1, $2, now() + interval '365 days')`, hashToken(crudo), lector); err != nil {
		return err
	}
	s.ponerCookie(w, r, valor, 365*24*time.Hour)
	return nil
}

func (s *Srv) lectorDe(r *http.Request) string {
	c, err := r.Cookie(nombreCookie)
	if err != nil {
		return ""
	}
	crudo, err := base64.RawURLEncoding.DecodeString(c.Value)
	if err != nil || len(crudo) != 32 {
		return ""
	}
	h := hashToken(crudo)
	clave := string(h)
	if e, ok := s.sesion.Load(clave); ok {
		es := e.(entradaSesion)
		if time.Now().Before(es.vence) {
			return es.lector
		}
		s.sesion.Delete(clave)
	}
	var id string
	err = s.db.QueryRow(r.Context(), `SELECT lector::text FROM sesiones WHERE token = $1 AND expira > now()`, h).Scan(&id)
	if err != nil {
		return ""
	}
	s.sesion.Store(clave, entradaSesion{lector: id, vence: time.Now().Add(10 * time.Minute)})
	return id
}

type conID func(w http.ResponseWriter, r *http.Request, lector string)

func (s *Srv) conLector(h conID) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := s.lectorDe(r)
		if id == "" {
			fallo(w, 401, "sin sesion")
			return
		}
		// cache aside, cualquier escritura de este lector borra lo que se sabia de el, antes y
		// despues, para que nadie lea un gusto viejo mientras el trigger lo cambia
		escribe := r.Method != http.MethodGet && r.Method != http.MethodHead
		if escribe {
			s.cache.olvidar(id)
		}
		h(w, r, id)
		if escribe {
			s.cache.olvidar(id)
		}
	}
}

// conLectorQueRefresca es para la vista y la micro lectura, que despues de escribir vuelven a
// leer el estado de la base y lo dejan en la cache, asi el siguiente feed sale de ahi.
func (s *Srv) conLectorQueRefresca(h conID) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := s.lectorDe(r)
		if id == "" {
			fallo(w, 401, "sin sesion")
			return
		}
		s.cache.olvidar(id)
		h(w, r, id)
	}
}

// hola abre la app. Si ya hay sesion la devuelve, si no crea un lector nuevo sin datos.
// Nadie tiene que dar su correo para usar lectortie.
func (s *Srv) hola(w http.ResponseWriter, r *http.Request) {
	if id := s.lectorDe(r); id != "" {
		s.yo(w, r, id)
		return
	}
	// si un salon entero escanea el QR a la vez, todos entran; despues uno nuevo por segundo. Con
	// 80 de golpe, en un auditorio con el WiFi de la U se quedaban 40 afuera (04-11, carga.js)
	if !s.limites.deja("nuevo:"+ipDe(r), 1, 200) {
		fallo(w, 429, "demasiados lectores nuevos desde aqui")
		return
	}
	var id string
	if err := s.db.QueryRow(r.Context(), `INSERT INTO lectores DEFAULT VALUES RETURNING id::text`).Scan(&id); err != nil {
		fallo(w, 500, "no pude crear el lector")
		return
	}
	if err := s.abrirSesion(r.Context(), w, r, id); err != nil {
		fallo(w, 500, "no pude abrir la sesion")
		return
	}
	s.yo(w, r, id)
}

func (s *Srv) salir(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(nombreCookie); err == nil {
		if crudo, err := base64.RawURLEncoding.DecodeString(c.Value); err == nil && len(crudo) == 32 {
			h := hashToken(crudo)
			s.db.Exec(r.Context(), `DELETE FROM sesiones WHERE token = $1`, h)
			s.sesion.Delete(string(h))
		}
	}
	s.ponerCookie(w, r, "", -time.Second)
	responder(w, 200, map[string]bool{"ok": true})
}

// ---------- archivos ----------

func archivosConCache(fs http.FileSystem, edad time.Duration) http.Handler {
	h := http.FileServer(fs)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(edad.Seconds())))
		h.ServeHTTP(w, r)
	})
}

// estaticos sirve la app de Vue. Lo que no es un archivo vuelve a index.html, que la ruta la
// resuelve el navegador. Los archivos con hash en el nombre se guardan un ano.
func (s *Srv) estaticos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		fallo(w, 405, "metodo no permitido")
		return
	}
	p := path.Clean("/" + r.URL.Path)
	ruta := filepath.Join(s.cfg.Web, filepath.FromSlash(p))
	if !strings.HasPrefix(ruta, s.cfg.Web) {
		fallo(w, 400, "ruta invalida")
		return
	}
	if fi, err := os.Stat(ruta); err == nil && !fi.IsDir() {
		switch {
		case strings.HasPrefix(p, "/assets/"):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case p == "/sw.js" || p == "/manifest.webmanifest":
			w.Header().Set("Cache-Control", "no-cache")
		default:
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		http.ServeFile(w, r, ruta)
		return
	}
	// un archivo que no existe, por ejemplo un pedazo de la version anterior, es un 404 y no la
	// pagina; si no, el navegador recibe html donde esperaba js y la app se queda quieta
	if path.Ext(p) != "" {
		w.Header().Set("Cache-Control", "no-store")
		http.Error(w, "no existe", http.StatusNotFound)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFile(w, r, filepath.Join(s.cfg.Web, "index.html"))
}

// ---------- en vivo ----------

type Hub struct {
	mu    sync.Mutex
	subs  map[chan []byte]struct{}
	maxim int
}

func nuevoHub() *Hub { return &Hub{subs: map[chan []byte]struct{}{}, maxim: 400} }

func (h *Hub) cuantos() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subs)
}

func (h *Hub) publicar(v any) {
	b, _ := json.Marshal(v)
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.subs {
		select {
		case c <- b:
		default:
		}
	}
}

func (s *Srv) envivo(w http.ResponseWriter, r *http.Request) {
	f, ok := w.(http.Flusher)
	if !ok {
		fallo(w, 500, "sin flush")
		return
	}
	s.vivo.mu.Lock()
	if len(s.vivo.subs) >= s.vivo.maxim {
		s.vivo.mu.Unlock()
		fallo(w, 503, "lleno")
		return
	}
	c := make(chan []byte, 16)
	s.vivo.subs[c] = struct{}{}
	s.vivo.mu.Unlock()
	defer func() {
		s.vivo.mu.Lock()
		delete(s.vivo.subs, c)
		s.vivo.mu.Unlock()
	}()
	hd := w.Header()
	hd.Set("Content-Type", "text/event-stream")
	hd.Set("Cache-Control", "no-cache, no-transform")
	hd.Set("X-Accel-Buffering", "no")
	w.WriteHeader(200)
	fmt.Fprint(w, "retry: 4000\n\n")
	f.Flush()
	latido := time.NewTicker(20 * time.Second)
	defer latido.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case b := <-c:
			fmt.Fprintf(w, "data: %s\n\n", b)
			f.Flush()
		case <-latido.C:
			fmt.Fprint(w, ": latido\n\n")
			f.Flush()
		}
	}
}
