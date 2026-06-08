-- Billing & growth schema for X Autoposter
-- Powers the revenue/users KPI dashboard (goal: ¥1,000,000 first-month revenue + 100 users)
-- Run this in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Users: every signup is tracked here (drives the "100 users" goal)
-- ---------------------------------------------------------------------------
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  stripe_customer_id text unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  referral_code text unique,
  referred_by text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Idempotent columns for existing deployments
alter table app_users add column if not exists referral_code text;
alter table app_users add column if not exists referred_by text;

create index if not exists app_users_created_at_idx on app_users (created_at desc);
create index if not exists app_users_stripe_customer_idx on app_users (stripe_customer_id);
create index if not exists app_users_referral_code_idx on app_users (referral_code);
create index if not exists app_users_referred_by_idx on app_users (referred_by);

-- ---------------------------------------------------------------------------
-- Subscriptions: current Stripe subscription state per user
-- ---------------------------------------------------------------------------
create table if not exists subscriptions (
  id text primary key,                       -- Stripe subscription id (sub_...)
  user_id uuid references app_users (id) on delete cascade,
  stripe_customer_id text not null,
  plan text not null check (plan in ('pro', 'business')),
  status text not null,                      -- active, trialing, canceled, past_due, ...
  amount_jpy integer not null default 0,     -- monthly amount in JPY
  current_period_end timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists subscriptions_status_idx on subscriptions (status);
create index if not exists subscriptions_customer_idx on subscriptions (stripe_customer_id);

-- ---------------------------------------------------------------------------
-- Payments: every settled Stripe payment (drives the "¥1,000,000 revenue" goal)
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id text primary key,                       -- Stripe payment_intent / invoice id
  stripe_customer_id text,
  amount_jpy integer not null,               -- gross amount in JPY
  status text not null default 'paid',       -- paid, refunded
  paid_at timestamp with time zone not null default timezone('utc'::text, now()),
  raw jsonb
);

create index if not exists payments_paid_at_idx on payments (paid_at desc);
create index if not exists payments_status_idx on payments (status);

-- ---------------------------------------------------------------------------
-- Convenience view: lifetime + first-month revenue snapshot
-- ---------------------------------------------------------------------------
create or replace view revenue_summary as
select
  coalesce(sum(amount_jpy) filter (where status = 'paid'), 0)                       as total_revenue_jpy,
  coalesce(sum(amount_jpy) filter (
    where status = 'paid'
      and paid_at >= date_trunc('month', timezone('utc'::text, now()))
  ), 0)                                                                             as current_month_revenue_jpy,
  count(*) filter (where status = 'paid')                                           as paid_count
from payments;
