-- TavoloLibero relational schema blueprint
-- PostgreSQL-flavored DDL for architecture and domain modeling.

create table users (
  id bigserial primary key,
  role text not null check (role in ('worker', 'restaurant_admin', 'admin')),
  email text not null unique,
  password_hash text,
  status text not null default 'active' check (status in ('active', 'suspended', 'pending_review')),
  display_name text not null,
  avatar_url text,
  phone_e164 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_identities (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple', 'email')),
  provider_subject text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_subject)
);

create table consents (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  consent_key text not null,
  consent_version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  unique (user_id, consent_key, consent_version)
);

create table organizations (
  id bigserial primary key,
  legal_name text not null,
  vat_number text not null unique,
  fiscal_code text,
  legal_form text,
  city text not null,
  created_at timestamptz not null default now()
);

create table restaurant_profiles (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  owner_user_id bigint not null references users(id) on delete restrict,
  brand_name text not null,
  cuisine_type text,
  vibe_tags text[] not null default '{}',
  average_ticket_eur numeric(10,2),
  description text,
  rating_avg numeric(3,2),
  rating_count integer not null default 0
);

create table venues (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  venue_name text not null,
  address_line text not null,
  city text not null,
  region text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  indoor_capacity integer,
  created_at timestamptz not null default now()
);

create table worker_profiles (
  id bigserial primary key,
  user_id bigint not null unique references users(id) on delete cascade,
  tax_mode text not null check (tax_mode in ('forfettario', 'autonomo_occasionale', 'unknown')),
  vat_number text,
  headline text,
  bio text,
  home_city text not null,
  years_experience integer not null default 0,
  minimum_fee_eur numeric(10,2),
  rating_avg numeric(3,2),
  rating_count integer not null default 0,
  availability_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table worker_preferences (
  id bigserial primary key,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  preferred_zones text[] not null default '{}',
  preferred_service_types text[] not null default '{}',
  max_travel_km integer,
  preferred_shift_labels text[] not null default '{}'
);

create table worker_skills (
  id bigserial primary key,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  skill_code text not null,
  skill_level text not null check (skill_level in ('basic', 'advanced', 'expert')),
  verified boolean not null default false,
  unique (worker_profile_id, skill_code)
);

create table worker_certifications (
  id bigserial primary key,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  certification_name text not null,
  issuer text,
  issued_on date,
  expires_on date,
  verified boolean not null default false
);

create table former_employers (
  id bigserial primary key,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  employer_name text not null,
  employer_vat_number text,
  ended_on date not null,
  related_group_key text
);

create table service_packages (
  id bigserial primary key,
  restaurant_profile_id bigint not null references restaurant_profiles(id) on delete cascade,
  venue_id bigint references venues(id) on delete set null,
  package_name text not null,
  service_result_label text not null,
  role_needed text not null,
  flat_fee_eur numeric(10,2) not null,
  service_duration_label text,
  active boolean not null default true
);

create table service_requests (
  id bigserial primary key,
  restaurant_profile_id bigint not null references restaurant_profiles(id) on delete cascade,
  venue_id bigint references venues(id) on delete set null,
  service_package_id bigint references service_packages(id) on delete set null,
  requested_date date not null,
  requested_skills text[] not null default '{}',
  notes text,
  status text not null default 'open' check (status in ('open', 'shortlisted', 'matched', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create table matches (
  id bigserial primary key,
  service_request_id bigint not null references service_requests(id) on delete cascade,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  ranking_score numeric(6,3) not null,
  compliance_state text not null check (compliance_state in ('allow', 'warn', 'manual_review', 'soft_stop', 'hard_stop')),
  match_status text not null default 'proposed' check (match_status in ('proposed', 'accepted', 'rejected', 'expired', 'blocked')),
  proposed_at timestamptz not null default now(),
  unique (service_request_id, worker_profile_id)
);

create table chat_threads (
  id bigserial primary key,
  service_request_id bigint references service_requests(id) on delete set null,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  restaurant_profile_id bigint not null references restaurant_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table messages (
  id bigserial primary key,
  chat_thread_id bigint not null references chat_threads(id) on delete cascade,
  sender_user_id bigint not null references users(id) on delete cascade,
  message_body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table trial_services (
  id bigserial primary key,
  service_request_id bigint not null references service_requests(id) on delete cascade,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  outcome text check (outcome in ('scheduled', 'completed', 'cancelled', 'failed')),
  scheduled_at timestamptz,
  completed_at timestamptz
);

create table service_contracts (
  id bigserial primary key,
  service_request_id bigint not null references service_requests(id) on delete cascade,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  restaurant_profile_id bigint not null references restaurant_profiles(id) on delete cascade,
  contract_mode text not null check (contract_mode in ('forfettario', 'autonomo_occasionale')),
  template_key text not null,
  gross_amount_eur numeric(10,2) not null,
  platform_fee_eur numeric(10,2) not null,
  worker_net_eur numeric(10,2) not null,
  service_date date not null,
  status text not null default 'draft' check (status in ('draft', 'awaiting_signature', 'signed', 'voided'))
);

create table contract_signatures (
  id bigserial primary key,
  service_contract_id bigint not null references service_contracts(id) on delete cascade,
  signer_user_id bigint not null references users(id) on delete cascade,
  signed_at timestamptz not null,
  signature_provider text,
  ip_address inet
);

create table payment_orders (
  id bigserial primary key,
  service_contract_id bigint not null unique references service_contracts(id) on delete cascade,
  provider text not null default 'stripe_connect',
  provider_payment_intent_id text,
  currency char(3) not null default 'EUR',
  amount_total_eur numeric(10,2) not null,
  platform_fee_eur numeric(10,2) not null,
  payout_amount_eur numeric(10,2) not null,
  status text not null check (status in ('created', 'authorized', 'captured', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

create table payouts (
  id bigserial primary key,
  payment_order_id bigint not null references payment_orders(id) on delete cascade,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  payout_amount_eur numeric(10,2) not null,
  status text not null check (status in ('pending', 'on_hold', 'released', 'failed')),
  released_at timestamptz
);

create table pair_metrics (
  id bigserial primary key,
  worker_profile_id bigint not null references worker_profiles(id) on delete cascade,
  restaurant_profile_id bigint not null references restaurant_profiles(id) on delete cascade,
  days_12m integer not null default 0,
  days_24m integer not null default 0,
  gross_12m_eur numeric(10,2) not null default 0,
  gross_24m_eur numeric(10,2) not null default 0,
  worker_revenue_share_12m numeric(5,4) not null default 0,
  worker_revenue_share_24m numeric(5,4) not null default 0,
  control_score integer not null default 0,
  last_recomputed_at timestamptz not null default now(),
  unique (worker_profile_id, restaurant_profile_id)
);

create table compliance_snapshots (
  id bigserial primary key,
  pair_metric_id bigint references pair_metrics(id) on delete set null,
  service_request_id bigint references service_requests(id) on delete set null,
  policy_version text not null,
  decision_state text not null check (decision_state in ('allow', 'warn', 'manual_review', 'soft_stop', 'hard_stop')),
  snapshot_payload jsonb not null,
  created_at timestamptz not null default now()
);

create table compliance_alerts (
  id bigserial primary key,
  worker_profile_id bigint references worker_profiles(id) on delete set null,
  restaurant_profile_id bigint references restaurant_profiles(id) on delete set null,
  snapshot_id bigint references compliance_snapshots(id) on delete set null,
  alert_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  alert_message text not null,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table manual_reviews (
  id bigserial primary key,
  compliance_alert_id bigint not null references compliance_alerts(id) on delete cascade,
  reviewer_user_id bigint not null references users(id) on delete cascade,
  final_decision text not null check (final_decision in ('allow', 'warn', 'soft_stop', 'hard_stop')),
  reviewer_notes text,
  reviewed_at timestamptz not null default now()
);

create table reviews (
  id bigserial primary key,
  service_contract_id bigint not null references service_contracts(id) on delete cascade,
  reviewer_user_id bigint not null references users(id) on delete cascade,
  reviewee_user_id bigint not null references users(id) on delete cascade,
  reliability smallint not null check (reliability between 1 and 5),
  punctuality smallint not null check (punctuality between 1 and 5),
  professionalism smallint not null check (professionalism between 1 and 5),
  comment_text text,
  created_at timestamptz not null default now()
);

create table review_aggregates (
  id bigserial primary key,
  user_id bigint not null unique references users(id) on delete cascade,
  reliability_avg numeric(3,2) not null default 0,
  punctuality_avg numeric(3,2) not null default 0,
  professionalism_avg numeric(3,2) not null default 0,
  overall_avg numeric(3,2) not null default 0,
  review_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  actor_user_id bigint references users(id) on delete set null,
  action_key text not null,
  target_table text,
  target_id text,
  context_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
