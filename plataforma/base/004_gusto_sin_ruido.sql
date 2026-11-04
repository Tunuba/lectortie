-- El gusto solo sube en los temas en que la red esta segura (03-11 en la noche).
-- La red le ponia a los BookTok de terror un pedazo de romantasy, de 0.14 a 0.20, y cada vez que
-- alguien se quedaba en uno de terror le subia tambien romantasy, aunque pasara rapido todos los
-- de romantasy. Ahora cuentan solo los temas con 0.25 o mas, y siempre el tema del video,
-- repartidos otra vez para que sumen 1. Un video que de verdad es de dos temas, como Cinco
-- leyendas de Guatemala con 0.50 de terror y 0.50 de Latinoamerica, sigue sumando a los dos.
CREATE OR REPLACE FUNCTION sumar_gusto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  t    text;
  vec  jsonb;
  s    real;
  k    text;
  p    real;
BEGIN
  SELECT tema, vector INTO t, vec FROM videos WHERE id = NEW.video;
  s := least(NEW.ms, 30000) / 3000.0
       + NEW.vueltas * 2
       + CASE WHEN NEW.gusta THEN 4 ELSE 0 END
       - CASE WHEN NEW.salto THEN 2.5 ELSE 0 END;
  IF vec IS NULL THEN
    vec := jsonb_build_object(t, 1);
  ELSE
    SELECT coalesce(jsonb_object_agg(x.key, x.p / x.total), jsonb_build_object(t, 1)) INTO vec
    FROM (SELECT key, value::real AS p, sum(value::real) OVER () AS total
          FROM jsonb_each_text(vec)
          WHERE value::real >= 0.25 OR key = t) x;
  END IF;
  FOR k, p IN SELECT key, value::real FROM jsonb_each_text(vec) LOOP
    INSERT INTO gustos AS g (lector, tema, peso, ms_total, vistas)
    VALUES (NEW.lector, k, greatest(s * p, -5), round(NEW.ms * p), CASE WHEN k = t THEN 1 ELSE 0 END)
    ON CONFLICT (lector, tema) DO UPDATE
      SET peso = greatest(g.peso * (0.97 - 0.12 * p) + s * p, -5),
          ms_total = g.ms_total + round(NEW.ms * p),
          vistas = g.vistas + CASE WHEN k = t THEN 1 ELSE 0 END,
          actualizado = now();
  END LOOP;
  UPDATE gustos SET peso = peso * 0.97 WHERE lector = NEW.lector AND NOT (vec ? tema);
  UPDATE lectores SET visto = now() WHERE id = NEW.lector;
  RETURN NEW;
END $$;
