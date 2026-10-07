create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Consultorio odontológico',
  dentist_name text not null default 'Profesional tratante',
  professional_license text not null default 'Registro profesional',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'dentist' check (role in ('owner', 'dentist', 'assistant')),
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  document_type text not null default 'CC',
  document_number text not null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  sex text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  emergency_contact text not null default '',
  allergies text not null default '',
  medical_history text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, document_number)
);

create table if not exists public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  folio text not null default ('HC-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  consultation_date date not null,
  reason text not null,
  symptoms text not null default '',
  blood_pressure text not null default '',
  heart_rate text not null default '',
  diagnosis text not null,
  diagnosis_code text not null default '',
  treatment text not null,
  observations text not null default '',
  odontogram jsonb not null default '{}'::jsonb,
  prescriptions jsonb not null default '[]'::jsonb,
  next_appointment timestamptz,
  status text not null default 'final' check (status in ('draft', 'final')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, folio)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists patients_clinic_name_idx on public.patients (clinic_id, last_name, first_name);
create index if not exists records_clinic_date_idx on public.clinical_records (clinic_id, consultation_date desc);
create index if not exists records_patient_idx on public.clinical_records (patient_id, consultation_date desc);

create or replace function public.is_clinic_member(target_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_members
    where clinic_id = target_clinic and user_id = auth.uid()
  );
$$;

create or replace function public.bootstrap_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_clinic_id uuid;
  display_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select clinic_id into current_clinic_id
  from public.clinic_members
  where user_id = current_user_id
  order by created_at
  limit 1;

  display_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    split_part(coalesce(auth.jwt() ->> 'email', 'Profesional'), '@', 1)
  );

  insert into public.profiles (id, full_name)
  values (current_user_id, display_name)
  on conflict (id) do nothing;

  if current_clinic_id is null then
    insert into public.clinics (name, dentist_name, professional_license, owner_id)
    values (
      coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'clinic_name', ''), 'Consultorio odontológico'),
      display_name,
      coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'professional_license', ''), 'Registro profesional'),
      current_user_id
    ) returning id into current_clinic_id;

    insert into public.clinic_members (clinic_id, user_id, role)
    values (current_clinic_id, current_user_id, 'owner');
  end if;

  return current_clinic_id;
end;
$$;

revoke all on function public.bootstrap_current_user() from public, anon;
grant execute on function public.bootstrap_current_user() to authenticated;
revoke all on function public.is_clinic_member(uuid) from public, anon;
grant execute on function public.is_clinic_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.patients enable row level security;
alter table public.clinical_records enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles, public.clinics, public.clinic_members, public.patients, public.clinical_records, public.audit_log from anon;
grant select, update on public.profiles to authenticated;
grant select, update on public.clinics to authenticated;
grant select on public.clinic_members to authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, insert, update on public.clinical_records to authenticated;
grant select, insert on public.audit_log to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists clinics_member_select on public.clinics;
create policy clinics_member_select on public.clinics for select to authenticated using (public.is_clinic_member(id));
drop policy if exists clinics_owner_update on public.clinics;
create policy clinics_owner_update on public.clinics for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists members_same_clinic_select on public.clinic_members;
create policy members_same_clinic_select on public.clinic_members for select to authenticated using (public.is_clinic_member(clinic_id));

drop policy if exists patients_member_select on public.patients;
create policy patients_member_select on public.patients for select to authenticated using (public.is_clinic_member(clinic_id));
drop policy if exists patients_member_insert on public.patients;
create policy patients_member_insert on public.patients for insert to authenticated with check (public.is_clinic_member(clinic_id));
drop policy if exists patients_member_update on public.patients;
create policy patients_member_update on public.patients for update to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

drop policy if exists records_member_select on public.clinical_records;
create policy records_member_select on public.clinical_records for select to authenticated using (public.is_clinic_member(clinic_id));
drop policy if exists records_member_insert on public.clinical_records;
create policy records_member_insert on public.clinical_records for insert to authenticated with check (
  public.is_clinic_member(clinic_id)
  and created_by = auth.uid()
  and exists (select 1 from public.patients p where p.id = patient_id and p.clinic_id = clinical_records.clinic_id)
);
drop policy if exists records_member_update on public.clinical_records;
create policy records_member_update on public.clinical_records for update to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

drop policy if exists audit_member_select on public.audit_log;
create policy audit_member_select on public.audit_log for select to authenticated using (public.is_clinic_member(clinic_id));
drop policy if exists audit_member_insert on public.audit_log;
create policy audit_member_insert on public.audit_log for insert to authenticated with check (public.is_clinic_member(clinic_id) and user_id = auth.uid());
