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