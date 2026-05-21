create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null check (category in ('Luz', 'Agua', 'Limpieza', 'Internet', 'Cable', 'Prestamo', 'Otro')),
  amount numeric(12,2) not null default 0,
  vendor text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

drop policy if exists "expenses_select_active" on public.expenses;
drop policy if exists "expenses_write_admin_operator" on public.expenses;

create policy "expenses_select_active"
on public.expenses for select
to authenticated
using (public.is_active_user());

create policy "expenses_write_admin_operator"
on public.expenses for all
to authenticated
using (public.current_user_role() in ('admin', 'operator'))
with check (public.current_user_role() in ('admin', 'operator'));
