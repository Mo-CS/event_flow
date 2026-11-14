-- ===========================================================================
-- EventFlow — RLS plan, STEP 1 of 2: real per-request identity
--
-- Goal
--   Give every request a verifiable identity (a JWT signed by PostgreSQL with
--   the project's JWT secret) so Row Level Security can tell:
--     * who is calling        -> auth.uid()
--     * what role they have   -> app_role claim ('admin' | 'organizer' | 'attendee')
--   The login screen, the password flow and every page stay exactly as they are.
--
-- This file is SAFE to run on its own: it only adds code. It does NOT change a
-- single RLS policy, so if anything is misconfigured the app keeps working as it
-- does today (without identity).
--
-- Run order
--   1. this file
--   2. set the JWT secret (see "STEP 1b" at the bottom)
--   3. verify with select public.whoami();  (see docs/RLS_PLAN.md)
--   4. only then run 2026-11-15_rls_step2_policies.sql
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Private settings (never reachable through the API)
-- ---------------------------------------------------------------------------
create schema if not exists app_private;
revoke all on schema app_private from public;

create table if not exists app_private.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_private.settings enable row level security;
revoke all on app_private.settings from public;

-- ---------------------------------------------------------------------------
-- 2. Small helpers
-- ---------------------------------------------------------------------------
-- base64url without padding, as required by RFC 7515 (JWT)
create or replace function app_private.b64url(p_data bytea)
returns text
language sql
immutable
as $$
  select rtrim(
    translate(replace(encode(p_data, 'base64'), E'\n', ''), '+/', '-_'),
    '='
  )
$$;

-- The signing secret. Two sources, first one wins:
--   * current_setting('app.jwt_secret')     (set with: alter database ... set)
--   * app_private.settings where key='jwt_secret'
-- If neither is set the value is null and no token is issued, which means the
-- app simply keeps running without a verified identity (see header above).
create or replace function app_private.jwt_secret()
returns text
language sql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
  select coalesce(
    nullif(current_setting('app.jwt_secret', true), ''),
    (select nullif(value, '') from app_private.settings where key = 'jwt_secret')
  )
$$;

revoke all on function app_private.b64url(bytea) from public;
revoke all on function app_private.jwt_secret() from public;

-- ---------------------------------------------------------------------------
-- 3. Issue an HS256 JWT that PostgREST accepts
--
--    Claims:
--      role      = 'authenticated'  (PostgREST switches to the authenticated
--                                    database role; required)
--      aud       = 'authenticated'
--      sub       = users.id          (becomes auth.uid())
--      app_role  = admin/organizer/attendee  (used by the RLS policies)
--      email, iat, exp, iss
-- ---------------------------------------------------------------------------
create or replace function public.app_issue_jwt(
  p_user_id uuid,
  p_role text,
  p_email text,
  p_ttl interval default interval '12 hours'
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_secret  text := app_private.jwt_secret();
  v_header  text;
  v_payload text;
  v_input   text;
begin
  if v_secret is null or length(v_secret) < 16 then
    return null;
  end if;

  v_header := app_private.b64url(
    convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8')
  );

  v_payload := app_private.b64url(
    convert_to(
      json_build_object(
        'iss',      'eventflow',
        'aud',      'authenticated',
        'role',     'authenticated',
        'sub',      p_user_id,
        'app_role', coalesce(nullif(p_role, ''), 'attendee'),
        'email',    p_email,
        'iat',      extract(epoch from now())::bigint,
        'exp',      extract(epoch from (now() + p_ttl))::bigint
      )::text,
      'utf8'
    )
  );

  v_input := v_header || '.' || v_payload;

  return v_input || '.' || app_private.b64url(
    hmac(v_input, v_secret, 'sha256')
  );
end;
$$;

-- Only the security-definer auth RPCs may mint tokens.
revoke all on function public.app_issue_jwt(uuid, text, text, interval) from public;

-- Role of the caller, from the verified JWT claims. 'anon' when there is none.
create or replace function public.app_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'app_role',
    'anon'
  )
$$;

-- Diagnostics: call it from the app/CLI to prove the token is accepted.
create or replace function public.whoami()
returns json
language sql
stable
as $$
  select json_build_object(
    'user_id',  auth.uid(),
    'app_role', public.app_role(),
    'db_role',  current_user
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Auth RPCs now also return an access token.
--    Everything else (checks, errors, returned shape) is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.authenticate_user(p_email text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user record;
  v_profile record;
  v_role record;
  v_recent int;
  v_hash text;
begin
  select count(*) into v_recent
  from public.auth_attempts
  where email = lower(p_email)
    and attempted_at > now() - interval '15 minutes';

  if v_recent >= 5 then
    return json_build_object('error', 'Too many attempts. Please try again later.');
  end if;

  select u.* into v_user from public.users u where u.email = p_email limit 1;

  if v_user is null then
    insert into public.auth_attempts (email) values (lower(p_email));
    return json_build_object('error', 'Invalid email or password');
  end if;

  if v_user.password_hash like '$2$%' or v_user.password_hash like '$2a$%' or v_user.password_hash like '$2b$%' then
    v_hash := crypt(p_password, v_user.password_hash);
  else
    v_hash := encode(digest(p_password, 'sha256'), 'hex');
  end if;

  if v_user.password_hash <> v_hash then
    insert into public.auth_attempts (email) values (lower(p_email));
    return json_build_object('error', 'Invalid email or password');
  end if;

  if v_user.suspended then
    return json_build_object('error', 'Account is suspended');
  end if;

  if v_user.deleted_at is not null then
    return json_build_object('error', 'This account is deleted. Use "Restore account" from the login page within the recovery period.');
  end if;

  delete from public.auth_attempts where email = lower(p_email);

  select p.* into v_profile from public.profiles p where p.user_id = v_user.id limit 1;
  if v_profile is null then
    return json_build_object('error', 'Profile not found');
  end if;

  select r.* into v_role from public.roles r where r.id = v_profile.role_id limit 1;

  return json_build_object(
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'created_at', v_user.created_at,
      'updated_at', v_user.updated_at,
      'suspended', v_user.suspended,
      'must_change_password', v_user.must_change_password
    ),
    'profile', json_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'phone_number', v_profile.phone_number,
      'avatar_url', v_profile.avatar_url,
      'role_id', v_profile.role_id,
      'manages_all_events', v_profile.manages_all_events
    ),
    'role', v_role.name,
    'access_token', public.app_issue_jwt(v_user.id, v_role.name, v_user.email)
  );
end;
$$;

create or replace function public.get_session_user(p_token text)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_session public.device_sessions%rowtype;
  v_user record;
  v_profile record;
  v_role record;
begin
  select * into v_session from public.device_sessions where token = p_token limit 1;
  if v_session is null then
    return json_build_object('error', 'Session not found');
  end if;

  update public.device_sessions set last_active_at = now() where id = v_session.id;

  select u.* into v_user from public.users u where u.id = v_session.user_id limit 1;
  if v_user is null then
    return json_build_object('error', 'Session not found');
  end if;
  if v_user.suspended then
    return json_build_object('error', 'Account is suspended');
  end if;
  if v_user.deleted_at is not null then
    delete from public.device_sessions where user_id = v_user.id;
    return json_build_object('error', 'Account is deleted');
  end if;

  select p.* into v_profile from public.profiles p where p.user_id = v_user.id limit 1;
  if v_profile is null then
    return json_build_object('error', 'Profile not found');
  end if;

  select r.* into v_role from public.roles r where r.id = v_profile.role_id limit 1;

  return json_build_object(
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'created_at', v_user.created_at,
      'updated_at', v_user.updated_at,
      'suspended', v_user.suspended,
      'must_change_password', v_user.must_change_password
    ),
    'profile', json_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'phone_number', v_profile.phone_number,
      'avatar_url', v_profile.avatar_url,
      'role_id', v_profile.role_id,
      'manages_all_events', v_profile.manages_all_events
    ),
    'role', v_role.name,
    'device_session_id', v_session.id,
    'access_token', public.app_issue_jwt(v_user.id, v_role.name, v_user.email)
  );
end;
$$;

create or replace function public.register_user(p_email text, p_password text, p_first_name text, p_last_name text)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user record;
  v_profile record;
  v_role record;
begin
  if exists (select 1 from public.users where lower(email) = lower(p_email)) then
    return json_build_object('error', 'Email already in use');
  end if;

  select * into v_role from public.roles where name = 'attendee' limit 1;
  if v_role is null then
    return json_build_object('error', 'Role not found');
  end if;

  insert into public.users (email, password_hash)
  values (p_email, crypt(p_password, gen_salt('bf', 10)))
  returning * into v_user;

  insert into public.profiles (user_id, first_name, last_name, phone_number, avatar_url, role_id)
  values (v_user.id, p_first_name, p_last_name, '', '', v_role.id)
  returning * into v_profile;

  return json_build_object(
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'created_at', v_user.created_at,
      'updated_at', v_user.updated_at,
      'suspended', v_user.suspended,
      'must_change_password', v_user.must_change_password
    ),
    'profile', json_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'phone_number', v_profile.phone_number,
      'avatar_url', v_profile.avatar_url,
      'role_id', v_profile.role_id,
      'manages_all_events', v_profile.manages_all_events
    ),
    'role', 'attendee',
    'access_token', public.app_issue_jwt(v_user.id, 'attendee', v_user.email)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- STEP 1b — configure the signing secret (run this once, then never again)
--
--   The value MUST be the project's JWT secret:
--     Supabase dashboard -> Project Settings -> API -> JWT Settings -> JWT Secret
--   For a local `supabase start` stack the default is:
--     super-secret-jwt-token-with-at-least-32-characters-long
--
--   insert into app_private.settings (key, value)
--   values ('jwt_secret', 'PASTE-THE-JWT-SECRET-HERE')
--   on conflict (key) do update
--     set value = excluded.value, updated_at = now();
--
--   Then check:
--     select public.app_issue_jwt(gen_random_uuid(), 'attendee', 'test@example.com') is not null;
--     -- must return true
-- ---------------------------------------------------------------------------
