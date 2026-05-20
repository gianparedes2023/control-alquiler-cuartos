create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'operator' check (role in ('admin', 'operator', 'viewer')),
  active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tenant text,
  phone text,
  rent numeric(12,2) not null default 0,
  due_day integer not null default 5 check (due_day between 1 and 31),
  status text not null default 'occupied' check (status in ('occupied', 'available')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  date date not null,
  amount numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'operator',
    true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles
  where id = auth.uid() and active = true;
$$;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles_select_active" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "rooms_select_active" on public.rooms;
drop policy if exists "rooms_write_admin_operator" on public.rooms;
drop policy if exists "payments_select_active" on public.payments;
drop policy if exists "payments_write_admin_operator" on public.payments;

create policy "profiles_select_active"
on public.profiles for select
to authenticated
using (public.is_active_user() and (id = auth.uid() or public.current_user_role() = 'admin'));

create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "rooms_select_active"
on public.rooms for select
to authenticated
using (public.is_active_user());

create policy "rooms_write_admin_operator"
on public.rooms for all
to authenticated
using (public.current_user_role() in ('admin', 'operator'))
with check (public.current_user_role() in ('admin', 'operator'));

create policy "payments_select_active"
on public.payments for select
to authenticated
using (public.is_active_user());

create policy "payments_write_admin_operator"
on public.payments for all
to authenticated
using (public.current_user_role() in ('admin', 'operator'))
with check (public.current_user_role() in ('admin', 'operator'));
