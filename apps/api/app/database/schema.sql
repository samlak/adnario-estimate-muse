-- Adnario Estimate. Every table but orgs carries org_id, and row-level security keeps each firm's rows to itself:
-- a connection sees only the org set in app.org ('*' is the server's own work: sign-in, seeding).
create extension if not exists pgcrypto;

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create table if not exists people (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'qs', 'contributor', 'viewer')),
  password_hash text,
  invite_token text unique,          -- set while invited; the link carries it
  invited_by uuid,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,       -- only the hash: the database alone lets nobody in
  org_id uuid not null references orgs on delete cascade,
  person_id uuid not null references people on delete cascade,
  expires_at timestamptz not null
);

create table if not exists sign_in_failures (
  email text not null,
  at timestamptz not null default now()
);

create table if not exists projects (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text not null default '',
  location text not null default '',
  description text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  org_id uuid not null references orgs on delete cascade,
  project_id uuid not null references projects on delete cascade,
  person_id uuid not null references people on delete cascade,
  access text not null default 'edit' check (access in ('edit', 'view')),
  primary key (project_id, person_id)
);

-- a model file; a new export of the same model is its next version
create table if not exists models (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  name text not null,
  version int not null default 1,
  state text not null default 'current' check (state in ('current', 'proposed', 'rejected', 'superseded', 'deleted')),
  size bigint not null default 0,
  status text not null default 'converting' check (status in ('converting', 'ready', 'failed')),
  note text,
  seconds real,
  stats jsonb not null default '{}',
  diff jsonb,
  nudge jsonb not null default '{"x": 0, "z": 0, "rotate": 0}',
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists estimates (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  revision int not null default 0,   -- 0 is Takeoff 1, then Rev A, Rev B…
  status text not null default 'new' check (status in ('new', 'running', 'ready', 'failed')),
  info jsonb not null default '{}',  -- project information given before the run
  result jsonb,                      -- the run: types, takeoff, lines, boq, review, provisional, pricing
  history jsonb not null default '[]', -- the QS's edits, for undo and redo: the run is the floor
  programme jsonb,                   -- the contractor's programme, read and linked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rate_cards (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prices_of date,
  created_at timestamptz not null default now()
);

create table if not exists rate_rows (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references rate_cards on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('MATERIAL', 'LABOUR', 'PLANT', 'RATE')),
  code text,
  section text,
  name text not null,                 -- a price's name, or a work item's description
  unit text not null default '',
  price numeric,                      -- a price row's price; a work item's typed rate (no build-up)
  lines jsonb,                        -- a work item's build-up
  additions jsonb,
  as_of date,
  note text not null default ''
);
alter table rate_cards add column if not exists removed text[] not null default '{}'; -- library codes the firm took off its card
alter table rate_rows add column if not exists labour_basis text not null default 'day'; -- its labour shown per day, or as hours per unit

create table if not exists comments (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  person_id uuid not null references people on delete cascade,
  on_kind text not null default 'project' check (on_kind in ('project', 'model', 'element', 'boq', 'question')),
  on_ref text,
  on_label text not null default 'An estimate',
  text text not null,
  file jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  org_id uuid not null references orgs on delete cascade,
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people on delete cascade,
  project_id uuid references projects on delete cascade,
  title text not null,
  text text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sidekick_chats (
  org_id uuid not null references orgs on delete cascade,
  id uuid not null,
  project_id uuid not null references projects on delete cascade,
  person_id uuid not null references people on delete cascade,
  title text not null,
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists sidekick_chats_recent_idx on sidekick_chats (org_id, person_id, project_id, updated_at desc);

do $$
declare t text;
begin
  foreach t in array array['people', 'sessions', 'projects', 'members', 'models', 'estimates', 'rate_cards', 'rate_rows',
                           'comments', 'notifications', 'sidekick_chats'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists firm on %I', t);
    execute format($p$create policy firm on %I using (current_setting('app.org', true) = '*'
                   or org_id::text = current_setting('app.org', true))$p$, t);
  end loop;
end $$;

-- every change tells the open browsers on that project to re-read (live updates)
create or replace function notify_change() returns trigger language plpgsql as $$
declare row record;
begin
  row := coalesce(new, old);
  perform pg_notify('changes', json_build_object('table', tg_table_name, 'org', row.org_id,
    'project', row.project_id)::text);
  return null;
end $$;
do $$
declare t text;
begin
  foreach t in array array['models', 'estimates', 'comments', 'members'] loop
    execute format('drop trigger if exists changed on %I', t);
    execute format('create trigger changed after insert or update or delete on %I for each row execute function notify_change()', t);
  end loop;
end $$;

-- the app's own role: no superuser, so the policies above apply to it (a superuser skips them)
do $$ begin
  if not exists (select from pg_roles where rolname = 'adnario_app') then create role adnario_app nologin; end if;
end $$;
grant usage on schema public to adnario_app;
grant select, insert, update, delete on all tables in schema public to adnario_app;
