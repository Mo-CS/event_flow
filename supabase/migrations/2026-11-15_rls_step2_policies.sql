-- ===========================================================================
-- EventFlow — RLS plan, STEP 2 of 2: real policies
--
-- Run this ONLY after step 1 is applied, the JWT secret is configured and
-- `select public.whoami();` returns your user id (see docs/RLS_PLAN.md).
--
-- What changes for the user: nothing.
--   * The same pages, the same login form, the same buttons.
--   * The difference is that the database now knows who is calling, so it can
--     reject writes from anonymous visitors and from the wrong role.
--
-- Summary of the model
--   anon          -> read the public catalogue only (events, categories, ...)
--   authenticated -> every logged-in user; identity = auth.uid()
--   app_role      -> 'admin' | 'organizer' | 'attendee' (from the JWT)
--   admin         -> everything, including approvals and settings
--   organizer     -> own events + read finance/audience, request bans/expenses
--   attendee      -> own registrations, tickets, feedback, notifications
--   Donors of audience grants (can_view / can_edit / can_send) keep the exact
--   access the Audience and Campaigns pages already give them.
--
-- Every old `using (true)` policy is dropped first, so this file is idempotent.
-- A rollback recipe is at the bottom of the file.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Helper functions used by the policies
--    (must be executable by anon/authenticated: policies run as the caller)
-- ---------------------------------------------------------------------------
create or replace function public.app_is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
as $$
  select public.app_role() = 'admin'
$$;

create or replace function public.app_is_staff()
returns boolean
language sql
stable
as $$
  select public.app_role() in ('admin', 'organizer')
$$;

-- True when the caller organizes that event: admin, "manages all events",
-- an event_organizers row, or the event's main organizer.
create or replace function public.app_owns_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.app_role() = 'admin'
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.manages_all_events
    )
    or exists (
      select 1 from public.event_organizers eo
      where eo.event_id = p_event_id and eo.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.events e
      join public.profiles p on p.id = e.organizer_id
      where e.id = p_event_id and p.user_id = auth.uid()
    )
$$;

-- True when the profile row belongs to the caller.
create or replace function public.app_owns_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.user_id = auth.uid()
  )
$$;

-- True when the registration belongs to the caller.
create or replace function public.app_owns_registration(p_registration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.registrations r
    join public.profiles p on p.id = r.attendee_id
    where r.id = p_registration_id and p.user_id = auth.uid()
  )
$$;

-- True when the ticket belongs to the caller.
create or replace function public.app_owns_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tickets t
    join public.registrations r on r.id = t.registration_id
    join public.profiles p on p.id = r.attendee_id
    where t.id = p_ticket_id and p.user_id = auth.uid()
  )
$$;

-- Email of the caller, from the verified JWT claims. Used only for the
-- audience-CRM sync that runs when a user registers (see section 10).
create or replace function public.app_email()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::json->>'email'
$$;

-- Effective audience permission for the caller. Admin is not handled here on
-- purpose: policies always check app_is_admin() separately.
--   permission = 'view' | 'edit' | 'send'
create or replace function public.app_audience_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.audience_access_grants g
    where g.user_id = auth.uid()
      and g.starts_at <= now()
      and (g.expires_at is null or g.expires_at > now())
      and case p_permission
            when 'view' then g.can_view
            when 'edit' then g.can_edit
            when 'send' then g.can_send
            else false
          end
  )
$$;

-- ---------------------------------------------------------------------------
-- 1b. Waiting-list promotion, moved into the database
--
--     Promotion writes to another user's registration and creates their
--     ticket. That is exactly the write RLS now forbids for an attendee, so
--     the work runs in SECURITY DEFINER functions. The client still sends the
--     notification and the email, so the user-visible flow is unchanged.
-- ---------------------------------------------------------------------------
create or replace function app_private.promote_first_waitlisted(
  p_event_id uuid,
  p_attendance_mode text default null
)
returns public.registrations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reg public.registrations;
  v_event_type text;
  v_mode text;
  v_code text;
begin
  select r.* into v_reg
  from public.registrations r
  where r.event_id = p_event_id
    and r.status = 'waitlisted'
    and (p_attendance_mode is null or r.attendance_mode = p_attendance_mode)
  order by r.registered_at
  limit 1
  for update;

  if v_reg.id is null then
    return null;
  end if;

  update public.registrations
     set status = 'confirmed'
   where id = v_reg.id
  returning * into v_reg;

  select e.event_type into v_event_type from public.events e where e.id = p_event_id;
  v_mode := coalesce(
    v_reg.attendance_mode,
    case when v_event_type = 'online' then 'online' else 'in_person' end
  );

  if not exists (select 1 from public.tickets t where t.registration_id = v_reg.id) then
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.tickets (
      registration_id, unique_code, qr_payload, qr_code_url, attendance_mode
    ) values (
      v_reg.id,
      v_code,
      'EF1:' || app_private.b64url(convert_to(json_build_object(
        'v', 1,
        'code', v_code,
        'eventId', p_event_id,
        'registrationId', v_reg.id,
        'mode', v_mode
      )::text, 'utf8')),
      '',
      v_mode
    );
  end if;

  return v_reg;
end;
$$;

revoke all on function app_private.promote_first_waitlisted(uuid, text) from public;

-- Staff-only entry point used by the client (delete / manual promotion).
create or replace function public.app_promote_waitlist(
  p_event_id uuid,
  p_attendance_mode text default null
)
returns public.registrations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.app_is_staff() then
    raise exception 'Only organizers or administrators can promote the waiting list';
  end if;
  return app_private.promote_first_waitlisted(p_event_id, p_attendance_mode);
end;
$$;

-- Cancelling: the owner (attendee) or staff may cancel, and a confirmed spot
-- automatically promotes the next waitlisted registration in the same call.
create or replace function public.app_cancel_registration(p_registration_id uuid)
returns public.registrations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reg public.registrations;
  v_previous_status text;
  v_event_type text;
  v_promoted public.registrations;
begin
  select r.* into v_reg
  from public.registrations r
  where r.id = p_registration_id
  for update;

  if v_reg.id is null then
    raise exception 'Registration not found';
  end if;

  if not (public.app_is_staff() or public.app_owns_profile(v_reg.attendee_id)) then
    raise exception 'You can only cancel your own registration';
  end if;

  v_previous_status := v_reg.status;

  if v_previous_status = 'cancelled' then
    return null;
  end if;

  update public.registrations
     set status = 'cancelled'
   where id = v_reg.id
  returning * into v_reg;

  if v_previous_status = 'confirmed' then
    select e.event_type into v_event_type from public.events e where e.id = v_reg.event_id;
    v_promoted := app_private.promote_first_waitlisted(
      v_reg.event_id,
      case when v_event_type = 'hybrid' then coalesce(v_reg.attendance_mode, 'in_person') else null end
    );
    return v_promoted;
  end if;

  return null;
end;
$$;

revoke all on function public.app_promote_waitlist(uuid, text) from public;
revoke all on function public.app_cancel_registration(uuid) from public;
grant execute on function public.app_promote_waitlist(uuid, text) to authenticated;
grant execute on function public.app_cancel_registration(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS everywhere (idempotent, skips tables that do not exist)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'events', 'event_organizers', 'profiles', 'users', 'roles', 'categories', 'venues',
    'currencies', 'registrations', 'tickets', 'attendance', 'feedback', 'notifications',
    'device_sessions', 'files', 'invitation_links', 'speakers', 'sessions',
    'chat_channels', 'chat_messages', 'evaluations', 'evaluation_questions',
    'evaluation_submissions', 'evaluation_answers', 'event_costs',
    'event_requests', 'user_bans', 'ban_revoke_requests',
    'funding_sources', 'expenses', 'fund_transfers',
    'audience_contacts', 'audience_access_grants',
    'email_campaigns', 'email_campaign_recipients', 'email_templates',
    'admin_messages', 'admin_message_recipients',
    'password_otp_codes', 'password_reset_requests', 'password_reset_tokens',
    'auth_attempts', 'audit_logs', 'app_settings',
    'meeting_presence', 'meeting_chat_messages'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Drop every existing policy in public (the old "always true" ones)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Grants: anon loses every write, then gets read on the public catalogue.
--    authenticated keeps full DML; RLS decides which rows.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select on
  public.events,
  public.categories,
  public.venues,
  public.roles,
  public.currencies,
  public.profiles,
  public.event_organizers,
  public.registrations,
  public.evaluations,
  public.evaluation_questions,
  public.evaluation_submissions,
  public.evaluation_answers,
  public.feedback,
  public.speakers,
  public.sessions,
  public.files,
  public.invitation_links,
  public.app_settings,
  public.email_templates
to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Policies — public catalogue (anon may read, only staff may change)
-- ---------------------------------------------------------------------------
create policy events_select on public.events for select to anon, authenticated
  using (deleted_at is null or public.app_is_staff());

create policy events_insert on public.events for insert to authenticated
  with check (public.app_is_staff());

create policy events_update on public.events for update to authenticated
  using (public.app_owns_event(id)) with check (public.app_owns_event(id));

create policy events_delete on public.events for delete to authenticated
  using (public.app_is_admin());

create policy event_organizers_select on public.event_organizers for select to anon, authenticated
  using (true);

create policy event_organizers_insert on public.event_organizers for insert to authenticated
  with check (public.app_is_staff());

create policy event_organizers_update on public.event_organizers for update to authenticated
  using (public.app_owns_event(event_id)) with check (public.app_owns_event(event_id));

create policy event_organizers_delete on public.event_organizers for delete to authenticated
  using (public.app_owns_event(event_id));

create policy categories_select on public.categories for select to anon, authenticated
  using (true);

create policy categories_insert on public.categories for insert to authenticated
  with check (public.app_is_staff());

create policy categories_update on public.categories for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy categories_delete on public.categories for delete to authenticated
  using (public.app_is_admin());

create policy venues_select on public.venues for select to anon, authenticated
  using (true);

create policy venues_insert on public.venues for insert to authenticated
  with check (public.app_is_staff());

create policy venues_update on public.venues for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy venues_delete on public.venues for delete to authenticated
  using (public.app_is_admin());

create policy roles_select on public.roles for select to anon, authenticated
  using (true);

create policy roles_write on public.roles for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy currencies_select on public.currencies for select to anon, authenticated
  using (true);

create policy currencies_write on public.currencies for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy speakers_select on public.speakers for select to anon, authenticated
  using (true);

create policy speakers_write on public.speakers for all to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy sessions_select on public.sessions for select to anon, authenticated
  using (true);

create policy sessions_write on public.sessions for all to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy files_select on public.files for select to anon, authenticated
  using (true);

create policy files_write on public.files for all to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy app_settings_select on public.app_settings for select to anon, authenticated
  using (true);

create policy app_settings_write on public.app_settings for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy email_templates_select on public.email_templates for select to anon, authenticated
  using (true);

create policy email_templates_write on public.email_templates for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- ---------------------------------------------------------------------------
-- 6. People
-- ---------------------------------------------------------------------------
-- profiles are public (organizer names are shown on event pages).
create policy profiles_select on public.profiles for select to anon, authenticated
  using (true);

-- An administrator may create the profile of another user (User management).
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = auth.uid() or public.app_is_admin());

create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid() or public.app_is_admin())
  with check (user_id = auth.uid() or public.app_is_admin());

create policy profiles_delete on public.profiles for delete to authenticated
  using (public.app_is_admin());

-- users (emails): logged-in users only. password_hash is not a grantable column.
create policy users_select on public.users for select to authenticated
  using (true);

create policy users_insert on public.users for insert to authenticated
  with check (public.app_is_admin());

create policy users_update on public.users for update to authenticated
  using (id = auth.uid() or public.app_is_admin())
  with check (id = auth.uid() or public.app_is_admin());

create policy users_delete on public.users for delete to authenticated
  using (public.app_is_admin());

-- ---------------------------------------------------------------------------
-- 7. Registration / attendance flow
-- ---------------------------------------------------------------------------
-- Seat counters are read anonymously on public event pages, as before.
create policy registrations_select on public.registrations for select to anon, authenticated
  using (true);

create policy registrations_insert on public.registrations for insert to authenticated
  with check (public.app_owns_profile(attendee_id));

create policy registrations_update on public.registrations for update to authenticated
  using (public.app_owns_profile(attendee_id) or public.app_is_staff())
  with check (public.app_owns_profile(attendee_id) or public.app_is_staff());

create policy registrations_delete on public.registrations for delete to authenticated
  using (public.app_is_staff());

create policy tickets_select on public.tickets for select to authenticated
  using (public.app_is_staff() or public.app_owns_registration(registration_id));

create policy tickets_insert on public.tickets for insert to authenticated
  with check (public.app_is_staff() or public.app_owns_registration(registration_id));

create policy tickets_update on public.tickets for update to authenticated
  using (public.app_is_staff() or public.app_owns_registration(registration_id))
  with check (public.app_is_staff() or public.app_owns_registration(registration_id));

create policy tickets_delete on public.tickets for delete to authenticated
  using (public.app_is_staff());

create policy attendance_select on public.attendance for select to authenticated
  using (public.app_is_staff() or public.app_owns_ticket(ticket_id));

create policy attendance_insert on public.attendance for insert to authenticated
  with check (public.app_is_staff() or public.app_owns_ticket(ticket_id));

create policy attendance_update on public.attendance for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy attendance_delete on public.attendance for delete to authenticated
  using (public.app_is_staff());

create policy feedback_select on public.feedback for select to anon, authenticated
  using (true);

create policy feedback_insert on public.feedback for insert to authenticated
  with check (public.app_owns_profile(attendee_id));

create policy feedback_update on public.feedback for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy feedback_delete on public.feedback for delete to authenticated
  using (public.app_is_staff());

-- ---------------------------------------------------------------------------
-- 8. Personal data
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.app_is_authenticated());

create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy device_sessions_select on public.device_sessions for select to authenticated
  using (user_id = auth.uid());

create policy device_sessions_insert on public.device_sessions for insert to authenticated
  with check (user_id = auth.uid());

create policy device_sessions_update on public.device_sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy device_sessions_delete on public.device_sessions for delete to authenticated
  using (user_id = auth.uid());

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.app_is_admin());

create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (public.app_is_authenticated());

-- ---------------------------------------------------------------------------
-- 9. Event content
-- ---------------------------------------------------------------------------
create policy chat_channels_select on public.chat_channels for select to authenticated
  using (public.app_is_authenticated());

create policy chat_channels_insert on public.chat_channels for insert to authenticated
  with check (public.app_is_authenticated());

create policy chat_channels_update on public.chat_channels for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy chat_channels_delete on public.chat_channels for delete to authenticated
  using (public.app_is_admin());

create policy chat_messages_select on public.chat_messages for select to authenticated
  using (public.app_is_authenticated());

create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid());

create policy chat_messages_update on public.chat_messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy chat_messages_delete on public.chat_messages for delete to authenticated
  using (sender_id = auth.uid() or public.app_is_admin());

create policy meeting_presence_select on public.meeting_presence for select to authenticated
  using (user_id = auth.uid() or public.app_is_staff());

create policy meeting_presence_insert on public.meeting_presence for insert to authenticated
  with check (user_id = auth.uid());

create policy meeting_presence_update on public.meeting_presence for update to authenticated
  using (user_id = auth.uid() or public.app_is_staff())
  with check (user_id = auth.uid() or public.app_is_staff());

create policy meeting_presence_delete on public.meeting_presence for delete to authenticated
  using (public.app_is_admin());

create policy meeting_chat_select on public.meeting_chat_messages for select to authenticated
  using (public.app_is_authenticated());

create policy meeting_chat_insert on public.meeting_chat_messages for insert to authenticated
  with check (sender_id = auth.uid());

create policy meeting_chat_update on public.meeting_chat_messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy meeting_chat_delete on public.meeting_chat_messages for delete to authenticated
  using (sender_id = auth.uid() or public.app_is_admin());

create policy evaluations_select on public.evaluations for select to anon, authenticated
  using (true);

create policy evaluations_write on public.evaluations for all to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy evaluation_questions_select on public.evaluation_questions for select to anon, authenticated
  using (true);

create policy evaluation_questions_write on public.evaluation_questions for all to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

-- Public aggregates are readable; submissions are only created through
-- submit_evaluation() (SECURITY DEFINER), so there is no INSERT policy here.
create policy evaluation_submissions_select on public.evaluation_submissions for select to anon, authenticated
  using (true);

create policy evaluation_submissions_update on public.evaluation_submissions for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy evaluation_submissions_delete on public.evaluation_submissions for delete to authenticated
  using (public.app_is_admin());

create policy evaluation_answers_select on public.evaluation_answers for select to anon, authenticated
  using (true);

create policy evaluation_answers_delete on public.evaluation_answers for delete to authenticated
  using (public.app_is_admin());

create policy event_costs_select on public.event_costs for select to authenticated
  using (public.app_owns_event(event_id) or public.app_is_admin());

create policy event_costs_insert on public.event_costs for insert to authenticated
  with check (public.app_owns_event(event_id) or public.app_is_admin());

create policy event_costs_update on public.event_costs for update to authenticated
  using (public.app_owns_event(event_id) or public.app_is_admin())
  with check (public.app_owns_event(event_id) or public.app_is_admin());

create policy event_costs_delete on public.event_costs for delete to authenticated
  using (public.app_owns_event(event_id) or public.app_is_admin());

create policy invitation_links_select on public.invitation_links for select to anon, authenticated
  using (true);

create policy invitation_links_insert on public.invitation_links for insert to authenticated
  with check (public.app_is_staff());

-- An invited guest marks the link as used; only unused links can be updated.
create policy invitation_links_update on public.invitation_links for update to authenticated
  using (public.app_is_authenticated() and used = false)
  with check (public.app_is_authenticated());

create policy invitation_links_delete on public.invitation_links for delete to authenticated
  using (public.app_is_staff());

create policy event_requests_select on public.event_requests for select to authenticated
  using (requester_id = auth.uid() or public.app_is_staff());

create policy event_requests_insert on public.event_requests for insert to authenticated
  with check (requester_id = auth.uid());

create policy event_requests_update on public.event_requests for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());

create policy event_requests_delete on public.event_requests for delete to authenticated
  using (public.app_is_admin());

-- ---------------------------------------------------------------------------
-- 10. Administration
-- ---------------------------------------------------------------------------
-- Organizers review the ban list and request bans (status = 'pending').
-- An attendee may read their own ban so registration can explain the block.
create policy user_bans_select on public.user_bans for select to authenticated
  using (public.app_is_staff() or user_id = auth.uid() or requested_by = auth.uid());

create policy user_bans_insert on public.user_bans for insert to authenticated
  with check (
    public.app_is_admin()
    or (requested_by = auth.uid() and status = 'pending')
  );

create policy user_bans_update on public.user_bans for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy user_bans_delete on public.user_bans for delete to authenticated
  using (public.app_is_admin());

create policy ban_revoke_requests_select on public.ban_revoke_requests for select to authenticated
  using (requested_by = auth.uid() or public.app_is_admin());

create policy ban_revoke_requests_insert on public.ban_revoke_requests for insert to authenticated
  with check (requested_by = auth.uid());

create policy ban_revoke_requests_update on public.ban_revoke_requests for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- Finance: organizers read the books and submit expense requests; only an
-- administrator approves/rejects or edits the records.
create policy funding_sources_select on public.funding_sources for select to authenticated
  using (public.app_is_staff());

create policy funding_sources_write on public.funding_sources for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy expenses_select on public.expenses for select to authenticated
  using (public.app_is_staff());

create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.app_is_staff() and requested_by = auth.uid());

create policy expenses_update on public.expenses for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy expenses_delete on public.expenses for delete to authenticated
  using (public.app_is_admin());

create policy fund_transfers_select on public.fund_transfers for select to authenticated
  using (public.app_is_staff());

create policy fund_transfers_insert on public.fund_transfers for insert to authenticated
  with check (public.app_is_staff() and created_by = auth.uid());

create policy fund_transfers_update on public.fund_transfers for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy fund_transfers_delete on public.fund_transfers for delete to authenticated
  using (public.app_is_admin());

-- Audience CRM.
--   * admins and grant holders manage the list;
--   * every registrant may add/update the row that carries their own email,
--     which is what the registration-time CRM sync does.
create policy audience_contacts_select on public.audience_contacts for select to authenticated
  using (
    public.app_is_admin()
    or public.app_audience_can('view')
    or public.app_audience_can('send')
    or user_id = auth.uid()
    or lower(email) = lower(public.app_email())
  );

create policy audience_contacts_insert on public.audience_contacts for insert to authenticated
  with check (
    public.app_is_admin()
    or public.app_audience_can('edit')
    or user_id = auth.uid()
    or lower(email) = lower(public.app_email())
  );

create policy audience_contacts_update on public.audience_contacts for update to authenticated
  using (
    public.app_is_admin()
    or public.app_audience_can('edit')
    or user_id = auth.uid()
    or lower(email) = lower(public.app_email())
  )
  with check (
    public.app_is_admin()
    or public.app_audience_can('edit')
    or user_id = auth.uid()
    or lower(email) = lower(public.app_email())
  );

create policy audience_contacts_delete on public.audience_contacts for delete to authenticated
  using (public.app_is_admin());

create policy audience_access_grants_select on public.audience_access_grants for select to authenticated
  using (public.app_is_admin() or user_id = auth.uid());

create policy audience_access_grants_write on public.audience_access_grants for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- Campaigns: admins and holders of the "send" grant.
create policy email_campaigns_rw on public.email_campaigns for all to authenticated
  using (public.app_is_admin() or public.app_audience_can('send'))
  with check (public.app_is_admin() or public.app_audience_can('send'));

create policy email_campaign_recipients_rw on public.email_campaign_recipients for all to authenticated
  using (public.app_is_admin() or public.app_audience_can('send'))
  with check (public.app_is_admin() or public.app_audience_can('send'));

create policy admin_messages_admin on public.admin_messages for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy admin_message_recipients_admin on public.admin_message_recipients for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy password_reset_requests_admin on public.password_reset_requests for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- password_otp_codes, password_reset_tokens and auth_attempts intentionally have
-- no policies: they are reachable only through SECURITY DEFINER functions.

commit;

-- ===========================================================================
-- ROLLBACK (copy/paste in the SQL editor) — restores the previous behaviour
-- ===========================================================================
-- do $$
-- declare
--   t text;
--   r record;
--   tables text[] := array[
--     'events', 'event_organizers', 'profiles', 'users', 'roles', 'categories', 'venues',
--     'currencies', 'registrations', 'tickets', 'attendance', 'feedback', 'notifications',
--     'device_sessions', 'files', 'invitation_links', 'speakers', 'sessions',
--     'chat_channels', 'chat_messages', 'evaluations', 'evaluation_questions',
--     'evaluation_submissions', 'evaluation_answers', 'event_costs',
--     'event_requests', 'user_bans', 'ban_revoke_requests',
--     'funding_sources', 'expenses', 'fund_transfers',
--     'audience_contacts', 'audience_access_grants',
--     'email_campaigns', 'email_campaign_recipients', 'email_templates',
--     'admin_messages', 'admin_message_recipients',
--     'password_otp_codes', 'password_reset_requests', 'password_reset_tokens',
--     'auth_attempts', 'audit_logs', 'app_settings',
--     'meeting_presence', 'meeting_chat_messages'
--   ];
-- begin
--   for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
--     execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
--   end loop;
--   foreach t in array tables loop
--     if to_regclass('public.' || t) is not null then
--       execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_all', t);
--     end if;
--   end loop;
-- end $$;
-- ===========================================================================
