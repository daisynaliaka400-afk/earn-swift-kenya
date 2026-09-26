-- SmartEarn full database setup for your own Supabase project.
-- Run once in Supabase Dashboard -> SQL Editor on an EMPTY project.

-- ===== drizzle/migrations/0000_smartearn_core.sql =====
CREATE TYPE public.app_role AS ENUM ('admin','customer');
CREATE TYPE public.account_status AS ENUM ('pending','active','suspended');
CREATE TYPE public.account_tier AS ENUM ('starter','standard','pro');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  email text,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid REFERENCES public.profiles(id),
  balance numeric(12,2) NOT NULL DEFAULT 0,
  tier public.account_tier NOT NULL DEFAULT 'starter',
  status public.account_status NOT NULL DEFAULT 'pending',
  streak int NOT NULL DEFAULT 0,
  last_login timestamptz,
  last_task timestamptz,
  sms_opt_out boolean NOT NULL DEFAULT false,
  fraud_score int NOT NULL DEFAULT 0,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL,
  reward_starter numeric(10,2) NOT NULL,
  reward_standard numeric(10,2) NOT NULL,
  reward_pro numeric(10,2) NOT NULL,
  est_minutes int NOT NULL DEFAULT 2,
  slots_total int,
  slots_used int NOT NULL DEFAULT 0,
  requires_proof boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tasks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public active tasks" ON public.tasks FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reward numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  proof text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completions" ON public.task_completions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_id uuid;
BEGIN
  SELECT id INTO ref_id FROM public.profiles WHERE referral_code = upper(NEW.raw_user_meta_data->>'ref');
  INSERT INTO public.profiles (id, name, phone, referral_code, referred_by)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'name','Member'), NEW.raw_user_meta_data->>'phone',
          upper(substr(md5(NEW.id::text),1,7)), ref_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic task completion
CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tasks; p public.profiles; r numeric;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p.status = 'suspended' THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id AND is_active FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task unavailable'; END IF;
  IF t.slots_total IS NOT NULL AND t.slots_used >= t.slots_total THEN RAISE EXCEPTION 'No slots left'; END IF;
  IF EXISTS (SELECT 1 FROM public.task_completions WHERE user_id=p.id AND task_id=t.id AND created_at::date = now()::date) THEN
    RAISE EXCEPTION 'Already completed today'; END IF;
  r := CASE p.tier WHEN 'pro' THEN t.reward_pro WHEN 'standard' THEN t.reward_standard ELSE t.reward_starter END;
  INSERT INTO public.task_completions (user_id, task_id, reward, status)
    VALUES (p.id, t.id, r, CASE WHEN t.requires_proof THEN 'pending' ELSE 'approved' END);
  UPDATE public.tasks SET slots_used = slots_used + 1 WHERE id = t.id;
  IF NOT t.requires_proof THEN
    UPDATE public.profiles SET balance = balance + r, last_task = now() WHERE id = p.id;
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;

INSERT INTO public.tasks (title, description, category, reward_starter, reward_standard, reward_pro, est_minutes, slots_total) VALUES
('Watch a product video', 'Watch a short video to the end and answer one question.', 'Videos', 2, 4, 8, 2, 500),
('Share a WhatsApp status', 'Post the provided status and keep it up for 24 hours.', 'Social Media', 10, 20, 40, 3, 300),
('Follow a partner page', 'Follow and engage with a partner social page.', 'Social Media', 7, 14, 28, 2, 400),
('Consumer habits survey', 'Answer a short survey about shopping habits.', 'Surveys', 15, 30, 60, 6, 200),
('Install & review an app', 'Install the listed app, use it briefly and leave feedback.', 'App Tasks', 30, 60, 120, 10, 100);
UPDATE public.tasks SET requires_proof = true WHERE category IN ('Social Media','App Tasks');
-- ===== drizzle/migrations/0001_payments_sms.sql =====
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  trigger_type text NOT NULL,
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'sending',
  http_code int,
  response text,
  attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read sms" ON public.sms_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.sms_logs (sent_at DESC);

CREATE TABLE public.stk_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL,
  amount numeric(10,2) NOT NULL,
  tier public.account_tier NOT NULL,
  ref text NOT NULL UNIQUE,
  checkout_request_id text,
  merchant_request_id text,
  transaction_id text UNIQUE,
  status text NOT NULL DEFAULT 'initiated',
  failure_reason text,
  request_payload jsonb,
  response_payload jsonb,
  callback_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stk_transactions TO authenticated;
GRANT ALL ON public.stk_transactions TO service_role;
ALTER TABLE public.stk_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin stk" ON public.stk_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.stk_transactions (checkout_request_id);
CREATE INDEX ON public.stk_transactions (status);

CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin commissions" ON public.commissions FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit TO authenticated;
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.admin_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Atomic, idempotent activation. Returns json describing what happened.
CREATE OR REPLACE FUNCTION public.activate_stk(_ref text, _txid text, _amount numeric, _payload jsonb, _actor text DEFAULT 'callback')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.stk_transactions; u public.profiles; c numeric; refr public.profiles;
BEGIN
  SELECT * INTO t FROM public.stk_transactions WHERE ref = _ref FOR UPDATE;
  IF t.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','unknown_ref'); END IF;
  IF t.status = 'success' THEN RETURN jsonb_build_object('ok',true,'duplicate',true); END IF;
  IF _amount IS DISTINCT FROM t.amount THEN
    UPDATE public.stk_transactions SET status='failed', failure_reason='amount_mismatch', callback_payload=_payload, updated_at=now() WHERE id=t.id;
    RETURN jsonb_build_object('ok',false,'reason','amount_mismatch');
  END IF;
  UPDATE public.stk_transactions SET status='success', transaction_id=_txid, callback_payload=coalesce(_payload,callback_payload), updated_at=now() WHERE id=t.id;
  UPDATE public.profiles SET status='active', tier=t.tier, activated_at=now() WHERE id=t.user_id RETURNING * INTO u;
  INSERT INTO public.admin_audit(actor, action, details) VALUES (_actor, 'activation', jsonb_build_object('ref',_ref,'user',t.user_id,'amount',_amount));
  IF u.referred_by IS NOT NULL THEN
    c := CASE t.tier WHEN 'pro' THEN 250 WHEN 'standard' THEN 150 ELSE 80 END;
    INSERT INTO public.commissions(referrer_id, referred_id, amount) VALUES (u.referred_by, u.id, c) ON CONFLICT (referred_id) DO NOTHING;
    IF FOUND THEN
      UPDATE public.profiles SET balance = balance + c WHERE id = u.referred_by RETURNING * INTO refr;
      RETURN jsonb_build_object('ok',true,'user_id',u.id,'name',u.name,'phone',u.phone,'code',u.referral_code,'amount',_amount,
        'referrer_id',refr.id,'referrer_name',refr.name,'referrer_phone',refr.phone,'referrer_code',refr.referral_code,'commission',c);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'user_id',u.id,'name',u.name,'phone',u.phone,'code',u.referral_code,'amount',_amount);
END $$;
REVOKE ALL ON FUNCTION public.activate_stk(text,text,numeric,jsonb,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_stk(text,text,numeric,jsonb,text) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
-- ===== drizzle/migrations/0002_require_verifiable_live_tasks.sql =====
ALTER TABLE public.tasks
  ADD COLUMN action_url text,
  ADD COLUMN instructions text,
  ADD COLUMN sponsor_name text;

ALTER TABLE public.tasks
  ADD CONSTRAINT active_tasks_require_action_url
  CHECK (NOT is_active OR (action_url IS NOT NULL AND action_url ~ '^https://'));

COMMENT ON COLUMN public.tasks.action_url IS 'Verified HTTPS destination where the member performs the task.';
COMMENT ON COLUMN public.tasks.instructions IS 'Concrete completion and proof instructions supplied by the task sponsor.';
COMMENT ON COLUMN public.tasks.sponsor_name IS 'Organization responsible for the task offer.';
-- ===== drizzle/migrations/0003_app_settings.sql =====
-- Custom SQL migration file, put your code below! --
-- ===== drizzle/migrations/0004_app_settings.sql =====
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- ===== drizzle/migrations/0005_live_activity.sql =====
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin withdrawals" ON public.withdrawals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.recent_activity()
RETURNS TABLE(kind text, who text, amount numeric, at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT 'joined'::text, split_part(name,' ',1) || ' (' || left(phone,6) || '***' || right(phone,2) || ')', NULL::numeric, created_at
      FROM profiles WHERE phone IS NOT NULL
    UNION ALL
    SELECT 'activated', split_part(name,' ',1) || ' (' || left(phone,6) || '***' || right(phone,2) || ')', NULL, activated_at
      FROM profiles WHERE activated_at IS NOT NULL
    UNION ALL
    SELECT 'withdrew', split_part(p.name,' ',1) || ' (' || left(p.phone,6) || '***' || right(p.phone,2) || ')', w.amount, w.created_at
      FROM withdrawals w JOIN profiles p ON p.id = w.user_id WHERE w.status = 'paid'
  ) x ORDER BY 4 DESC LIMIT 12
$$;
GRANT EXECUTE ON FUNCTION public.recent_activity() TO anon, authenticated;
-- ===== drizzle/migrations/0006_auto_approve_tasks.sql =====
UPDATE public.tasks SET requires_proof = false;
CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t public.tasks; p public.profiles; r numeric;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p.status = 'suspended' THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id AND is_active FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task unavailable'; END IF;
  IF t.slots_total IS NOT NULL AND t.slots_used >= t.slots_total THEN RAISE EXCEPTION 'No slots left'; END IF;
  IF EXISTS (SELECT 1 FROM public.task_completions WHERE user_id=p.id AND task_id=t.id AND created_at::date = now()::date) THEN
    RAISE EXCEPTION 'Already completed today'; END IF;
  r := CASE p.tier WHEN 'pro' THEN t.reward_pro WHEN 'standard' THEN t.reward_standard ELSE t.reward_starter END;
  INSERT INTO public.task_completions (user_id, task_id, reward, status) VALUES (p.id, t.id, r, 'approved');
  UPDATE public.tasks SET slots_used = slots_used + 1 WHERE id = t.id;
  UPDATE public.profiles SET balance = balance + r, last_task = now() WHERE id = p.id;
  RETURN r;
END $function$;
UPDATE public.profiles p SET balance = balance + c.reward
  FROM public.task_completions c WHERE c.user_id = p.id AND c.status = 'pending';
UPDATE public.task_completions SET status = 'approved' WHERE status = 'pending';
-- Enable realtime for live tasks (safe if already added)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_sms_digest timestamptz;

CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.tasks; p public.profiles; r numeric; total_done int; today_done int;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p.status = 'suspended' THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT count(*) INTO total_done FROM public.task_completions WHERE user_id = p.id;
  SELECT count(*) INTO today_done FROM public.task_completions WHERE user_id = p.id AND created_at::date = now()::date;
  IF p.status <> 'active' AND total_done >= 3 THEN RAISE EXCEPTION 'Free limit reached: activate your account to keep earning'; END IF;
  IF p.status = 'active' AND today_done >= 4 THEN RAISE EXCEPTION 'Daily limit of 4 tasks reached. Come back tomorrow'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _task_id AND is_active FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task unavailable'; END IF;
  IF t.slots_total IS NOT NULL AND t.slots_used >= t.slots_total THEN RAISE EXCEPTION 'No slots left'; END IF;
  IF EXISTS (SELECT 1 FROM public.task_completions WHERE user_id=p.id AND task_id=t.id AND created_at::date = now()::date) THEN
    RAISE EXCEPTION 'Already completed today'; END IF;
  r := GREATEST(50, CASE p.tier WHEN 'pro' THEN t.reward_pro WHEN 'standard' THEN t.reward_standard ELSE t.reward_starter END);
  INSERT INTO public.task_completions (user_id, task_id, reward, status) VALUES (p.id, t.id, r, 'approved');
  UPDATE public.tasks SET slots_used = slots_used + 1 WHERE id = t.id;
  UPDATE public.profiles SET balance = balance + r, last_task = now() WHERE id = p.id;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.profiles; wid uuid;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p.status <> 'active' THEN RAISE EXCEPTION 'Activate your account before withdrawing'; END IF;
  IF _amount < 650 THEN RAISE EXCEPTION 'Minimum withdrawal is KSh 650'; END IF;
  IF _amount > p.balance THEN RAISE EXCEPTION 'Amount is more than your balance'; END IF;
  IF EXISTS (SELECT 1 FROM public.withdrawals WHERE user_id = p.id AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending withdrawal'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = p.id;
  INSERT INTO public.withdrawals (user_id, amount, phone) VALUES (p.id, _amount, coalesce(nullif(_phone,''), p.phone)) RETURNING id INTO wid;
  RETURN wid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(_id uuid, _paid boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status <> 'pending' THEN RAISE EXCEPTION 'Not pending'; END IF;
  IF _paid THEN
    UPDATE public.withdrawals SET status='paid', processed_at=now() WHERE id=_id;
  ELSE
    UPDATE public.withdrawals SET status='rejected', processed_at=now() WHERE id=_id;
    UPDATE public.profiles SET balance = balance + w.amount WHERE id = w.user_id;
  END IF;
  INSERT INTO public.admin_audit(actor, action, details) VALUES (auth.uid()::text, 'withdrawal_'||CASE WHEN _paid THEN 'paid' ELSE 'rejected' END, jsonb_build_object('id',_id));
END $$;

CREATE OR REPLACE FUNCTION public.my_referrals()
RETURNS TABLE(name text, status account_status, joined timestamptz, earned numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT split_part(p.name,' ',1), p.status, p.created_at, coalesce(c.amount,0)
  FROM public.profiles p LEFT JOIN public.commissions c ON c.referred_id = p.id
  WHERE p.referred_by = auth.uid() ORDER BY p.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_referrals() FROM anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_referrals() TO authenticated;
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

UPDATE public.tasks SET reward_starter = GREATEST(reward_starter,50), reward_standard = GREATEST(reward_standard,60), reward_pro = GREATEST(reward_pro,75);