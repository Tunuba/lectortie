-- Dos vistas del mismo lector a la vez se trababan (04-11). Pasa con la misma cuenta en dos
-- aparatos y tambien con una sola persona que desliza muy rapido. Cada vista subia el gusto de
-- los temas de su video, en el orden en que salian, y enfriaba los demas; dos a la vez tomaban
-- las filas de gustos en distinto orden, cada una esperaba a la otra y PostgreSQL cancelaba una
-- (deadlock detected, la vista daba 500). Con 2 vistas a la vez fallaba el 16 por ciento y con
-- 4 el 40.
--
-- Ahora todo lo que cambia el gusto toma primero el turno del lector, su fila en lectores, y
-- despues toca gustos: las del mismo lector esperan una a la otra en fila y nunca se cruzan.
-- Es FOR NO KEY UPDATE y no FOR UPDATE porque insertar la vista ya toma FOR KEY SHARE sobre el
-- lector por la llave foranea, y FOR UPDATE choca con eso y volvia a trabarse.
-- Lo demas de las dos funciones queda igual que en 004 y 001.

CREATE OR REPLACE FUNCTION sumar_gusto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  t    text;
  vec  jsonb;
  s    real;
  k    text;
  p    real;
BEGIN
  PERFORM 1 FROM lectores WHERE id = NEW.lector FOR NO KEY UPDATE;
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

CREATE OR REPLACE FUNCTION abrir_micro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t text;
BEGIN
  IF NEW.abierta AND NOT OLD.abierta THEN
    PERFORM 1 FROM lectores WHERE id = NEW.lector FOR NO KEY UPDATE;
    SELECT tema INTO t FROM lecturas WHERE id = NEW.lectura;
    INSERT INTO gustos AS g (lector, tema, peso) VALUES (NEW.lector, t, 6)
    ON CONFLICT (lector, tema) DO UPDATE SET peso = g.peso + 6, actualizado = now();
  END IF;
  RETURN NEW;
END $$;
