
create extension if not exists pgcrypto;

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null,
  region text,
  created_at timestamptz default now(),
  unique(name, level)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  normalized_name text not null unique,
  provider text,
  provider_player_id text,
  created_at timestamptz default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id),
  player_a_id uuid not null references public.players(id),
  player_b_id uuid not null references public.players(id),
  scheduled_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','completed','cancelled','postponed')),
  winner_id uuid references public.players(id),
  score_a smallint,
  score_b smallint,
  source_provider text,
  source_match_id text,
  source_url text,
  source_updated_at timestamptz,
  imported_at timestamptz default now(),
  data_verified boolean default false,
  created_at timestamptz default now(),
  check (player_a_id <> player_b_id),
  unique(source_provider, source_match_id)
);

create table public.match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_number smallint not null,
  points_a smallint not null,
  points_b smallint not null,
  unique(match_id, set_number)
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  model_version text not null,
  predicted_winner_id uuid references public.players(id),
  estimated_win_probability numeric(5,4),
  confidence_rating smallint
    check (confidence_rating between 0 and 100),
  rationale jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  settled_at timestamptz,
  outcome_correct boolean,
  unique(match_id, model_version)
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text default 'started',
  records_seen integer default 0,
  records_imported integer default 0,
  error_summary text
);

create index matches_scheduled_at_idx
  on public.matches(scheduled_at);

create index matches_competition_idx
  on public.matches(competition_id);

create index predictions_created_idx
  on public.predictions(created_at desc);

alter table public.competitions enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_sets enable row level security;
alter table public.predictions enable row level security;
alter table public.import_runs enable row level security;

create policy "authenticated read competitions"
on public.competitions for select to authenticated using (true);

create policy "authenticated read players"
on public.players for select to authenticated using (true);

create policy "authenticated read matches"
on public.matches for select to authenticated using (true);

create policy "authenticated read match sets"
on public.match_sets for select to authenticated using (true);

create policy "authenticated read predictions"
on public.predictions for select to authenticated using (true);

create policy "authenticated read import runs"
on public.import_runs for select to authenticated using (true);
