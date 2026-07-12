create table if not exists public.tournament_settings (
  id integer primary key default 1 check (id = 1),
  active_tables integer not null default 6 check (active_tables between 1 and 6),
  player_limit integer not null default 60 check (player_limit between 1 and 60),
  updated_at timestamptz not null default now()
);

insert into public.tournament_settings (id, active_tables, player_limit)
values (1, 6, 60)
on conflict (id) do nothing;

alter table public.tournament_settings enable row level security;

drop policy if exists "Authenticated users can read tournament settings" on public.tournament_settings;
create policy "Authenticated users can read tournament settings"
on public.tournament_settings for select
to authenticated
using (true);

drop policy if exists "Authenticated users can update tournament settings" on public.tournament_settings;
create policy "Authenticated users can update tournament settings"
on public.tournament_settings for update
to authenticated
using (true)
with check (true);
