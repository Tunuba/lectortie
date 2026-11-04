package main

import (
	"strings"
	"testing"
	"time"
)

// Los casos de Meme del 04-11 en la madrugada, con su gusto de dias: terror y Latinoamerica muy
// abajo, romantasy y misterio arriba.

func catPrueba() *Catalogo {
	cat := &Catalogo{Temas: map[string]Tema{}, Lecturas: map[string]Lectura{}, Videos: map[int]Video{},
		PorTema: map[string][]int{}, LectTema: map[string][]string{}, Libros: map[string]Libro{}}
	for i, t := range []string{"terror", "romantasy", "fantasia", "misterio", "distopia", "espacio", "clasicos", "latinoamerica"} {
		cat.Temas[t] = Tema{Clave: t, Nombre: strings.ToUpper(t[:1]) + t[1:], Orden: i}
		cat.Orden = append(cat.Orden, t)
		for k := 0; k < 3; k++ {
			id := t + "-" + string(rune('a'+k))
			cat.Lecturas[id] = Lectura{ID: id, Tema: t, Nivel: 1, Paginas: make([][]string, 3)}
			cat.LectTema[t] = append(cat.LectTema[t], id)
		}
	}
	return cat
}

type vistaPrueba struct {
	tema, etiqueta string
	ms             int
}

// estadoPrueba arma lo que veria la cache; las vistas van de la mas vieja a la mas nueva.
func estadoPrueba(cat *Catalogo, vs []vistaPrueba) *estadoLector {
	e := &estadoLector{vistos: map[int]yaVisto{}, micros: map[string]microVista{}, terminadas: map[string]bool{},
		gustos: []gusto{{Tema: "romantasy", Peso: 0.8}, {Tema: "misterio", Peso: 0.7}, {Tema: "terror", Peso: -3}, {Tema: "latinoamerica", Peso: -3.2}}}
	ahora := time.Now()
	for i, v := range vs {
		id := 1000 + i
		cat.Videos[id] = Video{ID: id, Tema: v.tema, Etiqueta: v.etiqueta}
		e.vistos[id] = yaVisto{ultima: ahora.Add(time.Duration(i-len(vs)) * 3 * time.Second), ms: v.ms, salto: v.ms < 2500}
	}
	return e
}

func elegir(t *testing.T, vs []vistaPrueba) (Lectura, string, bool) {
	cat := catPrueba()
	e := estadoPrueba(cat, vs)
	rs := recientes(cat, e, time.Now())
	rec := resumenReciente(rs)
	l, por, ok := elegirPorAtrapo(cat, e, rs, rec, 1)
	if !ok {
		return l, "", false
	}
	m := motivoMicro(cat.Temas[l.Tema], por, e.gustos, rec, cat)
	t.Logf("%s: %s", l.ID, m)
	return l, m, true
}

func TestLaLeyendaDeTerrorDaTerror(t *testing.T) {
	l, m, ok := elegir(t, []vistaPrueba{{"terror", "Leyenda", 1170}, {"espacio", "BookTok", 1025}, {"terror", "Leyenda", 43065}})
	if !ok || l.Tema != "terror" {
		t.Fatalf("despues de 43 s en una leyenda de terror salio %q, %v", l.Tema, ok)
	}
	if !strings.HasPrefix(m, "Te quedaste 43 segundos en una leyenda") {
		t.Fatalf("motivo %q", m)
	}
}

func TestTresRapidosNoAdivina(t *testing.T) {
	if l, _, ok := elegir(t, []vistaPrueba{{"romantasy", "BookTok", 1595}, {"romantasy", "Caricatura", 1028}, {"distopia", "Pixel art", 1799}}); ok {
		t.Fatalf("con tres videos pasados rapido no debia haber lectura, salio %q", l.Tema)
	}
}

func TestElCambioARomanceGana(t *testing.T) {
	vs := []vistaPrueba{{"terror", "Leyenda", 43065}, {"terror", "Leyenda", 6182}, {"terror", "BookTok", 734}, {"espacio", "BookTok", 1781},
		{"terror", "BookTok", 1242}, {"clasicos", "BookTok", 868}, {"romantasy", "Frutinovela", 45314}, {"latinoamerica", "BookTok", 1066}}
	l, m, ok := elegir(t, vs)
	if !ok || l.Tema != "romantasy" {
		t.Fatalf("despues de 45 s en una frutinovela salio %q", l.Tema)
	}
	if !strings.Contains(m, "frutinovela") {
		t.Fatalf("motivo %q", m)
	}
}

func TestLaDemo(t *testing.T) {
	l, m, ok := elegir(t, []vistaPrueba{{"terror", "Leyenda", 8000}, {"romantasy", "Caricatura", 1000}, {"fantasia", "Risa", 4000}})
	if !ok || l.Tema != "terror" {
		t.Fatalf("en la demo salio %q, %v", l.Tema, ok)
	}
	if !strings.HasPrefix(m, "Te quedaste 8 segundos en una leyenda") {
		t.Fatalf("motivo %q", m)
	}
}

func TestLoViejoSeApaga(t *testing.T) {
	// se quedo en terror hace rato y ahora pasa todo; terror ya no es seguro
	vs := []vistaPrueba{{"terror", "BookTok", 5000}}
	for i := 0; i < 9; i++ {
		vs = append(vs, vistaPrueba{"clasicos", "BookTok", 900})
	}
	if l, _, ok := elegir(t, vs); ok {
		t.Fatalf("5 s de hace diez videos no deberian decidir, salio %q", l.Tema)
	}
}

func TestSiYaPasaElTemaViejoEspera(t *testing.T) {
	// vio mucho terror y ahora lo pasa; todavia no le sale lo nuevo, asi que no hay de que estar seguro
	vs := []vistaPrueba{}
	for i := 0; i < 6; i++ {
		vs = append(vs, vistaPrueba{"terror", "BookTok", 30000})
	}
	vs = append(vs, vistaPrueba{"terror", "BookTok", 900}, vistaPrueba{"clasicos", "BookTok", 900}, vistaPrueba{"terror", "Leyenda", 800})
	if l, _, ok := elegir(t, vs); ok {
		t.Fatalf("con el terror pasado dos veces seguidas salio %q", l.Tema)
	}
}

func TestLaPrimeraEsLaMasCorta(t *testing.T) {
	c := []Lectura{{ID: "larga", Nivel: 1, Paginas: make([][]string, 7)}, {ID: "corta", Nivel: 2, Paginas: make([][]string, 3)}, {ID: "corta2", Nivel: 2, Paginas: make([][]string, 3)}}
	for k := 0; k < 20; k++ {
		if l := mejorLectura(append([]Lectura{}, c...), 1, 0); l.ID == "larga" {
			t.Fatal("la primera lectura salio la de 7 paginas")
		}
		if l := mejorLectura(append([]Lectura{}, c...), 1, 3); l.ID != "larga" {
			t.Fatalf("con lecturas terminadas debia ir la de su nivel, salio %s", l.ID)
		}
	}
}
