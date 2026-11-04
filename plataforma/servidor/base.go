package main

// Migraciones y catalogo. Las migraciones de base/*.sql y la carga del contenido las hace el
// dueno de la base al arrancar. Despues el servidor solo entra como lectortie_app.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

func migrar(ctx context.Context, c Config) error {
	conn, err := pgx.Connect(ctx, c.dsn(c.PGDueno, c.PGDuenoClave))
	if err != nil {
		return fmt.Errorf("conectar como dueno: %w", err)
	}
	defer conn.Close(ctx)
	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS migraciones (nombre text PRIMARY KEY, aplicada timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	archivos, _ := filepath.Glob(filepath.Join(c.Raiz, "base", "*.sql"))
	sort.Strings(archivos)
	for _, a := range archivos {
		nombre := filepath.Base(a)
		var ya bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM migraciones WHERE nombre = $1)`, nombre).Scan(&ya); err != nil {
			return err
		}
		if ya {
			continue
		}
		sql, err := os.ReadFile(a)
		if err != nil {
			return err
		}
		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("migracion %s: %w", nombre, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO migraciones (nombre) VALUES ($1)`, nombre); err != nil {
			tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		log.Printf("migracion aplicada %s", nombre)
	}
	return nil
}

// ---------- el contenido ----------

type Tema struct {
	Clave  string `json:"clave"`
	Nombre string `json:"nombre"`
	Piel   string `json:"piel"`
	Color  string `json:"color"`
	Orden  int    `json:"orden"`
}

type Libro struct {
	ID      string   `json:"id"`
	Titulo  string   `json:"titulo"`
	Autor   string   `json:"autor"`
	Anio    int      `json:"anio"`
	Paginas int      `json:"paginas"`
	Edad    string   `json:"edad"`
	Nivel   int      `json:"nivel"`
	Gancho  string   `json:"gancho"`
	Temas   []string `json:"temas"`
	Portada string   `json:"portada"`
	// cuanto se parece a cada tema segun la red neuronal, ver contenido/red/entrenar.py
	Vector map[string]float64 `json:"vector,omitempty"`
}

type Lectura struct {
	ID      string     `json:"id"`
	Titulo  string     `json:"titulo"`
	Autor   string     `json:"autor"`
	Tema    string     `json:"tema"`
	Nivel   int        `json:"nivel"`
	Micro   string     `json:"micro"`
	Paginas [][]string `json:"paginas,omitempty"`
	Minutos int        `json:"minutos"`
	Fuente  string     `json:"fuente"`
	Libro   string     `json:"libro,omitempty"`
}

type Video struct {
	ID       int                `json:"id"`
	Fuente   string             `json:"fuente"`
	Ref      string             `json:"ref"`
	Autor    string             `json:"autor"`
	Texto    string             `json:"texto"`
	Tema     string             `json:"tema"`
	Libro    string             `json:"libro,omitempty"`
	Clase    string             `json:"clase"`
	Etiqueta string             `json:"etiqueta"`
	Vector   map[string]float64 `json:"vector,omitempty"`
}

// jsonONulo convierte un vector en texto json para una columna jsonb, o nil si no hay vector.
func jsonONulo(v map[string]float64) any {
	if len(v) == 0 {
		return nil
	}
	b, _ := json.Marshal(v)
	return string(b)
}

func leerJSONArchivo(ruta string, v any) error {
	b, err := os.ReadFile(ruta)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// sembrar carga temas, libros, lecturas y videos desde contenido/ y datos/. Es idempotente,
// se puede correr en cada arranque, y apaga los videos que ya no estan en el archivo.
func sembrar(ctx context.Context, c Config) error {
	conn, err := pgx.Connect(ctx, c.dsn(c.PGDueno, c.PGDuenoClave))
	if err != nil {
		return err
	}
	defer conn.Close(ctx)

	var temas []Tema
	if err := leerJSONArchivo(filepath.Join(c.Raiz, "contenido", "temas.json"), &temas); err != nil {
		return fmt.Errorf("temas.json: %w", err)
	}
	var libros []Libro
	if err := leerJSONArchivo(filepath.Join(filepath.Dir(c.Raiz), "datos", "libros.json"), &libros); err != nil {
		return fmt.Errorf("libros.json: %w", err)
	}
	// los vectores de los libros los saca la red neuronal; si aun no se entreno, no hay
	vecLibros := map[string]map[string]float64{}
	if err := leerJSONArchivo(filepath.Join(c.Raiz, "contenido", "red", "libros-vectores.json"), &vecLibros); err != nil {
		log.Printf("sin vectores de libros, falta correr red/entrenar.py: %v", err)
	}
	var lecturas []Lectura
	if err := leerJSONArchivo(filepath.Join(c.Raiz, "contenido", "lecturas.json"), &lecturas); err != nil {
		return fmt.Errorf("lecturas.json: %w", err)
	}
	var videos []Video
	if err := leerJSONArchivo(filepath.Join(c.Raiz, "contenido", "videos.json"), &videos); err != nil {
		return fmt.Errorf("videos.json: %w", err)
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, t := range temas {
		if _, err := tx.Exec(ctx, `INSERT INTO temas (clave, nombre, piel, color, orden) VALUES ($1,$2,$3,$4,$5)
			ON CONFLICT (clave) DO UPDATE SET nombre = EXCLUDED.nombre, piel = EXCLUDED.piel, color = EXCLUDED.color, orden = EXCLUDED.orden`,
			t.Clave, t.Nombre, t.Piel, t.Color, t.Orden); err != nil {
			return fmt.Errorf("tema %s: %w", t.Clave, err)
		}
	}
	for _, l := range libros {
		nivel := l.Nivel
		if nivel < 1 {
			nivel = 1
		}
		var pag any
		if l.Paginas > 0 {
			pag = l.Paginas
		}
		if _, err := tx.Exec(ctx, `INSERT INTO libros (id, titulo, autor, anio, paginas, edad, nivel, gancho, temas, portada, vector)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
			ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, autor = EXCLUDED.autor, anio = EXCLUDED.anio,
			  paginas = EXCLUDED.paginas, edad = EXCLUDED.edad, nivel = EXCLUDED.nivel, gancho = EXCLUDED.gancho,
			  temas = EXCLUDED.temas, portada = EXCLUDED.portada, vector = EXCLUDED.vector`,
			l.ID, l.Titulo, l.Autor, l.Anio, pag, l.Edad, nivel, l.Gancho, l.Temas, "/portadas/"+l.ID+".jpg", jsonONulo(vecLibros[l.ID])); err != nil {
			return fmt.Errorf("libro %s: %w", l.ID, err)
		}
	}
	for _, l := range lecturas {
		pag, _ := json.Marshal(l.Paginas)
		var libro any
		if l.Libro != "" {
			libro = l.Libro
		}
		if _, err := tx.Exec(ctx, `INSERT INTO lecturas (id, titulo, autor, tema, nivel, micro, paginas, minutos, fuente, libro)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, autor = EXCLUDED.autor, tema = EXCLUDED.tema,
			  nivel = EXCLUDED.nivel, micro = EXCLUDED.micro, paginas = EXCLUDED.paginas, minutos = EXCLUDED.minutos,
			  fuente = EXCLUDED.fuente, libro = EXCLUDED.libro`,
			l.ID, l.Titulo, l.Autor, l.Tema, l.Nivel, l.Micro, pag, l.Minutos, l.Fuente, libro); err != nil {
			return fmt.Errorf("lectura %s: %w", l.ID, err)
		}
	}
	refs := []string{}
	for _, v := range videos {
		var libro any
		if v.Libro != "" {
			libro = v.Libro
		}
		if v.Clase == "" {
			v.Clase = "libros"
		}
		if v.Etiqueta == "" {
			v.Etiqueta = "BookTok"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO videos (fuente, ref, autor, texto, tema, libro, clase, etiqueta, vector, activo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,true)
			ON CONFLICT (fuente, ref) DO UPDATE SET autor = EXCLUDED.autor, texto = EXCLUDED.texto, tema = EXCLUDED.tema,
			  libro = EXCLUDED.libro, clase = EXCLUDED.clase, etiqueta = EXCLUDED.etiqueta, vector = EXCLUDED.vector, activo = true`,
			v.Fuente, v.Ref, v.Autor, v.Texto, v.Tema, libro, v.Clase, v.Etiqueta, jsonONulo(v.Vector)); err != nil {
			return fmt.Errorf("video %s: %w", v.Ref, err)
		}
		refs = append(refs, v.Fuente+":"+v.Ref)
	}
	if _, err := tx.Exec(ctx, `UPDATE videos SET activo = false WHERE NOT (fuente || ':' || ref = ANY($1))`, refs); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	log.Printf("contenido, %d temas, %d libros, %d lecturas, %d videos", len(temas), len(libros), len(lecturas), len(videos))
	return nil
}

// ---------- el catalogo en memoria ----------

type Catalogo struct {
	Temas    map[string]Tema
	Orden    []string
	Libros   map[string]Libro
	Lecturas map[string]Lectura
	Videos   map[int]Video
	PorTema  map[string][]int
	LectTema map[string][]string
}

func (s *Srv) cargarCatalogo(ctx context.Context) error {
	cat := &Catalogo{Temas: map[string]Tema{}, Libros: map[string]Libro{}, Lecturas: map[string]Lectura{},
		Videos: map[int]Video{}, PorTema: map[string][]int{}, LectTema: map[string][]string{}}

	rows, err := s.db.Query(ctx, `SELECT clave, nombre, piel, color, orden FROM temas ORDER BY orden, clave`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var t Tema
		if err := rows.Scan(&t.Clave, &t.Nombre, &t.Piel, &t.Color, &t.Orden); err != nil {
			return err
		}
		cat.Temas[t.Clave] = t
		cat.Orden = append(cat.Orden, t.Clave)
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `SELECT id, titulo, autor, coalesce(anio, 0), coalesce(paginas, 0), coalesce(edad, ''), nivel, gancho, temas, portada, vector FROM libros`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var l Libro
		var vec []byte
		if err := rows.Scan(&l.ID, &l.Titulo, &l.Autor, &l.Anio, &l.Paginas, &l.Edad, &l.Nivel, &l.Gancho, &l.Temas, &l.Portada, &vec); err != nil {
			return err
		}
		if len(vec) > 0 {
			json.Unmarshal(vec, &l.Vector)
		}
		cat.Libros[l.ID] = l
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `SELECT id, titulo, autor, tema, nivel, micro, paginas, minutos, fuente, coalesce(libro, '') FROM lecturas`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var l Lectura
		var pag []byte
		if err := rows.Scan(&l.ID, &l.Titulo, &l.Autor, &l.Tema, &l.Nivel, &l.Micro, &pag, &l.Minutos, &l.Fuente, &l.Libro); err != nil {
			return err
		}
		if err := json.Unmarshal(pag, &l.Paginas); err != nil {
			return fmt.Errorf("paginas de %s: %w", l.ID, err)
		}
		cat.Lecturas[l.ID] = l
		cat.LectTema[l.Tema] = append(cat.LectTema[l.Tema], l.ID)
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `SELECT id, fuente, ref, autor, texto, tema, coalesce(libro, ''), clase, etiqueta, vector FROM videos WHERE activo ORDER BY id`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var v Video
		var vec []byte
		if err := rows.Scan(&v.ID, &v.Fuente, &v.Ref, &v.Autor, &v.Texto, &v.Tema, &v.Libro, &v.Clase, &v.Etiqueta, &vec); err != nil {
			return err
		}
		if len(vec) > 0 {
			json.Unmarshal(vec, &v.Vector)
		}
		cat.Videos[v.ID] = v
		cat.PorTema[v.Tema] = append(cat.PorTema[v.Tema], v.ID)
	}
	rows.Close()
	for k := range cat.LectTema {
		sort.Strings(cat.LectTema[k])
	}
	s.mu.Lock()
	s.cat = cat
	s.mu.Unlock()
	return nil
}

func (s *Srv) catalogo() *Catalogo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cat
}

// limpio rechaza las palabras feas y los enlaces de un comentario.
func limpio(texto string) bool {
	return sinMalas(texto) && !conEnlace(texto, true)
}

// aliasLimpio es lo mismo para un alias, que solo lleva letras, numeros, punto y guion bajo:
// kevin.gt o ana.me son nombres, no enlaces.
func aliasLimpio(alias string) bool {
	return sinMalas(alias) && !conEnlace(alias, false)
}

// sinMalas busca las palabras feas. Es la misma lista que usaba la app estatica, con los
// cambios de letras por numeros que se usan para colarlas.
func sinMalas(texto string) bool {
	t := strings.ToLower(texto)
	t = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u",
		"0", "o", "1", "i", "3", "e", "4", "a", "5", "s", "7", "t", "@", "a", "$", "s").Replace(t)
	return !malas.MatchString(t)
}

// conEnlace mira el texto tal cual, sin cambiar numeros por letras: con el cambio, messi.10 se
// leia messi.io y se rechazaba como enlace (04-11).
func conEnlace(texto string, cortos bool) bool {
	t := strings.ToLower(texto)
	if strings.Contains(t, "http") || strings.Contains(t, "www.") || enlace.MatchString(t) {
		return true
	}
	return cortos && enlaceCorto.MatchString(t)
}
