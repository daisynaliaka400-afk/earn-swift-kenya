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