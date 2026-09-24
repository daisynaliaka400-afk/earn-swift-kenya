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