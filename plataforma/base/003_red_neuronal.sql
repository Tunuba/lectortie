-- lectortie, 03-11 noche. La red neuronal entra a la recomendacion.
-- Cada video y cada libro guarda su vector, cuanto se parece a cada uno de los 8 temas segun
-- la red entrenada con videos clasificados a mano (contenido/red/entrenar.py).

ALTER TABLE videos ADD COLUMN vector jsonb CHECK (vector IS NULL OR jsonb_typeof(vector) = 'object');
ALTER TABLE libros ADD COLUMN vector jsonb CHECK (vector IS NULL OR jsonb_typeof(vector) = 'object');

-- Cada vez que alguien toca Conseguir el libro. Es la metrica del negocio por comision.
CREATE TABLE salidas (
  id      bigserial PRIMARY KEY,
  lector  uuid REFERENCES lectores ON DELETE SET NULL,
  libro   text NOT NULL REFERENCES libros,
  desde   text NOT NULL CHECK (desde ~ '^[a-z]{2,20}$'),
  creado  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX salidas_creado ON salidas (creado DESC);

-- El gusto ya no sube solo en el tema del video. Sube en cada tema segun cuanto se parece el
-- video a ese tema, y baja un poco en los que no se parece. Con un vector de un solo tema da
-- lo mismo que antes, 0.85 al tema del video y 0.97 a los demas.
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

GRANT SELECT, INSERT ON salidas TO lectortie_app;
GRANT USAGE ON SEQUENCE salidas_id_seq TO lectortie_app;
