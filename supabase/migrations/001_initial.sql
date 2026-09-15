-- Lingora pilot. Run once on a fresh Supabase project.
create table public.pilot_invites(email text primary key check(email=lower(email)));
alter table public.pilot_invites enable row level security;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 level text not null default 'A1' check(level in ('A1','A2','B1','B2','C1','C2')),
 level_source text not null default 'declared' check(level_source in ('declared','estimated')),
 interest text not null default '' check(length(interest)<=500),
 daily_minutes int not null default 15 check(daily_minutes between 5 and 60),
 onboarded boolean not null default false,
 created_at timestamptz not null default now()
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from pilot_invites where email=lower(new.email)) then raise exception 'Registro restringido al piloto'; end if;
 insert into profiles(id) values(new.id); return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create table public.lessons(id text primary key, level text not null, skill text not null, payload jsonb not null, active boolean not null default true);
create table public.lesson_progress (
 user_id uuid references auth.users on delete cascade, lesson_id text references lessons,
 step int not null default 0, completed boolean not null default false,
 correct int not null default 0, attempts int not null default 0, version int not null default 0,
 updated_at timestamptz not null default now(), primary key(user_id,lesson_id)
);
create table public.exercise_attempts (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade,
 lesson_id text not null references lessons, exercise_id text not null, answer text not null check(length(answer)<=4000),
 correct boolean, created_at timestamptz not null default now(), unique(user_id,lesson_id,exercise_id)
);
create table public.user_errors (
 user_id uuid references auth.users on delete cascade, lesson_id text references lessons, exercise_id text,
 original text not null, correction text not null, explanation text not null, occurrences int not null default 1,
 last_occurrence timestamptz not null default now(), primary key(user_id,lesson_id,exercise_id)
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 front text not null, back text not null, next_review timestamptz not null default now(),
 interval_days int not null default 0, ease float not null default 2.5, repetitions int not null default 0,
 version int not null default 0, unique(user_id,front)
);
create index due_reviews on reviews(user_id,next_review);
create table public.diagnostics (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users on delete cascade,
 answers jsonb not null default '{}', elapsed_seconds float not null default 0 check(elapsed_seconds between 0 and 900),
 active boolean not null default false, completed boolean not null default false,
 version int not null default 0, updated_at timestamptz not null default now()
);
create table public.messages (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade,
 role text not null check(role in ('user','assistant')), content text not null check(length(content)<=8000), created_at timestamptz not null default now()
);
create index user_messages on messages(user_id,id desc);
create table public.feedback (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 lesson_id text references lessons, message text not null check(length(message) between 3 and 2000), created_at timestamptz not null default now()
);
create table public.ai_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 operation text not null, model text, input_tokens int, output_tokens int, latency_ms int, estimated_cost numeric,
 status text not null default 'reserved', created_at timestamptz not null default now()
);
create index ai_daily_usage on ai_requests(created_at,user_id);
create table public.ai_cache (
 cache_key text primary key, user_id uuid not null references auth.users on delete cascade, response text not null, expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['profiles','lesson_progress','exercise_attempts','user_errors','reviews','diagnostics','messages','feedback','ai_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid()) = %I)',t,case when t='profiles' then 'id' else 'user_id' end);
 end loop;
end $$;
alter table lessons enable row level security;
create policy public_lessons on lessons for select using(active);
alter table ai_cache enable row level security;
create policy profile_update on profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy feedback_insert on feedback for insert to authenticated with check((select auth.uid())=user_id);
-- Supabase may grant table privileges by default: explicitly narrow them.
revoke all on profiles,lessons,lesson_progress,exercise_attempts,user_errors,reviews,diagnostics,messages,feedback,ai_requests,ai_cache,pilot_invites from anon,authenticated;
grant select on lessons to anon,authenticated;
grant select on profiles,lesson_progress,exercise_attempts,user_errors,reviews,diagnostics,messages,feedback,ai_requests to authenticated;
grant update(display_name,level,level_source,interest,daily_minutes,onboarded) on profiles to authenticated;
grant insert on feedback to authenticated;
-- Progress cannot be written directly by the browser. A version conflict must be reloaded.
create function public.submit_exercise(p_lesson text,p_version int,p_answer text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); p lesson_progress; l jsonb; e jsonb; ok boolean; word jsonb; expected text;
begin
 if u is null then raise exception 'Inicia sesión'; end if;
 if length(p_answer)>4000 or length(trim(p_answer))=0 then raise exception 'Respuesta inválida'; end if;
 select payload into l from lessons where id=p_lesson and active;
 if l is null then raise exception 'Lección no disponible'; end if;
 insert into lesson_progress(user_id,lesson_id) values(u,p_lesson) on conflict do nothing;
 select * into p from lesson_progress where user_id=u and lesson_id=p_lesson for update;
 if p.version<>p_version then raise exception 'CONFLICT: recarga el progreso'; end if;
 if p.completed then raise exception 'Lección ya completada'; end if;
 e:=l->'exercises'->p.step; expected:=e->>'answer';
 if expected is not null then
  ok:=lower(regexp_replace(trim(p_answer),'[.!?]+$','','g'))=lower(regexp_replace(trim(expected),'[.!?]+$','','g'));
 else ok:=null; end if;
 insert into exercise_attempts(user_id,lesson_id,exercise_id,answer,correct) values(u,p_lesson,e->>'id',p_answer,ok);
 if ok=false then
  insert into user_errors(user_id,lesson_id,exercise_id,original,correction,explanation)
  values(u,p_lesson,e->>'id',p_answer,expected,e->>'explanation')
  on conflict(user_id,lesson_id,exercise_id) do update set occurrences=user_errors.occurrences+1,last_occurrence=now();
  insert into reviews(user_id,front,back) values(u,e->>'prompt',expected || ' — ' || (e->>'explanation')) on conflict(user_id,front) do nothing;
 end if;
 update lesson_progress set step=step+1,completed=(step+1>=jsonb_array_length(l->'exercises')),correct=correct+case when ok then 1 else 0 end,attempts=attempts+case when ok is null then 0 else 1 end,version=version+1,updated_at=now() where user_id=u and lesson_id=p_lesson returning * into p;
 if p.completed then
  for word in select value from jsonb_array_elements(l->'vocabulary') loop
   insert into reviews(user_id,front,back) values(u,word->>'word',word->>'translation') on conflict(user_id,front) do nothing;
  end loop;
 end if;
 return jsonb_build_object('progress',to_jsonb(p),'correct',ok,'explanation',e->>'explanation','answer',expected);
end $$;
create function public.rate_review(p_id uuid,p_version int,p_quality int) returns public.reviews
language plpgsql security definer set search_path=public as $$
declare r reviews; days int; new_ease float;
begin
 if p_quality not in (0,3,4,5) then raise exception 'Calificación inválida'; end if;
 select * into r from reviews where id=p_id and user_id=auth.uid() for update;
 if r.id is null then raise exception 'Repaso no disponible'; end if;
 if r.version<>p_version then raise exception 'CONFLICT: repaso actualizado'; end if;
 if r.next_review>now() then raise exception 'Repaso aún no disponible'; end if;
 new_ease:=greatest(1.3,r.ease+0.1-(5-p_quality)*(0.08+(5-p_quality)*0.02));
 days:=case when p_quality<3 or r.repetitions=0 then 1 when r.repetitions=1 then 6 else greatest(1,round(r.interval_days*r.ease)::int) end;
 update reviews set interval_days=days,ease=new_ease,repetitions=case when p_quality<3 then 0 else repetitions+1 end,next_review=now()+make_interval(days=>days),version=version+1 where id=p_id returning * into r;
 return r;
end $$;
-- A 45-second lease caps abandoned-tab time; clients heartbeat every 15 seconds.
create function public.save_diagnostic(p_version int,p_active boolean,p_key text default null,p_answer text default null,p_finish boolean default false)
returns public.diagnostics language plpgsql security definer set search_path=public as $$
declare d diagnostics; elapsed float;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 insert into diagnostics(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into d from diagnostics where user_id=auth.uid() for update;
 if d.version<>p_version then raise exception 'CONFLICT: diagnóstico abierto en otro dispositivo'; end if;
 if d.completed then return d; end if;
 elapsed:=least(900,d.elapsed_seconds+case when d.active then least(45,greatest(0,extract(epoch from now()-d.updated_at))) else 0 end);
 if p_key is not null and elapsed<900 then
  if length(p_key)>100 or p_answer is null or length(p_answer)>4000 then raise exception 'Respuesta inválida'; end if;
  d.answers:=jsonb_set(d.answers,array[p_key],to_jsonb(p_answer));
 end if;
 update diagnostics set answers=d.answers,elapsed_seconds=elapsed,active=(p_active and elapsed<900 and not p_finish),completed=(p_finish or elapsed>=900),version=version+1,updated_at=now() where id=d.id returning * into d;
 return d;
end $$;
-- Serialize quota reservations across invocations so parallel calls cannot exceed the cap.
create function public.reserve_ai(p_user uuid,p_operation text,p_user_limit int,p_global_limit int,p_minute_limit int) returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 perform pg_advisory_xact_lock(741852);
 if (select count(*) from ai_requests where created_at>=date_trunc('day',now()) and user_id=p_user)>=p_user_limit
 or (select count(*) from ai_requests where created_at>=date_trunc('day',now()))>=p_global_limit
 or (select count(*) from ai_requests where created_at>now()-interval '1 minute' and user_id=p_user)>=p_minute_limit
 then raise exception 'AI_QUOTA: límite de uso alcanzado'; end if;
 insert into ai_requests(user_id,operation) values(p_user,p_operation) returning id into rid; return rid;
end $$;
revoke all on function public.create_profile() from public;
revoke all on function public.submit_exercise(text,int,text) from public;
revoke all on function public.rate_review(uuid,int,int) from public;
revoke all on function public.save_diagnostic(int,boolean,text,text,boolean) from public;
revoke all on function public.reserve_ai(uuid,text,int,int,int) from public;
grant execute on function public.submit_exercise(text,int,text),public.rate_review(uuid,int,int),public.save_diagnostic(int,boolean,text,text,boolean) to authenticated;
grant execute on function public.reserve_ai(uuid,text,int,int,int) to service_role;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
