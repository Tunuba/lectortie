-- lectortie, 03-11. El feed engancha primero con lo que ya ven los jovenes y despues va a libros.
-- Cada video dice su clase (general o libros) y su etiqueta (Frutinovela, Leyenda, BookTok...).

ALTER TABLE videos ADD COLUMN clase text NOT NULL DEFAULT 'libros' CHECK (clase IN ('general', 'libros'));
ALTER TABLE videos ADD COLUMN etiqueta text NOT NULL DEFAULT 'BookTok' CHECK (length(etiqueta) BETWEEN 2 AND 30);
CREATE INDEX videos_activos ON videos (clase, tema) WHERE activo;

-- El ranking muestra la racha que sigue viva. La guardada no se apaga sola si alguien deja de
-- leer un dia, asi que aqui se mira el ultimo dia que leyo.
CREATE OR REPLACE VIEW ranking_semana AS
SELECT l.id, l.alias,
       CASE WHEN l.ultimo_dia >= (now() AT TIME ZONE 'America/Guatemala')::date - 1 THEN l.racha ELSE 0::smallint END AS racha,
       l.nivel,
       coalesce(sum(h.paginas), 0)::integer AS paginas,
       count(h.id) FILTER (WHERE h.terminada)::integer AS terminadas
FROM lectores l
JOIN lecturas_hechas h ON h.lector = l.id AND h.creado >= date_trunc('week', now())
WHERE l.alias IS NOT NULL
GROUP BY l.id
ORDER BY paginas DESC, terminadas DESC
LIMIT 20;
