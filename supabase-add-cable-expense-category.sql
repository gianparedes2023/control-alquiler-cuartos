alter table public.expenses
drop constraint if exists expenses_category_check;

alter table public.expenses
add constraint expenses_category_check
check (category in ('Luz', 'Agua', 'Limpieza', 'Internet', 'Cable', 'Otro'));
