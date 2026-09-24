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