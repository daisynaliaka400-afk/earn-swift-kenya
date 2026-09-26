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