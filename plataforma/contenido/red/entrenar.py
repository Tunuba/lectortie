# La red neuronal de lectortie.
#
# Aprende de dataset.json, 558 videos de TikTok clasificados a mano uno por uno en los 8 temas
# de lectura, a decir a que lectura se parece un video leyendo su texto. Es una red pequena,
# nuestra y entrenada desde cero, con una capa de 16 neuronas.
#
# Que hace con eso la app. Cada video del feed y cada libro del catalogo pasan por la red y
# salen con un vector, cuanto se parece a cada tema. Tu gusto es la suma de los vectores de
# los videos donde te quedaste, por los segundos que te quedaste, y el libro que te recomienda
# es el que mas se parece a tu gusto.
#
# Uso, desde plataforma/contenido, despues de construir.py:
#     python -B red/entrenar.py
# Escribe red/modelo.json, red/libros-vectores.json, agrega el vector a cada video de
# videos.json y deja en web/public/motor/red.json lo que muestra la pagina Asi recomienda.
import json
import math
import os
import re
import sys
import unicodedata

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import confusion_matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
CONT = os.path.dirname(AQUI)
PLAT = os.path.dirname(CONT)
APP = os.path.dirname(PLAT)
TEMAS = ['terror', 'romantasy', 'fantasia', 'misterio', 'distopia', 'espacio', 'clasicos', 'latinoamerica']
OCULTAS = 16
SEMILLA = 7

# Las palabras que no dicen nada del tema. Se quitan antes de aprender.
VACIAS = set('''
de la el en y a los las un una unos unas que con por para del se su sus es al lo como mas pero le ya o u este esta estos estas
ese esa eso si sin sobre todo toda todos todas tambien me mi mis tu tus te nos les muy hay ser son fue era tiene tienen hace
hoy aqui alli asi cuando donde quien quienes cual cuales porque pues entre hasta desde hacia contra durante cada otro otra
the and you for this that with are your from all have not but was what more how out like just get can its our
fyp parati paratii foryou foryoupage viral viralvideo tiktok capcut reels reel shorts trend trending fypage fypp fyppp
video videos ver mira descubre aprende conoce sigueme comenta comparte like likes respuesta part
'''.split())


def palabras(texto):
    """Las palabras de un texto, en minusculas, sin tildes y cortadas a 6 letras, para que
    frutinovela y frutinovelas cuenten como la misma. La pagina del motor hace lo mismo en JS."""
    t = unicodedata.normalize('NFD', (texto or '').lower())
    t = ''.join(ch for ch in t if unicodedata.category(ch) != 'Mn')
    t = re.sub(r'[^a-z0-9]+', ' ', t)
    out = []
    for p in t.split():
        if len(p) < 3 or p.isdigit() or p in VACIAS or p.startswith('parati') or p.startswith('fyp'):
            continue
        out.append(p[:6])
    return out


def guardar(ruta, datos):
    with open(ruta, 'w', encoding='utf-8', newline='') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))


datos = json.load(open(os.path.join(AQUI, 'dataset.json'), encoding='utf-8'))
textos = [d['texto'] for d in datos]
y = np.array([TEMAS.index(d['tema']) for d in datos])


def nueva_red():
    return MLPClassifier(hidden_layer_sizes=(OCULTAS,), activation='relu', solver='adam', alpha=0.01,
                         learning_rate_init=0.01, max_iter=400, random_state=SEMILLA)


def vectorizador():
    return TfidfVectorizer(analyzer=palabras, binary=True, min_df=2, norm='l2', use_idf=True, smooth_idf=True)


# 1. Cuanto acierta con videos que nunca vio. Se aparta un 20 por ciento, se entrena con el
#    resto y se prueba con lo apartado. Ademas, validacion cruzada de 5 vueltas.
ent, prueba = train_test_split(np.arange(len(datos)), test_size=0.2, stratify=y, random_state=SEMILLA)
vz = vectorizador().fit([textos[i] for i in ent])
red = nueva_red().fit(vz.transform([textos[i] for i in ent]), y[ent])
pred = red.predict(vz.transform([textos[i] for i in prueba]))
acierto = float((pred == y[prueba]).mean())
confusion = confusion_matrix(y[prueba], pred, labels=list(range(len(TEMAS)))).tolist()
vueltas = []
for a, b in StratifiedKFold(n_splits=5, shuffle=True, random_state=SEMILLA).split(textos, y):
    v = vectorizador().fit([textos[i] for i in a])
    r = nueva_red().fit(v.transform([textos[i] for i in a]), y[a])
    vueltas.append(float((r.predict(v.transform([textos[i] for i in b])) == y[b]).mean()))
print(f'acierta {acierto:.3f} con {len(prueba)} videos que no vio; validacion cruzada {np.mean(vueltas):.3f} ({", ".join(f"{x:.2f}" for x in vueltas)})')

# 2. La red final aprende de los 558.
vz = vectorizador().fit(textos)
red = nueva_red().fit(vz.transform(textos), y)
vocab = {p: int(i) for p, i in vz.vocabulary_.items()}
idf = [float(x) for x in vz.idf_]
W1, b1 = red.coefs_[0], red.intercepts_[0]
W2, b2 = red.coefs_[1], red.intercepts_[1]
print('vocabulario', len(vocab), 'palabras; capa oculta', OCULTAS, 'neuronas; vueltas de entrenamiento', red.n_iter_)


def pasar(texto):
    """La red, a mano, igual que en la pagina del motor. Devuelve la capa oculta y la salida."""
    x = np.zeros(len(vocab))
    for p in set(palabras(texto)):
        if p in vocab:
            x[vocab[p]] = idf[vocab[p]]
    n = np.linalg.norm(x)
    if n > 0:
        x = x / n
    h = np.maximum(0, x @ W1 + b1)
    z = h @ W2 + b2
    e = np.exp(z - z.max())
    return h, e / e.sum()


# la red a mano tiene que dar lo mismo que la de sklearn
for t in textos[:50]:
    _, p = pasar(t)
    assert np.allclose(p, red.predict_proba(vz.transform([t]))[0], atol=1e-6)

# 3. Los videos del catalogo. Cada uno sale con su vector, mitad lo que dice la red de su texto
#    original de TikTok y mitad el tema que le puso una persona.
ruta_videos = os.path.join(CONT, 'videos.json')
videos = json.load(open(ruta_videos, encoding='utf-8'))
originales = json.load(open(os.path.join(AQUI, 'textos-tiktok.json'), encoding='utf-8'))
for v in videos:
    texto = originales.get(v['ref']) or (v['texto'] + ' ' + v.get('etiqueta', ''))
    _, p = pasar(texto)
    mano = np.zeros(len(TEMAS))
    mano[TEMAS.index(v['tema'])] = 1
    vec = 0.5 * p + 0.5 * mano
    v['vector'] = {t: round(float(vec[i]), 4) for i, t in enumerate(TEMAS)}
with open(ruta_videos, 'w', encoding='utf-8', newline='') as f:
    json.dump(videos, f, ensure_ascii=False, indent=1)

# 4. Los libros. La red lee su titulo, su gancho y sus etiquetas, y eso se junta con lo que dicen
#    sus etiquetas puestas a mano.
ETIQUETA_TEMA = {
    'terror': 'terror', 'gotico': 'terror', 'romance': 'romantasy', 'romantasy': 'romantasy',
    'fantasia': 'fantasia', 'magia': 'fantasia', 'hadas': 'fantasia', 'mitologia': 'fantasia', 'dragones': 'fantasia', 'cuentos': 'fantasia', 'humor': 'fantasia',
    'misterio': 'misterio', 'intriga': 'misterio', 'atraco': 'misterio', 'justicia': 'misterio',
    'distopia': 'distopia', 'vigilancia': 'distopia', 'tecnologia': 'distopia', 'inteligencia artificial': 'distopia', 'videojuegos': 'distopia',
    'ciencia ficcion': 'espacio', 'espacio': 'espacio', 'ciencia': 'espacio',
    'clasico': 'clasicos', 'tragedia': 'clasicos', 'venganza': 'clasicos',
    'latinoamerica': 'latinoamerica', 'realismo magico': 'latinoamerica',
}
libros = json.load(open(os.path.join(APP, 'datos', 'libros.json'), encoding='utf-8'))
libros_vec, mapa_libros = {}, []
for l in libros:
    texto = f"{l['titulo']} {l['gancho']} {' '.join(l['temas'])}"
    h, p = pasar(texto)
    mano = np.zeros(len(TEMAS))
    for e in l['temas']:
        if e in ETIQUETA_TEMA:
            mano[TEMAS.index(ETIQUETA_TEMA[e])] += 1
    # un libro que no es de ningun tema de lectura (autoayuda, divulgacion) no se recomienda,
    # porque su vector seria solo la adivinanza de la red
    if not mano.sum():
        continue
    vec = 0.5 * p + 0.5 * (mano / mano.sum())
    libros_vec[l['id']] = {t: round(float(vec[i]), 4) for i, t in enumerate(TEMAS)}
    mapa_libros.append((l, h, vec))
guardar(os.path.join(AQUI, 'libros-vectores.json'), libros_vec)

# 5. El mapa. Cada video y cada libro es un punto; la capa oculta de 16 numeros se aplana a 2
#    con analisis de componentes principales, asi los que la red ve parecidos quedan cerca.
H = np.array([pasar(t)[0] for t in textos])
media = H.mean(axis=0)
_, _, Vt = np.linalg.svd(H - media, full_matrices=False)
P = Vt[:2].T
XY = (H - media) @ P
lo, hi = XY.min(axis=0), XY.max(axis=0)
norm = lambda q: [round(float((q[k] - lo[k]) / (hi[k] - lo[k] + 1e-9)), 4) for k in range(2)]

# palabras que mas empujan cada tema, para la pagina
peso_palabra = (W1 @ W2)
inverso = {i: p for p, i in vocab.items()}
fuertes = {t: [inverso[i] for i in np.argsort(-peso_palabra[:, k])[:8]] for k, t in enumerate(TEMAS)}

publico = {
    'temas': TEMAS,
    'vocab': vocab, 'idf': [round(x, 5) for x in idf],
    'W1': [[round(float(x), 5) for x in fila] for fila in W1], 'b1': [round(float(x), 5) for x in b1],
    'W2': [[round(float(x), 5) for x in fila] for fila in W2], 'b2': [round(float(x), 5) for x in b2],
    'vacias': sorted(VACIAS),
    'metricas': {'videos': len(datos), 'prueba': int(len(prueba)), 'acierto': round(acierto, 3),
                 'cruzada': round(float(np.mean(vueltas)), 3), 'confusion': confusion,
                 'por_tema': {t: int((y == k).sum()) for k, t in enumerate(TEMAS)},
                 'perdida': [round(float(x), 4) for x in red.loss_curve_], 'vueltas': int(red.n_iter_)},
    'fuertes': fuertes,
    'puntos': [{'t': d['texto'][:90], 'tema': TEMAS.index(d['tema']), 'xy': norm(XY[i])} for i, d in enumerate(datos)],
    'libros': [{'id': l['id'], 'titulo': l['titulo'], 'xy': norm((h - media) @ P),
                'tema': int(np.argmax(vec))} for l, h, vec in mapa_libros],
}
os.makedirs(os.path.join(PLAT, 'web', 'public', 'motor'), exist_ok=True)
guardar(os.path.join(PLAT, 'web', 'public', 'motor', 'red.json'), publico)
guardar(os.path.join(AQUI, 'modelo.json'), {k: publico[k] for k in ('temas', 'vocab', 'idf', 'W1', 'b1', 'W2', 'b2', 'metricas')})
print('listo, red.json', os.path.getsize(os.path.join(PLAT, 'web', 'public', 'motor', 'red.json')) // 1024, 'KB')
for t in TEMAS:
    print(f'  {t:<14} {", ".join(fuertes[t])}')
