package main

// La configuracion sale de plataforma/.env, que no se sube. Las claves no tienen valor por
// defecto: si falta una, el servidor no arranca y dice cual. El correo usa las mismas
// llaves SMTP de ledkid.com, que se leen de su .env sin copiarlas a ningun archivo de aqui.

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Raiz         string
	Web          string
	Portadas     string
	PGHost       string
	PGPort       string
	PGDB         string
	PGDueno      string
	PGDuenoClave string
	PGApp        string
	PGAppClave   string
	PanelClave   string
	Puerto       string
	URLPublica   string
	SMTPHost     string
	SMTPUser     string
	SMTPPass     string
	SMTPFrom     string
	GLPIURL      string
	GLPIApp      string
	GLPIUser     string
}

func leerEnv(ruta string) (map[string]string, error) {
	f, err := os.Open(ruta)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	m := map[string]string{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		l := strings.TrimSpace(strings.TrimPrefix(sc.Text(), "\uFEFF"))
		if l == "" || strings.HasPrefix(l, "#") {
			continue
		}
		k, v, ok := strings.Cut(l, "=")
		if !ok {
			continue
		}
		v = strings.TrimSpace(v)
		if len(v) >= 2 && (v[0] == '"' && v[len(v)-1] == '"' || v[0] == '\'' && v[len(v)-1] == '\'') {
			v = v[1 : len(v)-1]
		}
		m[strings.TrimSpace(k)] = v
	}
	return m, sc.Err()
}

func cargarConfig() Config {
	exe, _ := os.Executable()
	porDefecto := filepath.Dir(filepath.Dir(exe))
	raiz := flag.String("raiz", porDefecto, "carpeta plataforma, la que tiene el .env")
	flag.Parse()

	if abs, err := filepath.Abs(*raiz); err == nil {
		*raiz = abs
	}
	env, err := leerEnv(filepath.Join(*raiz, ".env"))
	if err != nil {
		log.Fatalf("no pude leer %s: %v", filepath.Join(*raiz, ".env"), err)
	}
	falta := []string{}
	req := func(k string) string {
		v := env[k]
		if v == "" {
			falta = append(falta, k)
		}
		return v
	}
	c := Config{
		Raiz:         *raiz,
		Web:          filepath.Join(*raiz, "web", "dist"),
		Portadas:     filepath.Join(filepath.Dir(*raiz), "img", "portadas"),
		PGHost:       req("PG_HOST"),
		PGPort:       req("PG_PORT"),
		PGDB:         req("PG_DB"),
		PGDueno:      req("PG_DUENO"),
		PGDuenoClave: req("PG_DUENO_CLAVE"),
		PGApp:        req("PG_APP"),
		PGAppClave:   req("PG_APP_CLAVE"),
		PanelClave:   req("PANEL_CLAVE"),
		Puerto:       req("PUERTO"),
		URLPublica:   strings.TrimRight(req("URL_PUBLICA"), "/"),
	}
	if len(falta) > 0 {
		log.Fatalf("faltan en .env: %s", strings.Join(falta, ", "))
	}

	// El correo de ledkid.com. Sin esto la app corre igual, pero los enlaces de entrada
	// solo se escriben en el log, para probar en local.
	if ruta := env["CORREO_ENV"]; ruta != "" {
		if le, err := leerEnv(ruta); err == nil {
			c.SMTPHost, c.SMTPUser, c.SMTPPass, c.SMTPFrom = le["SMTP_HOST"], le["SMTP_USER"], le["SMTP_PASS"], le["SMTP_FROM"]
		} else {
			log.Printf("correo apagado, no pude leer CORREO_ENV: %v", err)
		}
	}
	if c.SMTPHost == "" {
		c.SMTPHost = "smtp.gmail.com:587"
	}
	if !strings.Contains(c.SMTPHost, ":") {
		c.SMTPHost += ":587"
	}

	// GLPI del proyecto de ITIL, para los pedidos de ayuda. Es opcional.
	c.GLPIURL = strings.TrimRight(env["GLPI_URL"], "/")
	c.GLPIApp = env["GLPI_APP_TOKEN"]
	c.GLPIUser = env["GLPI_USER_TOKEN"]
	return c
}

func (c Config) dsn(usuario, clave string) string {
	return fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=disable application_name=lectortie",
		c.PGHost, c.PGPort, c.PGDB, usuario, clave)
}

func (c Config) correoListo() bool { return c.SMTPUser != "" && c.SMTPPass != "" }

func (c Config) glpiListo() bool { return c.GLPIURL != "" && c.GLPIApp != "" && c.GLPIUser != "" }
