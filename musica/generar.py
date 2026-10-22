"""Las canciones de Deslizar. Veinte bucles cortos, uno por grupo de lectura, hechos con
numpy como la musica de la presentacion y la de EDICION-DE-VIDEOS. Nada se descarga.

    python musica/generar.py            -> audio/musica/<id>.mp3 y datos/musica.json
    python musica/generar.py terror     -> solo esa

Cada cancion repite un motivo de dos compases, que es lo que la vuelve pegajosa. Se arman
6 compases y la pagina repite del compas 1 al 5, asi el silencio que mete el mp3 al
principio no se oye en el bucle.
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np
from scipy.signal import butter, lfilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SALIDA = os.path.join(RAIZ, "audio", "musica")
SR = 44100
COMPASES = 6


def hz(n):
    return 440 * 2 ** (n / 12)


def t_(dur):
    return np.arange(max(1, int(dur * SR))) / SR


def filtro(x, corte, tipo="low", orden=2):
    b, a = butter(orden, np.clip(np.array(corte) / (SR / 2), 1e-4, 0.999), btype=tipo)
    return lfilter(b, a, x)


def env(t, ataque, caida, dur=None):
    e = np.minimum(1, t / max(ataque, 1e-4)) * np.exp(-t * caida)
    if dur:
        e *= np.clip((dur - t) / 0.02, 0, 1)
    return e


# ------------------------------------------------------------------ instrumentos

def i_pluck(f, dur, rnd):
    t = t_(dur)
    s = 2 * ((f * t) % 1) - 1 + 0.5 * (2 * ((f * 1.006 * t) % 1) - 1)
    s = filtro(s, 2600, "low", 2)
    return s * env(t, 0.003, 7) * 0.5


def i_campana(f, dur, rnd):
    t = t_(dur + 0.6)
    p = [(1, 1, 2.2), (2, .4, 3.5), (3.01, .2, 5), (5.4, .08, 8)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * c) for r, a, c in p) * np.minimum(1, t / .003) * .5


def i_chip(f, dur, rnd):
    t = t_(dur)
    s = np.where((f * t) % 1 < 0.25, 1.0, -1.0)
    return s * env(t, 0.002, 3, dur) * 0.22


def i_organo(f, dur, rnd):
    t = t_(dur)
    s = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 2, 3, 4, 6))
    return s * np.minimum(1, t / .02) * np.clip((dur - t) / .05, 0, 1) * 0.25


def i_marimba(f, dur, rnd):
    t = t_(min(dur, 0.6) + 0.3)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 30)) * env(t, .002, 9) * 0.6


def i_rhodes(f, dur, rnd):
    t = t_(dur + 0.4)
    trem = 1 + 0.25 * np.sin(2 * np.pi * 4.5 * t)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)
    return s * trem * env(t, .004, 2.2) * 0.5


def i_piano(f, dur, rnd):
    t = t_(dur + 0.5)
    s = sum(np.sin(2 * np.pi * f * k * 1.0005 ** k * t) * np.exp(-t * (1.8 + k * 1.3)) / k for k in range(1, 7))
    return s * np.minimum(1, t / .002) * 0.6


def i_clave(f, dur, rnd):
    """clavecin, para los clasicos."""
    t = t_(dur + 0.2)
    s = sum(np.sign(np.sin(2 * np.pi * f * k * t)) * np.exp(-t * (4 + k * 2)) / k for k in (1, 2, 3))
    return filtro(s, 4200) * np.minimum(1, t / .001) * 0.3


def i_uke(f, dur, rnd):
    t = t_(dur + 0.2)
    s = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (5 + k * 3)) / k for k in (1, 2, 3, 4))
    return s * np.minimum(1, t / .002) * 0.55


def i_saw(f, dur, rnd):
    """sierra de synthwave con filtro abierto."""
    t = t_(dur)
    s = sum(2 * ((f * d * t + rnd.uniform()) % 1) - 1 for d in (1, 1.004, 0.996))
    return filtro(s, 1800) * env(t, .01, 1.5, dur) * 0.18


LEADS = {"pluck": i_pluck, "campana": i_campana, "chip": i_chip, "organo": i_organo, "marimba": i_marimba,
         "rhodes": i_rhodes, "piano": i_piano, "clave": i_clave, "uke": i_uke, "saw": i_saw}


def colchon(notas, dur, brillo, rnd):
    t = t_(dur)
    s = np.zeros(len(t))
    for n in notas:
        for d in (-0.08, 0.0, 0.08):
            s += 2 * ((hz(n + d) * t + rnd.uniform()) % 1) - 1
    s = filtro(s, brillo)
    return s * np.minimum(1, t / .3) * np.minimum(1, (dur - t) / .3) / (3 * len(notas))


def bajo(f, dur, tipo):
    t = t_(dur)
    if tipo == "sub":
        s = np.sin(2 * np.pi * f * t)
    elif tipo == "sierra":
        s = filtro(2 * ((f * t) % 1) - 1, 700)
    elif tipo == "chip":
        s = np.where((f * t) % 1 < .5, .6, -.6)
    else:
        s = np.sin(2 * np.pi * f * t) + .35 * np.sign(np.sin(2 * np.pi * f * t))
        s = filtro(s, 500)
    return s * np.minimum(1, t / .005) * np.clip((dur - t) / .02, 0, 1) * 0.5


def bombo(rnd, grave=48):
    t = t_(.4)
    return np.sin(2 * np.pi * (grave + 110 * np.exp(-t * 35)) * t) * np.exp(-t * 8)


def caja(rnd):
    t = t_(.22)
    return filtro(rnd.standard_normal(len(t)), [1200, 7000], "band") * np.exp(-t * 22) * .8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * .4


def palmas(rnd):
    t = t_(.22)
    x = filtro(rnd.standard_normal(len(t)), [900, 5000], "band")
    e = sum(np.concatenate([np.zeros(int(d * SR)), np.exp(-np.arange(len(t) - int(d * SR)) / SR * (60 if k < 2 else 18))]) for k, d in enumerate((0, .008, .017)))
    return x * e


def charles(rnd, abierto=False):
    t = t_(.25 if abierto else .06)
    return filtro(rnd.standard_normal(len(t)), 7000, "high") * np.exp(-t * (10 if abierto else 80)) * .5


def maraca(rnd):
    t = t_(.08)
    return filtro(rnd.standard_normal(len(t)), [4000, 11000], "band") * np.minimum(1, t / .01) * np.exp(-t * 50) * .5


def tom(rnd, f=110):
    t = t_(.45)
    return np.sin(2 * np.pi * (f + 60 * np.exp(-t * 18)) * t) * np.exp(-t * 6)


def latido(rnd):
    t = t_(.4)
    return np.sin(2 * np.pi * (50 + 70 * np.exp(-t * 30)) * t) * np.exp(-t * 8)


def tic(rnd):
    t = t_(.05)
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120)


def chip_ruido(rnd):
    t = t_(.07)
    return np.sign(rnd.standard_normal(len(t))) * np.exp(-t * 60) * .3


GOLPES = {"k": bombo, "s": caja, "c": palmas, "h": charles, "o": lambda r: charles(r, True), "m": maraca,
          "t": tom, "T": lambda r: tom(r, 80), "l": latido, "i": tic, "n": chip_ruido}


# ------------------------------------------------------------------ las recetas
# acordes en semitonos desde La 440, un acorde por compas, se repiten.
# bateria, 16 pasos por compas por instrumento.
# motivo, el que se repite: 'auto' lo arma con las notas del acorde y una semilla.

def receta(id_, nombre, bpm, acordes, bajo_tipo, bateria, lead, pad=None, brillo=1600, octava=12, semilla=1,
           densidad=.55, swing=0.0, eco=0.25, extra=None):
    return dict(id=id_, nombre=nombre, bpm=bpm, acordes=acordes, bajo=bajo_tipo, bateria=bateria, lead=lead,
                pad=pad, brillo=brillo, octava=octava, semilla=semilla, densidad=densidad, swing=swing, eco=eco, extra=extra)


MAYOR = [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]]          # Do Sol Lam Fa
MENOR = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-1, 3, 7]]           # Lam Fa Sol Mi
OSCURO = [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-1, 2, 7]]            # Lam Sib Lam Mi
SOÑADOR = [[-4, 0, 3, 7], [-7, -3, 0, 3], [-2, 2, 5, 9], [3, 7, 10, 14]]

RECETAS = [
    receta("romantasy", "Alas al amanecer", 112, SOÑADOR, "sub",
           {"k": "x...x...x...x...", "c": "....x.......x...", "h": "..x...x...x...x."}, "campana", pad=1, brillo=2600, semilla=3),
    receta("mitologia", "Tambores del Olimpo", 96, MENOR, "sub",
           {"k": "x.....x...x.....", "t": "....x.......x.x.", "T": "x..........x....", "h": "x.x.x.x.x.x.x.x."}, "pluck", pad=1, brillo=1200, semilla=8),
    receta("terror-latino", "Latido en la casona", 92, OSCURO, "sub",
           {"l": "x...x...x...x...", "i": "x.x.x.x.x.x.x.x.", "m": "...x..x....x..x."}, "campana", pad=1, brillo=700, octava=24, semilla=13, densidad=.35),
    receta("distopia-ia", "Algoritmo", 104, MENOR, "sierra",
           {"k": "x...x...x...x...", "s": "....x.......x...", "h": "x.xxx.xxx.xxx.xx"}, "saw", pad=1, brillo=1400, semilla=21),
    receta("salud-mental", "Respira", 78, SOÑADOR, "sub",
           {"k": "x.........x.....", "s": "....x.......x...", "h": "..x...x...x...x."}, "rhodes", pad=1, brillo=900, semilla=5, densidad=.4, swing=.12),
    receta("espacio", "Órbita baja", 100, SOÑADOR, "sub",
           {"k": "x.......x.......", "h": "x.x.x.x.x.x.x.x.", "c": "........x......."}, "pluck", pad=1, brillo=1800, octava=24, semilla=34, eco=.45),
    receta("nostalgia-gamer", "Nivel 1 1", 140, MAYOR, "chip",
           {"k": "x...x...x...x...", "n": "....x.......x...", "h": "x.x.x.x.x.x.x.x."}, "chip", semilla=55, densidad=.75, eco=.1),
    receta("dark-academia", "Biblioteca de medianoche", 88, MENOR, "sub",
           {"k": "x.......x.......", "h": "....x.......x..."}, "piano", pad=1, brillo=1000, semilla=89, densidad=.6),
    receta("realismo-magico", "Mariposas amarillas", 100, MAYOR, "normal",
           {"k": "x..x..x.x..x..x.", "m": "x.xxx.xxx.xxx.xx", "c": "....x.......x..."}, "marimba", semilla=144, densidad=.7),
    receta("atracos", "El último golpe", 120, MENOR, "normal",
           {"k": "x.....x.x.......", "s": "....x.......x...", "h": "x.x.x.x.x.x.x.x."}, "pluck", semilla=233, densidad=.5, swing=.15),
    receta("monstruos", "Vals del castillo", 100, OSCURO, "sub",
           {"k": "x...........x...", "i": "....x...x.......", "T": "x.......x......."}, "organo", pad=1, brillo=900, semilla=377, densidad=.45),
    receta("venganza", "Carta sin firma", 116, OSCURO, "sierra",
           {"k": "x..x..x...x.....", "s": "....x.......x...", "h": "xxxxxxxxxxxxxxxx"}, "saw", semilla=610, densidad=.5),
    receta("una-tarde", "Una tarde", 96, MAYOR, "sub",
           {"k": "x.......x.......", "c": "....x.......x...", "h": "..x...x...x...x."}, "uke", semilla=987, densidad=.6),
    receta("llorar", "Okay okay", 74, SOÑADOR, "sub",
           {"k": "x.........x.....", "h": "....x.......x..."}, "piano", pad=1, brillo=900, semilla=1597, densidad=.4),
    receta("juicios", "Sala tres", 100, MENOR, "sub",
           {"k": "x...x...x...x...", "i": "x.x.x.x.x.x.x.x.", "T": "..........x....."}, "pluck", pad=1, brillo=800, semilla=2584, densidad=.35),
    receta("secundaria", "Recreo", 128, MAYOR, "normal",
           {"k": "x...x...x...x...", "c": "....x.......x...", "h": "x.xxx.xxx.xxx.xx"}, "uke", semilla=4181, densidad=.7),
    receta("tuyo", "Para ti", 118, MAYOR, "sub",
           {"k": "x...x...x...x...", "c": "....x.......x...", "h": "..x...x...x...x."}, "pluck", pad=1, brillo=2200, semilla=6765, densidad=.65),
    receta("pausa", "Hora de leer", 70, SOÑADOR, "sub",
           {"h": "....x.......x..."}, "campana", pad=1, brillo=800, semilla=17, densidad=.3, eco=.5),
    receta("promo", "Recién salido", 122, MAYOR, "normal",
           {"k": "x...x...x...x...", "s": "....x.......x...", "h": "x.x.x.x.x.x.x.x.", "o": "..x...x...x...x."}, "chip", semilla=28657, densidad=.6),
    receta("clasicos", "Minueto de bolsillo", 112, MAYOR, "normal",
           {"k": "x.......x.......", "h": "....x.......x..."}, "clave", semilla=46368, densidad=.8),
]


def motivo(r, rnd):
    """dos compases de 16 pasos con notas del acorde. Se repite igual en cada vuelta."""
    pasos = []
    for comp in range(2):
        for p in range(16):
            fuerte = p % 4 == 0
            if rnd.uniform() < (r["densidad"] + (.25 if fuerte else 0)):
                pasos.append((comp, p, rnd.integers(0, 3), 1 + int(rnd.uniform() < .35)))
    return pasos


def hacer(r):
    rnd = np.random.default_rng(r["semilla"])
    pulso = 60 / r["bpm"]
    compas = 4 * pulso
    paso = pulso / 4
    n = int(COMPASES * compas * SR)
    buf = np.zeros((2, n))

    def poner(seg, cuando, vol=1.0, pan=0.0):
        i = int(cuando * SR)
        if i >= n or i < 0:
            return
        seg = seg[: n - i]
        buf[0, i:i + len(seg)] += seg * vol * np.sqrt(.5 * (1 - pan))
        buf[1, i:i + len(seg)] += seg * vol * np.sqrt(.5 * (1 + pan))

    lead = LEADS[r["lead"]]
    mot = motivo(r, rnd)
    for c in range(COMPASES):
        t0 = c * compas
        ac = r["acordes"][c % len(r["acordes"])]
        if r["pad"]:
            poner(colchon([x - 12 for x in ac], compas + .6, r["brillo"], rnd), max(0, t0 - .3), .35)
        raiz = ac[0] - 24
        for k in range(8 if r["bpm"] > 95 else 4):
            dur = compas / (8 if r["bpm"] > 95 else 4)
            f = hz(raiz + (12 if (k % 2 and r["bajo"] != "sub") else 0))
            poner(bajo(f, dur * .9, r["bajo"]), t0 + k * dur, .55)
        for ins, patron in r["bateria"].items():
            for p, ch in enumerate(patron):
                if ch != "x":
                    continue
                desfase = r["swing"] * paso if p % 2 else 0
                vol = {"k": .9, "s": .45, "c": .4, "h": .14, "o": .12, "m": .16, "t": .6, "T": .7, "l": .8, "i": .08, "n": .4}[ins]
                poner(GOLPES[ins](rnd), t0 + p * paso + desfase, vol, (-.3 if ins in "hm" else .2 if ins in "ci" else 0))
        for (cm, p, grado, largo) in mot:
            if cm != c % 2:
                continue
            nota = ac[min(grado, len(ac) - 1)] + r["octava"]
            desfase = r["swing"] * paso if p % 2 else 0
            poner(lead(hz(nota), largo * paso * 1.6, rnd), t0 + p * paso + desfase, .42, -.25 if p % 2 else .25)
    # eco cruzado
    d = int(pulso * .75 * SR)
    sal = buf.copy()
    for k in range(1, 5):
        g = r["eco"] * .45 ** (k - 1)
        lado = k % 2
        sal[lado, d * k:] += buf[1 - lado, : n - d * k] * g
    x = sal / max(1e-9, np.abs(sal).max()) * .89
    os.makedirs(SALIDA, exist_ok=True)
    wav = os.path.join(SALIDA, r["id"] + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype("<i2").tobytes())
    mp3 = os.path.join(SALIDA, r["id"] + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", "112k", mp3], check=True)
    os.remove(wav)
    return {"nombre": r["nombre"], "bpm": r["bpm"], "ini": round(compas, 4), "fin": round(5 * compas, 4)}


if __name__ == "__main__":
    solo = sys.argv[1:]
    meta_f = os.path.join(RAIZ, "datos", "musica.json")
    meta = json.load(open(meta_f, encoding="utf8")) if os.path.exists(meta_f) else {}
    for r in RECETAS:
        if solo and r["id"] not in solo:
            continue
        meta[r["id"]] = hacer(r)
        print(r["id"], meta[r["id"]], flush=True)
    json.dump(meta, open(meta_f, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("FIN", len(meta))
