-- La base de lectortie en Supabase. Tres tablas chicas que se comparten entre
-- todos los telefonos (lectores, comentarios y sucesos) y una de perfiles para
-- la cuenta opcional.
--
-- Leer, cualquiera con la pagina. Escribir, nadie directo en las tablas. Todo
-- pasa por tres funciones, soy, contar y comentar, que revisan las palabras,
-- frenan a quien manda demasiado y no dejan tocar la fila de otro.
--
-- Se puede correr entero las veces que haga falta, no borra datos.

create table if not exists public.lectores (
  id uuid primary key,
  alias text not null check (char_length(alias) between 1 and 18),
  color text check (char_length(color) <= 9),
  semana date not null,
  paginas int not null default 0 check (paginas between 0 and 20000),
  racha int not null default 0 check (racha between 0 and 3650),
  libro text check (char_length(libro) <= 40),
  actualizado timestamptz not null default now()
);

create table if not exists public.comentarios (
  id bigint generated always as identity primary key,
  quien uuid,
  libro text not null check (char_length(libro) <= 40),
  alias text not null check (char_length(alias) between 1 and 18),
  color text check (char_length(color) <= 9),
  texto text not null check (char_length(texto) between 1 and 140),
  creado timestamptz not null default now()
);
create index if not exists comentarios_libro on public.comentarios (libro, creado);
create index if not exists comentarios_quien on public.comentarios (quien, creado);

create table if not exists public.sucesos (
  id bigint generated always as identity primary key,
  quien uuid,
  alias text not null check (char_length(alias) between 1 and 18),
  color text check (char_length(color) <= 9),
  texto text not null check (char_length(texto) between 1 and 120),
  libro text check (char_length(libro) <= 40),
  creado timestamptz not null default now()
);
create index if not exists sucesos_creado on public.sucesos (creado desc);
create index if not exists sucesos_quien on public.sucesos (quien, creado);

-- La clave de cada telefono, para que nadie mas pueda cambiar su fila del
-- ranking. Se guarda en md5 y la pagina no la puede leer: tiene RLS y ninguna
-- regla, asi que solo la ven las funciones de abajo.
create table if not exists public.llaves (
  id uuid primary key,
  clave text not null,
  creada timestamptz not null default now()
);
alter table public.llaves enable row level security;
revoke all on public.llaves from anon, authenticated;

alter table public.lectores enable row level security;
alter table public.comentarios enable row level security;
alter table public.sucesos enable row level security;

-- Leer, si. Las reglas viejas de escribir se quitan.
drop policy if exists "leer lectores" on public.lectores;
drop policy if exists "sumarse" on public.lectores;
drop policy if exists "actualizarse" on public.lectores;
drop policy if exists "leer lectores c" on public.lectores;
drop policy if exists "sumarse c" on public.lectores;
drop policy if exists "actualizarse c" on public.lectores;
create policy "leer lectores" on public.lectores for select to anon, authenticated using (true);

drop policy if exists "leer comentarios" on public.comentarios;
drop policy if exists "comentar" on public.comentarios;
drop policy if exists "leer comentarios c" on public.comentarios;
drop policy if exists "comentar c" on public.comentarios;
create policy "leer comentarios" on public.comentarios for select to anon, authenticated using (true);

drop policy if exists "leer sucesos" on public.sucesos;
drop policy if exists "contar" on public.sucesos;
drop policy if exists "leer sucesos c" on public.sucesos;
drop policy if exists "contar c" on public.sucesos;
create policy "leer sucesos" on public.sucesos for select to anon, authenticated using (true);

revoke insert, update, delete on public.lectores, public.comentarios, public.sucesos from anon, authenticated;
grant select on public.lectores, public.comentarios, public.sucesos to anon, authenticated;

-- tiempo real para que los avisos lleguen a todos los telefonos
do $$ begin
  begin alter publication supabase_realtime add table public.sucesos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comentarios; exception when duplicate_object then null; end;
end $$;

-- Las palabras que no entran. La misma lista vive en js/red.js (limpio); si
-- se cambia aqui, hay que cambiarla alla. Antes de mirar se pasa a minusculas,
-- se quitan las tildes y los numeros que se usan como letras.
create or replace function public.limpio(t text) returns boolean
language sql immutable set search_path = public as $$
  select translate(lower(coalesce(t, '')), 'áéíóúü013457@$', 'aeiouuoieastas')
    !~ '(^|[^a-zñ])(put[ao]|mierd|verga|pendej|cerot|culer|hijueput|hijodeput|malparid|chingad|chingar|mamad|maric|imbecil|estupid|cabron|follar|porno|nazi|hitler|idiota|zorra|cagad|jodid|coño|sexo|vrg|culos?([^a-zñ]|$)|pija([^a-zñ]|$)|hdp([^a-zñ]|$)|ptm([^a-zñ]|$)|penes?([^a-zñ]|$)|jotos?([^a-zñ]|$))';
$$;

create or replace function public.color_ok(c text) returns text
language sql immutable as $$
  select case when c ~ '^#[0-9A-Fa-f]{3,8}$' then c else null end;
$$;

-- Lo propio en el ranking. La primera vez que un telefono escribe deja su
-- clave; de ahi en adelante solo esa clave cambia la fila. Quien tiene cuenta
-- entra con su sesion y no necesita clave, y nadie puede tomar el id de una
-- cuenta sin entrar a ella.
create or replace function public.soy(p_id uuid, p_clave text, p_alias text, p_color text,
  p_paginas int, p_racha int, p_libro text) returns boolean
language plpgsql security definer set search_path = public as $$
declare guardada text;
begin
  if p_id is null or p_alias is null or char_length(trim(p_alias)) = 0 then return false; end if;
  if not limpio(p_alias) then return false; end if;
  if auth.uid() is distinct from p_id then
    if exists (select 1 from auth.users where id = p_id) then return false; end if;
    if char_length(coalesce(p_clave, '')) < 20 then return false; end if;
    insert into llaves (id, clave) values (p_id, md5(p_clave)) on conflict (id) do nothing;
    select clave into guardada from llaves where id = p_id;
    if guardada is distinct from md5(p_clave) then return false; end if;
  end if;
  insert into lectores (id, alias, color, semana, paginas, racha, libro, actualizado)
  values (p_id, left(trim(p_alias), 18), color_ok(p_color),
          date_trunc('week', now() at time zone 'America/Guatemala')::date,
          least(greatest(coalesce(p_paginas, 0), 0), 3000), least(greatest(coalesce(p_racha, 0), 0), 3650),
          left(p_libro, 40), now())
  on conflict (id) do update set alias = excluded.alias, color = excluded.color, semana = excluded.semana,
    paginas = excluded.paginas, racha = excluded.racha, libro = excluded.libro, actualizado = now();
  return true;
end $$;

-- Lo que va pasando. Solo entran los textos que arma la app, sin palabras
-- feas, y no mas de doce por minuto por telefono ni sesenta entre todos.
create or replace function public.contar(p_quien uuid, p_alias text, p_color text, p_texto text, p_libro text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_alias is null or char_length(trim(p_alias)) = 0 or p_texto is null then return false; end if;
  if not limpio(p_alias) or not limpio(p_texto) then return false; end if;
  if p_texto !~ '^(empezó|leyó [0-9]+ páginas? de|terminó|prendió su racha con|ganó la medalla|comentó en|se unió al club|llegó a lectortie y empieza con) ' then return false; end if;
  if (select count(*) from sucesos where quien = p_quien and creado > now() - interval '1 minute') >= 12 then return false; end if;
  if (select count(*) from sucesos where creado > now() - interval '1 minute') >= 60 then return false; end if;
  insert into sucesos (quien, alias, color, texto, libro)
  values (p_quien, left(trim(p_alias), 18), color_ok(p_color), left(p_texto, 120), left(p_libro, 40));
  return true;
end $$;

-- Los comentarios. Sin palabras feas ni enlaces, tres por minuto y veinte por
-- hora por telefono, y treinta por minuto entre todos.
create or replace function public.comentar(p_quien uuid, p_libro text, p_alias text, p_color text, p_texto text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_libro is null or p_alias is null or char_length(trim(p_alias)) = 0 then return false; end if;
  if p_texto is null or char_length(trim(p_texto)) = 0 then return false; end if;
  if not limpio(p_alias) or not limpio(p_texto) then return false; end if;
  if lower(p_texto) ~ '(https?:|www[.]|[.](com|net|org|gt|ly|io|me)([^a-z]|$))' then return false; end if;
  if (select count(*) from comentarios where quien = p_quien and creado > now() - interval '1 minute') >= 3 then return false; end if;
  if (select count(*) from comentarios where quien = p_quien and creado > now() - interval '1 hour') >= 20 then return false; end if;
  if (select count(*) from comentarios where creado > now() - interval '1 minute') >= 30 then return false; end if;
  insert into comentarios (quien, libro, alias, color, texto)
  values (p_quien, left(p_libro, 40), left(trim(p_alias), 18), color_ok(p_color), left(trim(p_texto), 140));
  return true;
end $$;

revoke all on function public.soy(uuid, text, text, text, int, int, text) from public;
revoke all on function public.contar(uuid, text, text, text, text) from public;
revoke all on function public.comentar(uuid, text, text, text, text) from public;
grant execute on function public.soy(uuid, text, text, text, int, int, text) to anon, authenticated;
grant execute on function public.contar(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.comentar(uuid, text, text, text, text) to anon, authenticated;

-- La cuenta opcional. Cada quien lee y escribe solo su propio avance.
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  alias text check (char_length(alias) <= 18),
  datos jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);
alter table public.perfiles enable row level security;
drop policy if exists "mi perfil leer" on public.perfiles;
drop policy if exists "mi perfil crear" on public.perfiles;
drop policy if exists "mi perfil cambiar" on public.perfiles;
create policy "mi perfil leer" on public.perfiles for select to authenticated using (auth.uid() = id);
create policy "mi perfil crear" on public.perfiles for insert to authenticated with check (auth.uid() = id);
create policy "mi perfil cambiar" on public.perfiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
grant select, insert, update on public.perfiles to authenticated;
