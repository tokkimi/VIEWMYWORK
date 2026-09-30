create extension if not exists pgcrypto;

create table if not exists client_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  provider text not null check (provider in ('google_drive')),
  encrypted_refresh_token text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, provider)
);

create table if not exists shared_folders (
  id uuid primary key default gen_random_uuid(),
  client_space_id uuid not null references client_spaces(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade,
  provider_folder_id text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (client_space_id, provider_folder_id)
);

create table if not exists client_invites (
  id uuid primary key default gen_random_uuid(),
  client_space_id uuid not null references client_spaces(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
