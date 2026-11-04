package main

// Pruebas de los arreglos del 04-11 en la manana: el filtro de enlaces, el tiempo dicho como
// persona y la cache que no guarda una lectura vieja.

import "testing"

func TestFiltroDeComentarios(t *testing.T) {
	casos := []struct {
		texto string
		pasa  bool
	}{
		{"Triste.me hizo llorar", true},
		{"Me encantó.me dio miedo", true},
		{"Muy bueno.Lo recomiendo", true},
		{"Lo lei 10.10", true},
		{"10 de 10", true},
		{"Bueno.Como siempre", true},
		{"mira youtube.com", false},
		{"bit.ly/abc", false},
		{"wa.me/50255551234", false},
		{"entra a prensalibre.gt", false},
		{"https://algo", false},
		{"www.algo", false},
		{"que put4 m13rd4", false},
		{"eres un idiota", false},
	}
	for _, c := range casos {
		if got := limpio(c.texto); got != c.pasa {
			t.Errorf("limpio(%q) = %v, queria %v", c.texto, got, c.pasa)
		}
	}
}

func TestFiltroDeAlias(t *testing.T) {
	casos := []struct {
		alias string
		pasa  bool
	}{
		{"messi.10", true},
		{"kevin.gt", true},
		{"ana.me", true},
		{"jose.co", true},
		{"luis_10", true},
		{"juan.pablo", true},
		{"pagina.com", false},
		{"put4", false},
		{"hdp", false},
	}
	for _, c := range casos {
		if got := aliasLimpio(c.alias); got != c.pasa {
			t.Errorf("aliasLimpio(%q) = %v, queria %v", c.alias, got, c.pasa)
		}
	}
}

func TestSegundosTexto(t *testing.T) {
	casos := map[int64]string{
		1000:   "1 segundo",
		13000:  "13 segundos",
		59400:  "59 segundos",
		60000:  "1 minuto",
		89000:  "1 minuto",
		90000:  "2 minutos",
		312000: "5 minutos",
	}
	for ms, quiere := range casos {
		if got := segundosTexto(ms); got != quiere {
			t.Errorf("segundosTexto(%d) = %q, queria %q", ms, got, quiere)
		}
	}
}

// Un feed lee el estado, a medio leer llega una vista que lo olvida, y el feed termina despues:
// lo que leyo ya es viejo y no se guarda.
func TestCacheNoGuardaLoViejo(t *testing.T) {
	c := nuevoCache()
	viejo := &estadoLector{}
	g := c.generacion("a")
	c.olvidar("a") // llega la vista
	nuevo := &estadoLector{}
	c.guardarSi("a", nuevo, c.generacion("a"))
	c.guardarSi("a", viejo, g) // el feed termina tarde
	if c.m["a"] != nuevo {
		t.Fatal("la cache guardo el estado viejo encima del nuevo")
	}
	// sin nada en medio, se guarda
	g2 := c.generacion("b")
	e := &estadoLector{}
	c.guardarSi("b", e, g2)
	if c.m["b"] != e {
		t.Fatal("la cache no guardo un estado al dia")
	}
}

func TestPuenteDeClasicos(t *testing.T) {
	cat := &Catalogo{Temas: map[string]Tema{"clasicos": {Clave: "clasicos", Nombre: "Clásicos"}}}
	tema := cat.Temas["clasicos"]
	fruti := map[string]*recienteTema{"clasicos": {ms: 16000, vistas: 1, etiqueta: "Frutinovela", etiMS: 16000}}
	cari := map[string]*recienteTema{"clasicos": {ms: 16000, vistas: 1, etiqueta: "Caricatura", etiMS: 16000}}
	if m := motivoMicro(tema, porOtro, nil, fruti, cat); m != "Te quedaste 16 segundos en una frutinovela. Aquí va un clásico con más drama que una telenovela" {
		t.Errorf("frutinovela: %q", m)
	}
	if m := motivoMicro(tema, porOtro, nil, cari, cat); m != "Te quedaste 16 segundos en una caricatura. Aquí va un clásico que no pasa de moda" {
		t.Errorf("caricatura: %q", m)
	}
}
