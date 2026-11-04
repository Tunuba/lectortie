-- lectortie, esquema de la base. Lo corre el dueño (lectortie_dueno) al arrancar el servidor.
-- La app entra como lectortie_app, que solo puede leer y escribir lo que se le da al final.

ALTER DATABASE lectortie SET timezone TO 'America/Guatemala';
SET timezone TO 'America/Guatemala';

-- ---------- catalogo ----------

CREATE TABLE temas (
  clave   text PRIMARY KEY CHECK (clave ~ '^[a-z]{3,20}$'),
  nombre  text NOT NULL,
  piel    text NOT NULL,
  color   text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  orden   smallint NOT NULL DEFAULT 0
);

CREATE TABLE libros (
  id       text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,60}$'),
  titulo   text NOT NULL,
  autor    text NOT NULL,
  anio     smallint,
  paginas  smallint CHECK (paginas > 0),
  edad     text,
  nivel    smallint NOT NULL CHECK (nivel BETWEEN 1 AND 7),
  gancho   text NOT NULL,
  temas    text[] NOT NULL,
  portada  text NOT NULL
);
CREATE INDEX libros_titulo_trgm ON libros USING gin (titulo gin_trgm_ops);
CREATE INDEX libros_temas ON libros USING gin (temas);

-- Lo que se lee dentro de la app. micro es el fragmento corto que sale en el feed,
-- paginas es el texto completo, una lista de paginas y cada pagina una lista de parrafos.
CREATE TABLE lecturas (
  id       text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,60}$'),
  titulo   text NOT NULL,
  autor    text NOT NULL,
  tema     text NOT NULL REFERENCES temas,
  nivel    smallint NOT NULL CHECK (nivel BETWEEN 1 AND 7),
  micro    text NOT NULL CHECK (length(micro) BETWEEN 80 AND 1200),
  paginas  jsonb NOT NULL CHECK (jsonb_typeof(paginas) = 'array'),
  minutos  smallint NOT NULL CHECK (minutos BETWEEN 1 AND 90),
  fuente   text NOT NULL,
  libro    text REFERENCES libros
);
CREATE INDEX lecturas_tema ON lecturas (tema, nivel);

CREATE TABLE videos (
  id      serial PRIMARY KEY,
  fuente  text NOT NULL CHECK (fuente IN ('tiktok', 'local')),
  ref     text NOT NULL,
  autor   text NOT NULL,
  texto   text NOT NULL,
  tema    text NOT NULL REFERENCES temas,
  libro   text REFERENCES libros,
  activo  boolean NOT NULL DEFAULT true,
  UNIQUE (fuente, ref)
);

-- ---------- personas ----------

CREATE TABLE lectores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias        text UNIQUE CHECK (alias ~ '^[a-z0-9._]{3,20}$'),
  correo       text CHECK (correo ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  nivel        smallint NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 7),
  racha        smallint NOT NULL DEFAULT 0 CHECK (racha >= 0),
  mejor_racha  smallint NOT NULL DEFAULT 0 CHECK (mejor_racha >= 0),
  ultimo_dia   date,
  paginas      integer NOT NULL DEFAULT 0 CHECK (paginas >= 0),
  puntos       integer NOT NULL DEFAULT 0 CHECK (puntos >= 0),
  creado       timestamptz NOT NULL DEFAULT now(),
  visto        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lectores_correo ON lectores (lower(correo)) WHERE correo IS NOT NULL;

-- La cookie lleva un token al azar. Aqui solo se guarda su sha256.
CREATE TABLE sesiones (
  token   bytea PRIMARY KEY CHECK (length(token) = 32),
  lector  uuid NOT NULL REFERENCES lectores ON DELETE CASCADE,
  creada  timestamptz NOT NULL DEFAULT now(),
  expira  timestamptz NOT NULL
);
CREATE INDEX sesiones_lector ON sesiones (lector);

-- Enlaces de entrada por correo, sin contrasena. Sirven una vez y vencen en 30 minutos.
CREATE TABLE enlaces (
  token   bytea PRIMARY KEY CHECK (length(token) = 32),
  correo  text NOT NULL,
  lector  uuid NOT NULL REFERENCES lectores ON DELETE CASCADE,
  creado  timestamptz NOT NULL DEFAULT now(),
  expira  timestamptz NOT NULL,
  usado   timestamptz
);

-- ---------- lo que pasa ----------

-- Cada video que alguien deja de ver, con cuanto se quedo.
CREATE TABLE vistas (
  id      bigserial PRIMARY KEY,
  lector  uuid NOT NULL REFERENCES lectores ON DELETE CASCADE,
  video   integer NOT NULL REFERENCES videos,
  ms      integer NOT NULL CHECK (ms BETWEEN 0 AND 600000),
  vueltas smallint NOT NULL DEFAULT 0 CHECK (vueltas BETWEEN 0 AND 50),
  salto   boolean NOT NULL,
  gusta   boolean NOT NULL DEFAULT false,
  creado  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vistas_lector ON vistas (lector, creado DESC);
CREATE INDEX vistas_creado ON vistas USING brin (creado);

-- El gusto de cada persona por tema. Lo mueve el trigger de vistas, nadie lo escribe a mano.
CREATE TABLE gustos (
  lector       uuid NOT NULL REFERENCES lectores ON DELETE CASCADE,
  tema         text NOT NULL REFERENCES temas,
  peso         real NOT NULL DEFAULT 0,
  ms_total     bigint NOT NULL DEFAULT 0,
  vistas       integer NOT NULL DEFAULT 0,
  actualizado  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lector, tema)
);

-- Cada micro lectura que el feed le puso a alguien, con el motivo y si la abrio.
CREATE TABLE micros (
  id       bigserial PRIMARY KEY,
  lector   uuid NOT NULL REFERENCES lectores ON DELETE CASCADE,
  lectura  text NOT NULL REFERENCES lecturas,
  motivo   text NOT NULL,
  abierta  boolean NOT NULL DEFAULT false,
  creado   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX micros_lector ON micros (lector, creado DESC);

CREATE TABLE lecturas_hechas (
  id        bigserial PRIMARY KEY,
  lector    uuid NOT NULL REFERENCES lectores ON DELETE CASCADE,
  lectura   text NOT NULL REFERENCES lecturas,
  segundos  integer NOT NULL CHECK (segundos BETWEEN 0 AND 14400),
  paginas   smallint NOT NULL CHECK (paginas BETWEEN 0 AND 200),
  terminada boolean NOT NULL,
  creado    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lecturas_hechas_lector ON lecturas_hechas (lector, creado DESC);

CREATE TABLE comentarios (
  id       bigserial PRIMARY KEY,
  lector   uuid NOT NULL REFERENCES lectores ON DELETE CASCADE,
  lectura  text NOT NULL REFERENCES lecturas,
  texto    text NOT NULL CHECK (length(texto) BETWEEN 1 AND 280),
  creado   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comentarios_lectura ON comentarios (lectura, creado DESC);

-- La encuesta de Sean Ellis. 1 muy decepcionado, 2 algo, 3 nada.
CREATE TABLE encuesta (
  lector     uuid PRIMARY KEY REFERENCES lectores ON DELETE CASCADE,
  respuesta  smallint NOT NULL CHECK (respuesta BETWEEN 1 AND 3),
  creado     timestamptz NOT NULL DEFAULT now()
);

-- Pedidos de ayuda. Van a GLPI cuando esta prendido, y si no se quedan aqui en cola.
CREATE TABLE ayuda (
  id        bigserial PRIMARY KEY,
  lector    uuid REFERENCES lectores ON DELETE SET NULL,
  correo    text,
  texto     text NOT NULL CHECK (length(texto) BETWEEN 5 AND 2000),
  estado    text NOT NULL DEFAULT 'en cola' CHECK (estado IN ('en cola', 'en glpi', 'cerrado')),
  glpi      integer,
  intentos  smallint NOT NULL DEFAULT 0,
  creado    timestamptz NOT NULL DEFAULT now()
);

-- Lo que pasa ahora mismo, para la comunidad en vivo.
CREATE TABLE actividad (
  id      bigserial PRIMARY KEY,
  lector  uuid REFERENCES lectores ON DELETE CASCADE,
  tipo    text NOT NULL,
  texto   text NOT NULL,
  creado  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX actividad_creado ON actividad (creado DESC);

-- ---------- triggers ----------

-- Al registrar una vista sube el gusto de su tema y los demas se enfrian un poco.
-- Quedarse cuenta hasta 30 segundos, cada vuelta suma, el corazon suma y saltar resta.
CREATE FUNCTION sumar_gusto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  t text;
  s real;
BEGIN
  SELECT tema INTO t FROM videos WHERE id = NEW.video;
  s := least(NEW.ms, 30000) / 3000.0
       + NEW.vueltas * 2
       + CASE WHEN NEW.gusta THEN 4 ELSE 0 END
       - CASE WHEN NEW.salto THEN 2.5 ELSE 0 END;
  INSERT INTO gustos AS g (lector, tema, peso, ms_total, vistas)
  VALUES (NEW.lector, t, greatest(s, -5), NEW.ms, 1)
  ON CONFLICT (lector, tema) DO UPDATE
    SET peso = greatest(g.peso * 0.85 + s, -5),
        ms_total = g.ms_total + NEW.ms,
        vistas = g.vistas + 1,
        actualizado = now();
  UPDATE gustos SET peso = peso * 0.97 WHERE lector = NEW.lector AND tema <> t;
  UPDATE lectores SET visto = now() WHERE id = NEW.lector;
  RETURN NEW;
END $$;
CREATE TRIGGER vistas_suman_gusto AFTER INSERT ON vistas FOR EACH ROW EXECUTE FUNCTION sumar_gusto();

-- Al terminar una lectura se suman paginas y puntos, se prende la racha y sube el nivel.
CREATE FUNCTION cerrar_lectura() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Guatemala')::date;
  hechas integer;
BEGIN
  IF NOT NEW.terminada THEN
    UPDATE lectores SET paginas = paginas + NEW.paginas, visto = now() WHERE id = NEW.lector;
    RETURN NEW;
  END IF;
  SELECT count(DISTINCT lectura) INTO hechas FROM lecturas_hechas WHERE lector = NEW.lector AND terminada;
  UPDATE lectores SET
    paginas = paginas + NEW.paginas,
    puntos = puntos + 10 + NEW.paginas * 2,
    racha = CASE WHEN ultimo_dia = hoy THEN racha
                 WHEN ultimo_dia = hoy - 1 THEN racha + 1
                 ELSE 1 END,
    mejor_racha = greatest(mejor_racha, CASE WHEN ultimo_dia = hoy THEN racha
                                             WHEN ultimo_dia = hoy - 1 THEN racha + 1
                                             ELSE 1 END),
    ultimo_dia = hoy,
    nivel = least(7, 1 + hechas / 2),
    visto = now()
  WHERE id = NEW.lector;
  RETURN NEW;
END $$;
CREATE TRIGGER lecturas_cierran AFTER INSERT ON lecturas_hechas FOR EACH ROW EXECUTE FUNCTION cerrar_lectura();

-- Abrir la micro lectura que el feed puso cuenta como gusto fuerte por su tema.
CREATE FUNCTION abrir_micro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t text;
BEGIN
  IF NEW.abierta AND NOT OLD.abierta THEN
    SELECT tema INTO t FROM lecturas WHERE id = NEW.lectura;
    INSERT INTO gustos AS g (lector, tema, peso) VALUES (NEW.lector, t, 6)
    ON CONFLICT (lector, tema) DO UPDATE SET peso = g.peso + 6, actualizado = now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER micros_abren AFTER UPDATE ON micros FOR EACH ROW EXECUTE FUNCTION abrir_micro();

-- ---------- metricas ----------

-- Por tema, cuanto se quedan, cuanto saltan y cuantas micro lecturas se abren.
CREATE MATERIALIZED VIEW resumen_temas AS
SELECT t.clave AS tema,
       t.nombre,
       count(v.id)                                            AS vistas,
       coalesce(round(avg(v.ms) / 1000.0, 1), 0)             AS segundos_promedio,
       coalesce(round(100.0 * avg(v.salto::int), 0), 0)      AS saltos_pct,
       count(*) FILTER (WHERE v.gusta)                        AS corazones,
       (SELECT count(*) FROM micros m JOIN lecturas l ON l.id = m.lectura WHERE l.tema = t.clave)                 AS micros_puestas,
       (SELECT count(*) FROM micros m JOIN lecturas l ON l.id = m.lectura WHERE l.tema = t.clave AND m.abierta)  AS micros_abiertas
FROM temas t
LEFT JOIN videos vi ON vi.tema = t.clave
LEFT JOIN vistas v ON v.video = vi.id
GROUP BY t.clave, t.nombre;
CREATE UNIQUE INDEX resumen_temas_tema ON resumen_temas (tema);

-- Por dia, quienes entran, cuantos videos ven y cuantas lecturas terminan.
CREATE MATERIALIZED VIEW metricas_dia AS
SELECT d.dia,
       (SELECT count(DISTINCT lector) FROM vistas WHERE (creado AT TIME ZONE 'America/Guatemala')::date = d.dia) AS activos,
       (SELECT count(*) FROM vistas WHERE (creado AT TIME ZONE 'America/Guatemala')::date = d.dia)                AS videos,
       (SELECT count(*) FROM micros WHERE (creado AT TIME ZONE 'America/Guatemala')::date = d.dia AND abierta)    AS micros_abiertas,
       (SELECT count(*) FROM lecturas_hechas WHERE (creado AT TIME ZONE 'America/Guatemala')::date = d.dia AND terminada) AS terminadas
FROM (SELECT generate_series((now() AT TIME ZONE 'America/Guatemala')::date - 29,
                             (now() AT TIME ZONE 'America/Guatemala')::date, interval '1 day')::date AS dia) d;
CREATE UNIQUE INDEX metricas_dia_dia ON metricas_dia (dia);

-- La meta del piloto, cuantos de cada diez vuelven en la semana. Vuelve quien uso la app
-- en dos dias distintos de los ultimos siete.
CREATE VIEW retencion_semana AS
SELECT count(*)                                 AS lectores,
       count(*) FILTER (WHERE dias >= 2)        AS vuelven,
       CASE WHEN count(*) = 0 THEN 0
            ELSE round(100.0 * count(*) FILTER (WHERE dias >= 2) / count(*), 0) END AS vuelven_pct
FROM (SELECT lector, count(DISTINCT (creado AT TIME ZONE 'America/Guatemala')::date) AS dias
      FROM vistas WHERE creado > now() - interval '7 days' GROUP BY lector) x;

CREATE VIEW resultado_ellis AS
SELECT count(*) AS respuestas,
       count(*) FILTER (WHERE respuesta = 1) AS muy,
       count(*) FILTER (WHERE respuesta = 2) AS algo,
       count(*) FILTER (WHERE respuesta = 3) AS nada,
       CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE respuesta = 1) / count(*), 0) END AS muy_pct
FROM encuesta;

CREATE VIEW ranking_semana AS
SELECT l.id, l.alias, l.racha, l.nivel,
       coalesce(sum(h.paginas), 0)::integer AS paginas,
       count(h.id) FILTER (WHERE h.terminada)::integer AS terminadas
FROM lectores l
JOIN lecturas_hechas h ON h.lector = l.id AND h.creado >= date_trunc('week', now())
WHERE l.alias IS NOT NULL
GROUP BY l.id
ORDER BY paginas DESC, terminadas DESC
LIMIT 20;

-- La app no es duena de las vistas materializadas, asi que las refresca por esta funcion.
CREATE FUNCTION refrescar_metricas() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY resumen_temas;
  REFRESH MATERIALIZED VIEW CONCURRENTLY metricas_dia;
$$;

-- ---------- permisos ----------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refrescar_metricas() FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lectortie_app;
GRANT SELECT ON temas, libros, lecturas, videos TO lectortie_app;
GRANT SELECT, INSERT, UPDATE ON lectores, gustos, enlaces, micros, encuesta, ayuda TO lectortie_app;
GRANT SELECT, INSERT, DELETE ON sesiones TO lectortie_app;
GRANT SELECT, INSERT ON vistas, lecturas_hechas, comentarios, actividad TO lectortie_app;
GRANT SELECT ON resumen_temas, metricas_dia, retencion_semana, resultado_ellis, ranking_semana TO lectortie_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO lectortie_app;
GRANT EXECUTE ON FUNCTION refrescar_metricas() TO lectortie_app;
