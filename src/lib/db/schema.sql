-- Evolvo Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table
create table if not exists public.users (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  name text,
  image text,
  stripe_customer_id text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Subscriptions table
create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  tier text not null default 'free' check (tier in ('free', 'pro', 'enterprise')),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Usage tracking table
create table if not exists public.usage (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  month text not null, -- Format: "2024-12"
  ai_requests integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, month)
);

-- Projects table
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  thumbnail text, -- URL to project thumbnail/screenshot
  framework text default 'react-vite', -- Framework template ID (react-vite, nextjs, vue-vite, etc.)
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  last_opened_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sessions table for NextAuth
create table if not exists public.sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  session_token text unique not null,
  expires timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Accounts table for NextAuth OAuth providers
create table if not exists public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null,
  provider text not null,
  provider_account_id text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(provider, provider_account_id)
);

-- Verification tokens for NextAuth email verification
create table if not exists public.verification_tokens (
  identifier text not null,
  token text unique not null,
  expires timestamp with time zone not null,
  primary key (identifier, token)
);

-- Create indexes for better performance
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_subscription_id on public.subscriptions(stripe_subscription_id);
create index if not exists idx_usage_user_month on public.usage(user_id, month);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_token on public.sessions(session_token);
create index if not exists idx_accounts_user_id on public.accounts(user_id);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage enable row level security;
alter table public.sessions enable row level security;
alter table public.accounts enable row level security;

-- RLS Policies for users
create policy "Users can view own profile" on public.users
  for select using (auth.uid()::text = id::text);
  
create policy "Users can update own profile" on public.users
  for update using (auth.uid()::text = id::text);

-- RLS Policies for subscriptions
create policy "Users can view own subscription" on public.subscriptions
  for select using (auth.uid()::text = user_id::text);

-- RLS Policies for usage
create policy "Users can view own usage" on public.usage
  for select using (auth.uid()::text = user_id::text);

-- Service role can do everything (for webhooks)
create policy "Service role full access users" on public.users
  for all using (auth.role() = 'service_role');
  
create policy "Service role full access subscriptions" on public.subscriptions
  for all using (auth.role() = 'service_role');
  
create policy "Service role full access usage" on public.usage
  for all using (auth.role() = 'service_role');

create policy "Service role full access sessions" on public.sessions
  for all using (auth.role() = 'service_role');
  
create policy "Service role full access accounts" on public.accounts
  for all using (auth.role() = 'service_role');

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Project messages table for chat history persistence
create table if not exists public.project_messages (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  message_id text not null, -- Client-generated ID (timestamp-based)
  type text not null check (type in ('user', 'assistant')),
  content text not null,
  timestamp bigint not null, -- Unix timestamp in milliseconds
  tool_calls jsonb default '[]'::jsonb, -- Array of tool call objects
  saved_files jsonb default '[]'::jsonb, -- Array of saved file paths
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, message_id)
);

-- Index for efficient message loading
create index if not exists idx_project_messages_project_id on public.project_messages(project_id);
create index if not exists idx_project_messages_timestamp on public.project_messages(project_id, timestamp);

-- Enable RLS on project_messages
alter table public.project_messages enable row level security;

-- RLS Policies for project_messages (access through project ownership)
create policy "Users can view messages for their projects" on public.project_messages
  for select using (
    exists (
      select 1 from public.projects p
      join public.users u on p.user_id = u.id
      where p.id = project_id and u.id::text = auth.uid()::text
    )
  );

create policy "Service role full access project_messages" on public.project_messages
  for all using (auth.role() = 'service_role');

-- Project files table for code persistence
create table if not exists public.project_files (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  path text not null, -- File path relative to project root (e.g., "src/App.jsx")
  content text not null, -- File content
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, path)
);

-- Index for efficient file loading
create index if not exists idx_project_files_project_id on public.project_files(project_id);

-- Enable RLS on project_files
alter table public.project_files enable row level security;

-- RLS Policies for project_files (access through project ownership)
create policy "Users can view files for their projects" on public.project_files
  for select using (
    exists (
      select 1 from public.projects p
      join public.users u on p.user_id = u.id
      where p.id = project_id and u.id::text = auth.uid()::text
    )
  );

create policy "Service role full access project_files" on public.project_files
  for all using (auth.role() = 'service_role');

-- Triggers for updated_at
create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

create trigger usage_updated_at
  before update on public.usage
  for each row execute function public.handle_updated_at();

create trigger project_files_updated_at
  before update on public.project_files
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- Security Audits
-- ============================================================================

-- Security audit scans (partial scans are free, full audits require purchase)
create table if not exists public.security_audits (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  scan_type text not null check (scan_type in ('partial', 'full')),
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  summary jsonb default '{}'::jsonb, -- AuditSummary
  findings jsonb default '[]'::jsonb, -- SecurityFinding[] (empty for partial scans)
  categories jsonb default '[]'::jsonb, -- SecurityCategory[]
  preview_finding jsonb, -- Single finding preview for partial scans
  scanned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Security audit purchases
create table if not exists public.security_audit_purchases (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  audit_id uuid references public.security_audits(id) on delete cascade not null,
  stripe_payment_intent_id text unique,
  amount integer not null, -- in pence
  currency text not null default 'gbp',
  status text not null default 'pending' check (status in ('pending', 'completed', 'refunded', 'failed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for security audits
create index if not exists idx_security_audits_project_id on public.security_audits(project_id);
create index if not exists idx_security_audits_user_id on public.security_audits(user_id);
create index if not exists idx_security_audit_purchases_user_id on public.security_audit_purchases(user_id);
create index if not exists idx_security_audit_purchases_project_id on public.security_audit_purchases(project_id);
create index if not exists idx_security_audit_purchases_payment_intent on public.security_audit_purchases(stripe_payment_intent_id);

-- Enable RLS on security tables
alter table public.security_audits enable row level security;
alter table public.security_audit_purchases enable row level security;

-- RLS Policies for security_audits
create policy "Users can view own security audits" on public.security_audits
  for select using (user_id::text = auth.uid()::text);

create policy "Service role full access security_audits" on public.security_audits
  for all using (auth.role() = 'service_role');

-- RLS Policies for security_audit_purchases
create policy "Users can view own audit purchases" on public.security_audit_purchases
  for select using (user_id::text = auth.uid()::text);

create policy "Service role full access security_audit_purchases" on public.security_audit_purchases
  for all using (auth.role() = 'service_role');

-- Triggers for updated_at
create trigger security_audit_purchases_updated_at
  before update on public.security_audit_purchases
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- Project Environment Variables
-- ============================================================================

-- Project environment variables table
create table if not exists public.project_env_vars (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  key text not null,
  value text not null,
  is_secret boolean default false, -- If true, value should be encrypted/hidden in UI
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, key)
);

-- Index for efficient env var loading
create index if not exists idx_project_env_vars_project_id on public.project_env_vars(project_id);

-- Enable RLS on project_env_vars
alter table public.project_env_vars enable row level security;

-- RLS Policies for project_env_vars (access through project ownership)
create policy "Users can view env vars for their projects" on public.project_env_vars
  for select using (
    exists (
      select 1 from public.projects p
      join public.users u on p.user_id = u.id
      where p.id = project_id and u.id::text = auth.uid()::text
    )
  );

create policy "Service role full access project_env_vars" on public.project_env_vars
  for all using (auth.role() = 'service_role');

-- Trigger for updated_at
create trigger project_env_vars_updated_at
  before update on public.project_env_vars
  for each row execute function public.handle_updated_at();
