-- ===========================================================================
--  VOYAGO - esquema de base de datos
--  Ejecutar completo en el SQL Editor de Supabase (una sola vez).
--  Idempotente: se puede volver a ejecutar sin romper nada.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type trip_role         as enum ('owner', 'member');
  create type invitation_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
  create type trip_place_status as enum ('wishlist', 'visited');
  create type expense_category  as enum (
    'food','accommodation','transport','tickets','shopping','coffee','gifts','fun','other'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- PROFILES  (extiende auth.users)
--   identificador publico = name#unique_code  (ej. Will#4821)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 2 and 32),
  username     text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  unique_code  text not null check (unique_code ~ '^[0-9]{4}$'),
  email        text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Garantiza que la combinacion Nombre#Codigo sea unica (case-insensitive).
create unique index if not exists profiles_handle_unique
  on public.profiles (lower(name), unique_code);

-- Busqueda por nombre
create index if not exists profiles_name_idx on public.profiles (lower(name));

-- ---------------------------------------------------------------------------
-- TRIPS
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 2 and 80),
  destination   text not null,
  country_code  text,
  start_date    date not null,
  end_date      date not null,
  cover_image   text,
  base_currency text not null default 'EUR' check (base_currency ~ '^[A-Z]{3}$'),
  created_at    timestamptz not null default now(),
  constraint trips_dates_valid check (end_date >= start_date)
);
create index if not exists trips_owner_idx on public.trips (owner_id);

-- ---------------------------------------------------------------------------
-- TRIP MEMBERS
-- ---------------------------------------------------------------------------
create table if not exists public.trip_members (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      trip_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index if not exists trip_members_user_idx on public.trip_members (user_id);

-- ---------------------------------------------------------------------------
-- TRIP INVITATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.trip_invitations (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  receiver_id  uuid not null references public.profiles(id) on delete cascade,
  status       invitation_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint invitation_not_self check (sender_id <> receiver_id)
);
-- Una sola invitacion pendiente por (viaje, receptor)
create unique index if not exists trip_invitations_pending_unique
  on public.trip_invitations (trip_id, receiver_id) where status = 'pending';
create index if not exists trip_invitations_receiver_idx
  on public.trip_invitations (receiver_id, status);

-- ---------------------------------------------------------------------------
-- PLACES  (catalogo global de lugares reales, compartido entre viajes)
-- ---------------------------------------------------------------------------
create table if not exists public.places (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'photon',
  external_place_id text,
  name              text not null,
  address           text,
  city              text,
  country           text,
  country_code      text,
  latitude          double precision not null,
  longitude         double precision not null,
  category          text,
  image             text,
  created_at        timestamptz not null default now()
);
create unique index if not exists places_external_unique
  on public.places (provider, external_place_id) where external_place_id is not null;
create index if not exists places_latlng_idx on public.places (latitude, longitude);

-- ---------------------------------------------------------------------------
-- TRIP PLACES  (informacion del lugar DENTRO de un viaje concreto)
-- ---------------------------------------------------------------------------
create table if not exists public.trip_places (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  place_id   uuid not null references public.places(id) on delete restrict,
  status     trip_place_status not null default 'wishlist',
  notes      text,
  rating     smallint check (rating between 1 and 5),
  visited_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, place_id)
);
create index if not exists trip_places_trip_idx on public.trip_places (trip_id);

-- ---------------------------------------------------------------------------
-- EXPENSES
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  created_by       uuid references public.profiles(id) on delete set null,
  paid_by          uuid not null references public.profiles(id) on delete restrict,
  amount           numeric(14,2) not null check (amount > 0),
  currency         text not null check (currency ~ '^[A-Z]{3}$'),
  converted_amount numeric(14,2),          -- importe en la moneda base del viaje
  exchange_rate    numeric(18,8),          -- tasa aplicada en el momento del alta
  description      text not null,
  category         expense_category not null default 'other',
  trip_place_id    uuid references public.trip_places(id) on delete set null,
  photo_id         uuid,                   -- FK anadida despues (dependencia circular)
  date             date not null,
  created_at       timestamptz not null default now()
);
create index if not exists expenses_trip_date_idx on public.expenses (trip_id, date desc);
create index if not exists expenses_trip_place_idx on public.expenses (trip_place_id);

-- ---------------------------------------------------------------------------
-- PHOTOS
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  storage_path  text not null,
  thumb_path    text,
  width         int,
  height        int,
  description   text,
  trip_place_id uuid references public.trip_places(id) on delete set null,
  -- Ubicacion EXACTA del recuerdo. Es independiente del trip_place: una foto
  -- puede estar geolocalizada sin pertenecer a ningun lugar del itinerario.
  latitude      double precision,
  longitude     double precision,
  location_name text,                    -- "Omoide Yokocho" (libre, opcional)
  place_id      uuid references public.places(id) on delete set null,
  featured      boolean not null default false,
  -- Una Photo es un recurso compartido: puede alimentar la galeria, momentos y
  -- gastos a la vez. `in_gallery` decide solo si se muestra en la Galeria; el
  -- archivo y la fila son los mismos en todos los casos.
  in_gallery    boolean not null default true,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);
-- Aditivo para bases ya desplegadas (el create table de arriba es no-op ahi).
alter table public.photos add column if not exists in_gallery boolean not null default true;
alter table public.photos add column if not exists location_name text;
alter table public.photos add column if not exists place_id uuid references public.places(id) on delete set null;
create index if not exists photos_trip_idx on public.photos (trip_id, created_at desc);
create index if not exists photos_trip_place_idx on public.photos (trip_place_id);
create index if not exists photos_gallery_idx
  on public.photos (trip_id, created_at desc) where in_gallery;
-- Mapa de recuerdos: fotos del viaje que tienen coordenadas propias.
create index if not exists photos_located_idx
  on public.photos (trip_id) where latitude is not null and longitude is not null;

alter table public.expenses drop constraint if exists expenses_photo_fk;
alter table public.expenses
  add constraint expenses_photo_fk
  foreign key (photo_id) references public.photos(id) on delete set null;

-- ---------------------------------------------------------------------------
-- ITINERARY
-- ---------------------------------------------------------------------------
create table if not exists public.itinerary_items (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  trip_place_id uuid references public.trip_places(id) on delete set null,
  title         text not null,
  description   text,
  date          date not null,
  start_time    time,
  end_time      time,
  icon          text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists itinerary_trip_date_idx
  on public.itinerary_items (trip_id, date, start_time);

-- ---------------------------------------------------------------------------
-- MOMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.moments (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,
  title         text not null,
  description   text,
  trip_place_id uuid references public.trip_places(id) on delete set null,
  -- Igual que en photos: donde ocurrio exactamente, sin depender del itinerario.
  latitude      double precision,
  longitude     double precision,
  location_name text,
  place_id      uuid references public.places(id) on delete set null,
  date          date not null,
  rating        smallint check (rating between 1 and 5),
  created_at    timestamptz not null default now()
);
-- Aditivo para bases ya desplegadas.
alter table public.moments add column if not exists latitude double precision;
alter table public.moments add column if not exists longitude double precision;
alter table public.moments add column if not exists location_name text;
alter table public.moments add column if not exists place_id uuid references public.places(id) on delete set null;
create index if not exists moments_trip_idx on public.moments (trip_id, date desc);
create index if not exists moments_located_idx
  on public.moments (trip_id) where latitude is not null and longitude is not null;

create table if not exists public.moment_photos (
  moment_id uuid not null references public.moments(id) on delete cascade,
  photo_id  uuid not null references public.photos(id) on delete cascade,
  primary key (moment_id, photo_id)
);

-- ---------------------------------------------------------------------------
-- JOURNAL / CHECKLIST
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  date       date not null,
  title      text,
  content    text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  title      text not null,
  completed  boolean not null default false,
  position   int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists checklist_trip_idx on public.checklist_items (trip_id, position);

-- ===========================================================================
--  FUNCIONES
-- ===========================================================================

-- Genera un codigo de 4 digitos libre para un nombre dado (Nombre#Codigo unico)
create or replace function public.generate_unique_code(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_try  int := 0;
begin
  loop
    v_code := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (
      select 1 from public.profiles
      where lower(name) = lower(p_name) and unique_code = v_code
    );
    v_try := v_try + 1;
    if v_try > 200 then
      raise exception 'No se pudo generar un codigo unico para el nombre %', p_name;
    end if;
  end loop;
  return v_code;
end;
$$;

-- Crea el perfil automaticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_username text;
  v_base     text;
  v_suffix   int := 0;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                     split_part(new.email, '@', 1));
  v_name := left(v_name, 32);

  v_base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', v_name),
                                 '[^a-zA-Z0-9_.]', '', 'g'));
  v_base := left(coalesce(nullif(v_base, ''), 'user'), 20);
  if char_length(v_base) < 3 then v_base := v_base || 'usr'; end if;

  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix   := v_suffix + 1;
    v_username := left(v_base, 20) || v_suffix::text;
  end loop;

  insert into public.profiles (id, name, username, unique_code, email, avatar_url)
  values (new.id, v_name, v_username, public.generate_unique_code(v_name),
          new.email, new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de autorizacion (SECURITY DEFINER para evitar recursion en RLS)
create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid() and role = 'owner'
  );
$$;

-- El creador entra automaticamente como owner
create or replace function public.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_trip_created on public.trips;
create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.handle_new_trip();

-- Busqueda publica por Nombre#Codigo (expone solo campos publicos)
create or replace function public.find_profile_by_handle(p_name text, p_code text)
returns table (id uuid, name text, username text, unique_code text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.name, p.username, p.unique_code, p.avatar_url
  from public.profiles p
  where lower(p.name) = lower(trim(p_name)) and p.unique_code = trim(p_code)
  limit 1;
$$;

-- Aceptar / rechazar invitacion de forma atomica y segura
create or replace function public.respond_to_invitation(p_invitation uuid, p_accept boolean)
returns public.trip_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.trip_invitations;
begin
  select * into v_inv from public.trip_invitations where id = p_invitation for update;

  if v_inv.id is null then
    raise exception 'Invitacion no encontrada';
  end if;
  if v_inv.receiver_id <> auth.uid() then
    raise exception 'No autorizado';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'La invitacion ya fue respondida';
  end if;

  update public.trip_invitations
     set status = case when p_accept then 'accepted'::invitation_status
                       else 'rejected'::invitation_status end,
         responded_at = now()
   where id = p_invitation
   returning * into v_inv;

  if p_accept then
    insert into public.trip_members (trip_id, user_id, role)
    values (v_inv.trip_id, v_inv.receiver_id, 'member')
    on conflict (trip_id, user_id) do nothing;
  end if;

  return v_inv;
end;
$$;

-- Alta idempotente de un lugar real del proveedor externo
create or replace function public.upsert_place(
  p_provider text, p_external_id text, p_name text, p_address text,
  p_city text, p_country text, p_country_code text,
  p_lat double precision, p_lng double precision,
  p_category text, p_image text
)
returns public.places
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place public.places;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  if p_external_id is not null then
    select * into v_place from public.places
     where provider = p_provider and external_place_id = p_external_id;
    if v_place.id is not null then
      return v_place;
    end if;
  end if;

  insert into public.places (provider, external_place_id, name, address, city,
                             country, country_code, latitude, longitude, category, image)
  values (p_provider, p_external_id, p_name, p_address, p_city,
          p_country, p_country_code, p_lat, p_lng, p_category, p_image)
  returning * into v_place;

  return v_place;
end;
$$;

-- ===========================================================================
--  ROW LEVEL SECURITY
--  Regla general: solo los miembros de un viaje ven/editan sus datos.
-- ===========================================================================
alter table public.profiles         enable row level security;
alter table public.trips            enable row level security;
alter table public.trip_members     enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.places           enable row level security;
alter table public.trip_places      enable row level security;
alter table public.expenses         enable row level security;
alter table public.photos           enable row level security;
alter table public.itinerary_items  enable row level security;
alter table public.moments          enable row level security;
alter table public.moment_photos    enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.checklist_items  enable row level security;

-- --- PROFILES -------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
        from public.trip_members m1
        join public.trip_members m2 on m1.trip_id = m2.trip_id
       where m1.user_id = auth.uid() and m2.user_id = public.profiles.id
    )
    or exists (
      select 1 from public.trip_invitations i
       where (i.sender_id = auth.uid()   and i.receiver_id = public.profiles.id)
          or (i.receiver_id = auth.uid() and i.sender_id   = public.profiles.id)
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- --- TRIPS ----------------------------------------------------------------
-- El `owner_id = auth.uid()` no es redundante con is_trip_member: en el INSERT con
-- RETURNING, Postgres evalua esta politica SELECT antes de que el trigger
-- on_trip_created haya creado la fila de trip_members. Sin esta rama, crear un
-- viaje siempre falla con 42501.
drop policy if exists trips_select_member on public.trips;
create policy trips_select_member on public.trips
  for select using (owner_id = auth.uid() or public.is_trip_member(id));

drop policy if exists trips_insert_own on public.trips;
create policy trips_insert_own on public.trips
  for insert with check (owner_id = auth.uid());

drop policy if exists trips_update_owner on public.trips;
create policy trips_update_owner on public.trips
  for update using (public.is_trip_owner(id)) with check (public.is_trip_owner(id));

drop policy if exists trips_delete_owner on public.trips;
create policy trips_delete_owner on public.trips
  for delete using (owner_id = auth.uid());

-- --- TRIP MEMBERS ---------------------------------------------------------
drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members
  for select using (user_id = auth.uid() or public.is_trip_member(trip_id));

drop policy if exists trip_members_delete on public.trip_members;
create policy trip_members_delete on public.trip_members
  for delete using (
    (public.is_trip_owner(trip_id) and role <> 'owner')
    or (user_id = auth.uid() and role <> 'owner')   -- abandonar el viaje
  );

-- --- INVITATIONS ----------------------------------------------------------
drop policy if exists invitations_select on public.trip_invitations;
create policy invitations_select on public.trip_invitations
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists invitations_insert on public.trip_invitations;
create policy invitations_insert on public.trip_invitations
  for insert with check (
    sender_id = auth.uid()
    and public.is_trip_member(trip_id)
    and not exists (
      select 1 from public.trip_members m
       where m.trip_id = trip_invitations.trip_id and m.user_id = trip_invitations.receiver_id
    )
  );

drop policy if exists invitations_cancel on public.trip_invitations;
create policy invitations_cancel on public.trip_invitations
  for update using (sender_id = auth.uid() and status = 'pending')
  with check (sender_id = auth.uid() and status = 'cancelled');

-- --- PLACES (catalogo global) ---------------------------------------------
drop policy if exists places_select_auth on public.places;
create policy places_select_auth on public.places
  for select using (auth.uid() is not null);

-- Las altas se hacen mediante public.upsert_place() (SECURITY DEFINER).

-- --- Politicas de miembro para el resto de tablas del viaje ---------------
do $$
declare
  t text;
begin
  foreach t in array array['trip_places','expenses','photos','itinerary_items',
                           'moments','journal_entries','checklist_items']
  loop
    execute format('drop policy if exists %I_member_all on public.%I', t, t);
    execute format($p$
      create policy %I_member_all on public.%I
        for all
        using (public.is_trip_member(trip_id))
        with check (public.is_trip_member(trip_id))
    $p$, t, t);
  end loop;
end $$;

drop policy if exists moment_photos_member_all on public.moment_photos;
create policy moment_photos_member_all on public.moment_photos
  for all
  using (exists (select 1 from public.moments m
                  where m.id = moment_id and public.is_trip_member(m.trip_id)))
  with check (exists (select 1 from public.moments m
                       where m.id = moment_id and public.is_trip_member(m.trip_id)));

-- ===========================================================================
--  STORAGE
--  Bucket privado. Las rutas siguen el patron:  <tripId>/<uuid>.<ext>
--  Se sirve mediante URLs firmadas de corta duracion.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-media', 'trip-media', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/avif','image/heic'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Extrae el tripId de una ruta de storage (`<tripId>/...`) sin fallar si la
-- carpeta no es un UUID valido.
create or replace function public.storage_trip_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(p_name))[1])::uuid
    else null
  end;
$$;

drop policy if exists trip_media_read on storage.objects;
create policy trip_media_read on storage.objects
  for select using (
    bucket_id = 'trip-media'
    and public.is_trip_member(public.storage_trip_id(name))
  );

drop policy if exists trip_media_write on storage.objects;
create policy trip_media_write on storage.objects
  for insert with check (
    bucket_id = 'trip-media'
    and public.is_trip_member(public.storage_trip_id(name))
  );

drop policy if exists trip_media_delete on storage.objects;
create policy trip_media_delete on storage.objects
  for delete using (
    bucket_id = 'trip-media'
    and public.is_trip_member(public.storage_trip_id(name))
  );

-- ===========================================================================
--  REALTIME
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array['trips','trip_members','trip_invitations','trip_places',
                           'expenses','photos','itinerary_items','moments',
                           'checklist_items','journal_entries']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
