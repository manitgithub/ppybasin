begin;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text not null,
  picture_url text,
  email text,
  role text not null default 'viewer',
  status text not null default 'active',
  permissions jsonb not null default '[]'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_role_allowed
    check (role in ('admin', 'operator', 'viewer')),
  constraint app_users_status_allowed
    check (status in ('active', 'disabled'))
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  session_token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists app_users_role_idx
  on public.app_users (role);

create index if not exists app_users_status_idx
  on public.app_users (status);

create index if not exists auth_sessions_user_id_idx
  on public.auth_sessions (user_id);

create index if not exists auth_sessions_expires_at_idx
  on public.auth_sessions (expires_at);

comment on table public.app_users is 'Application users provisioned from LINE Login.';
comment on table public.auth_sessions is 'Server-side login sessions keyed by hashed secure cookie tokens.';

commit;
