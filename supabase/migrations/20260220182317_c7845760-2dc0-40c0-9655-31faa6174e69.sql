
-- Create affiliate settings table for configurable commission values
CREATE TABLE public.affiliate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_deposit numeric NOT NULL DEFAULT 30,
  level1_commission numeric NOT NULL DEFAULT 10,
  level2_commission numeric NOT NULL DEFAULT 5,
  level3_commission numeric NOT NULL DEFAULT 2,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
CREATE POLICY "Admins can view affiliate settings"
ON public.affiliate_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update affiliate settings"
ON public.affiliate_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can read (needed for display on referral page)
CREATE POLICY "Authenticated users can view affiliate settings"
ON public.affiliate_settings FOR SELECT TO authenticated
USING (true);

-- Insert default row
INSERT INTO public.affiliate_settings (min_deposit, level1_commission, level2_commission, level3_commission)
VALUES (30, 10, 5, 2);

-- Update the process_referral_commission function to use dynamic settings
CREATE OR REPLACE FUNCTION public.process_referral_commission(_referred_user_id uuid, _deposit_id uuid, _deposit_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _level1_referrer uuid;
  _level2_referrer uuid;
  _level3_referrer uuid;
  _already_paid boolean;
  _settings RECORD;
BEGIN
  -- Get dynamic settings
  SELECT min_deposit, level1_commission, level2_commission, level3_commission
  INTO _settings
  FROM public.affiliate_settings
  LIMIT 1;

  -- Fallback defaults
  IF NOT FOUND THEN
    _settings.min_deposit := 30;
    _settings.level1_commission := 10;
    _settings.level2_commission := 5;
    _settings.level3_commission := 2;
  END IF;

  -- Only process for deposits >= min_deposit
  IF _deposit_amount < _settings.min_deposit THEN
    RETURN;
  END IF;

  -- Check if commission already paid for this deposit
  SELECT EXISTS(
    SELECT 1 FROM public.referral_commissions
    WHERE deposit_id = _deposit_id
  ) INTO _already_paid;

  IF _already_paid THEN
    RETURN;
  END IF;

  -- Level 1: direct referrer
  SELECT referrer_id INTO _level1_referrer
  FROM public.referrals
  WHERE referred_id = _referred_user_id;

  IF _level1_referrer IS NULL THEN
    RETURN;
  END IF;

  -- Credit Level 1
  INSERT INTO public.referral_commissions (referrer_id, referred_id, deposit_id, commission_amount, level)
  VALUES (_level1_referrer, _referred_user_id, _deposit_id, _settings.level1_commission, 1);
  PERFORM public.update_wallet_balance(_level1_referrer, _settings.level1_commission, 'bonus', 'Comissão Nível 1');

  -- Level 2
  SELECT referrer_id INTO _level2_referrer
  FROM public.referrals
  WHERE referred_id = _level1_referrer;

  IF _level2_referrer IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.referral_commissions (referrer_id, referred_id, deposit_id, commission_amount, level)
  VALUES (_level2_referrer, _referred_user_id, _deposit_id, _settings.level2_commission, 2);
  PERFORM public.update_wallet_balance(_level2_referrer, _settings.level2_commission, 'bonus', 'Comissão Nível 2');

  -- Level 3
  SELECT referrer_id INTO _level3_referrer
  FROM public.referrals
  WHERE referred_id = _level2_referrer;

  IF _level3_referrer IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.referral_commissions (referrer_id, referred_id, deposit_id, commission_amount, level)
  VALUES (_level3_referrer, _referred_user_id, _deposit_id, _settings.level3_commission, 3);
  PERFORM public.update_wallet_balance(_level3_referrer, _settings.level3_commission, 'bonus', 'Comissão Nível 3');
END;
$function$;
