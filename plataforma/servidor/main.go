package main

// lectortie, el servidor. Sirve la app de Vue ya construida, la API y el canal en vivo.
// Escucha solo en 127.0.0.1; al mundo sale por el tunel de Cloudflare de ledkid.com.

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	malas = regexp.MustCompile(`(^|[^a-zñ])(put[ao]|mierd|verga|pendej|cerot|culer|hijueput|hijodeput|malparid|chingad|chingar|mamad|maric|imbecil|estupid|cabron|follar|porno|nazi|hitler|idiota|zorra|cagad|jodid|coño|sexo|vrg|culos?([^a-zñ]|$)|pija([^a-zñ]|$)|hdp([^a-zñ]|$)|ptm([^a-zñ]|$)|penes?([^a-zñ]|$)|jotos?([^a-zñ]|$))`)
	// Los enlaces. Los dominios que no son palabras cuentan siempre; me, co, gt, ly y tv solo si
	// siguen con una barra o cierran el texto, porque "Triste.me hizo llorar" no es un enlace y
	// wa.me/502... o bit.ly/x si lo son (04-11).
	enlace      = regexp.MustCompile(`[a-z0-9-]+\.(com|net|org|io|xyz|info|site|online)\b`)
	enlaceCorto = regexp.MustCompile(`[a-z0-9-]+\.(gt|ly|me|co|tv|gg)(/|$)`)
)

type Srv struct {
	cfg     Config
	db      *pgxpool.Pool
	mu      sync.RWMutex
	cat     *Catalogo
	vivo    *Hub
	limites *Limites
	cache   *cacheLectores // cache aside del estado de cada lector, ver cache.go
	sesion  sync.Map       // sha256 del token -> entradaSesion
	arranco time.Time
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("lectortie ")
	cfg := cargarConfig()
	if f, err := os.OpenFile(filepath.Join(cfg.Raiz, "servidor.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600); err == nil {
		log.SetOutput(io.MultiWriter(os.Stderr, f))
	}
	ctx, parar := signal.NotifyContext(context.Background(), os.Interrupt)
	defer parar()

	if err := migrar(ctx, cfg); err != nil {
		log.Fatal(err)
	}
	if err := sembrar(ctx, cfg); err != nil {
		log.Fatal(err)
	}
	pc, err := pgxpool.ParseConfig(cfg.dsn(cfg.PGApp, cfg.PGAppClave))
	if err != nil {
		log.Fatal(err)
	}
	pc.MaxConns = 16
	pool, err := pgxpool.NewWithConfig(ctx, pc)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	s := &Srv{cfg: cfg, db: pool, vivo: nuevoHub(), limites: nuevosLimites(), cache: nuevoCache(), arranco: time.Now()}
	if err := s.cargarCatalogo(ctx); err != nil {
		log.Fatal(err)
	}
	go s.tareas(ctx)

	srv := &http.Server{
		Addr:              "127.0.0.1:" + cfg.Puerto,
		Handler:           s.envolver(s.rutas()),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	go func() {
		<-ctx.Done()
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(c)
	}()
	log.Printf("escuchando en http://%s, correo %v, glpi %v", srv.Addr, cfg.correoListo(), cfg.glpiListo())
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func (s *Srv) rutas() *http.ServeMux {
	m := http.NewServeMux()
	m.HandleFunc("POST /api/hola", s.hola)
	m.HandleFunc("GET /api/yo", s.conLector(s.yo))
	m.HandleFunc("POST /api/entrada", s.conLector(s.entrada))
	m.HandleFunc("GET /api/feed", s.conLector(s.feed))
	m.HandleFunc("POST /api/vista", s.conLectorQueRefresca(s.vista))
	m.HandleFunc("POST /api/micro", s.conLectorQueRefresca(s.micro))
	m.HandleFunc("POST /api/micro/{id}/abrir", s.conLector(s.abrirMicro))
	m.HandleFunc("GET /api/lectura/{id}", s.conLector(s.lectura))
	m.HandleFunc("POST /api/lectura/{id}/terminar", s.conLector(s.terminar))
	m.HandleFunc("POST /api/lectura/{id}/comentar", s.conLector(s.comentar))
	m.HandleFunc("GET /api/libros", s.libros)
	m.HandleFunc("GET /api/para-mi", s.conLector(s.paraMi))
	m.HandleFunc("GET /ir/{libro}", s.irATienda)
	m.HandleFunc("GET /api/comunidad", s.comunidad)
	m.HandleFunc("GET /api/vivo", s.envivo)
	m.HandleFunc("POST /api/correo", s.conLector(s.pedirEnlace))
	m.HandleFunc("GET /entrar", s.entrarConEnlace)
	m.HandleFunc("POST /api/salir", s.salir)
	m.HandleFunc("POST /api/ellis", s.conLector(s.ellis))
	m.HandleFunc("POST /api/ayuda", s.conLector(s.ayuda))
	m.HandleFunc("GET /api/salud", s.salud)
	m.HandleFunc("GET /api/panel", s.panel)
	m.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fallo(w, 404, "no existe") })
	m.Handle("GET /portadas/", http.StripPrefix("/portadas/", archivosConCache(http.Dir(s.cfg.Portadas), 7*24*time.Hour)))
	m.HandleFunc("/", s.estaticos)
	return m
}

// tareas de fondo, refrescar las metricas, mandar a GLPI lo que quedo en cola y limpiar.
func (s *Srv) tareas(ctx context.Context) {
	cada := time.NewTicker(time.Minute)
	defer cada.Stop()
	vuelta := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-cada.C:
		}
		vuelta++
		c, cancel := context.WithTimeout(ctx, 30*time.Second)
		if _, err := s.db.Exec(c, `SELECT refrescar_metricas()`); err != nil {
			log.Printf("refrescar metricas: %v", err)
		}
		if vuelta%2 == 0 {
			s.mandarAyudaPendiente(c)
		}
		if vuelta%60 == 0 {
			s.db.Exec(c, `DELETE FROM sesiones WHERE expira < now()`)
		}
		cancel()
		s.limites.limpiar()
		s.cache.limpiar()
	}
}
