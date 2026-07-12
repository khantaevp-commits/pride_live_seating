-- 1. Таблица рассадки
create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  table_number integer not null check (table_number between 1 and 6),
  seat_number integer not null check (seat_number between 1 and 10),
  created_at timestamptz default now(),
  unique(table_number, seat_number)
);

-- 2. Включаем защиту
alter table public.seats enable row level security;

-- 3. Политики доступа
-- ВАЖНО: эти политики разрешают доступ любому авторизованному пользователю Supabase.
-- Поэтому создавай аккаунты только администраторам.
drop policy if exists "Authenticated users can read seats" on public.seats;
create policy "Authenticated users can read seats"
on public.seats for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert seats" on public.seats;
create policy "Authenticated users can insert seats"
on public.seats for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can delete seats" on public.seats;
create policy "Authenticated users can delete seats"
on public.seats for delete
to authenticated
using (true);
