-- La base de lectortie en Supabase. Tres tablas chicas, sin cuentas.
-- Cualquiera con la pagina puede leer y escribir, con topes de largo,
-- porque es un prototipo abierto para probar delante de un jurado.

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

alter table public.lectores enable row level security;
alter table public.comentarios enable row level security;
alter table public.sucesos enable row level security;

drop policy if exists "leer lectores" on public.lectores;
drop policy if exists "sumarse" on public.lectores;
drop policy if exists "actualizarse" on public.lectores;
create policy "leer lectores" on public.lectores for select to anon using (true);
create policy "sumarse" on public.lectores for insert to anon with check (true);
create policy "actualizarse" on public.lectores for update to anon using (true) with check (true);

drop policy if exists "leer comentarios" on public.comentarios;
drop policy if exists "comentar" on public.comentarios;
create policy "leer comentarios" on public.comentarios for select to anon using (true);
create policy "comentar" on public.comentarios for insert to anon with check (true);

drop policy if exists "leer sucesos" on public.sucesos;
drop policy if exists "contar" on public.sucesos;
create policy "leer sucesos" on public.sucesos for select to anon using (true);
create policy "contar" on public.sucesos for insert to anon with check (true);

grant select, insert, update on public.lectores to anon;
grant select, insert on public.comentarios, public.sucesos to anon;

-- tiempo real para que los avisos lleguen a todos los telefonos
do $$ begin
  begin alter publication supabase_realtime add table public.sucesos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comentarios; exception when duplicate_object then null; end;
end $$;

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

-- quien tiene cuenta tambien aparece en el ranking y comenta
grant select, insert, update on public.lectores to authenticated;
grant select, insert on public.comentarios, public.sucesos to authenticated;
drop policy if exists "leer lectores c" on public.lectores;
drop policy if exists "sumarse c" on public.lectores;
drop policy if exists "actualizarse c" on public.lectores;
create policy "leer lectores c" on public.lectores for select to authenticated using (true);
create policy "sumarse c" on public.lectores for insert to authenticated with check (true);
create policy "actualizarse c" on public.lectores for update to authenticated using (true) with check (true);
drop policy if exists "leer comentarios c" on public.comentarios;
drop policy if exists "comentar c" on public.comentarios;
create policy "leer comentarios c" on public.comentarios for select to authenticated using (true);
create policy "comentar c" on public.comentarios for insert to authenticated with check (true);
drop policy if exists "leer sucesos c" on public.sucesos;
drop policy if exists "contar c" on public.sucesos;
create policy "leer sucesos c" on public.sucesos for select to authenticated using (true);
create policy "contar c" on public.sucesos for insert to authenticated with check (true);
