
-- Add level column to referral_commissions
ALTER TABLE public.referral_commissions ADD COLUMN level integer NOT NULL DEFAULT 1;

-- Update process_referral_commission to support 3 levels
-- Level 1: R$10, Level 2: R$5, Level 3: R$2
CREATE OR REPLACE FUNCTION public.process_referral_commission(_referred_user_id uuid, _deposit_id uuid, _deposit_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _level1_referrer uuid;
  _level2_referrer uuid;
  _level3_referrer uuid;
  _already_paid boolean;
BEGIN
  -- Only process for deposits >= 30
  IF _deposit_amount < 30 THEN
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

  -- Credit Level 1: R$10
  INSERT INTO public.referral_commissions (referrer_id, referred_id, deposit_id, commission_amount, level)
  VALUES (_level1_referrer, _referred_user_id, _deposit_id, 10, 1);
  PERFORM public.update_wallet_balance(_level1_referrer, 10, 'bonus', 'Comissão Nível 1');

  -- Level 2: who referred the level 1 referrer?
  SELECT referrer_id INTO _level2_referrer
  FROM public.referrals
  WHERE referred_id = _level1_referrer;

  IF _level2_referrer IS NULL THEN
    RETURN;
  END IF;

  -- Credit Level 2: R$5
  INSERT INTO public.referral_commissions (referrer_id, referred_id, deposit_id, commission_amount, level)
  VALUES (_level2_referrer, _referred_user_id, _deposit_id, 5, 2);
  PERFORM public.update_wallet_balance(_level2_referrer, 5, 'bonus', 'Comissão Nível 2');

  -- Level 3: who referred the level 2 referrer?
  SELECT referrer_id INTO _level3_referrer
  FROM public.referrals
  WHERE referred_id = _level2_referrer;

  IF _level3_referrer IS NULL THEN
    RETURN;
  END IF;

  -- Credit Level 3: R$2
  INSERT INTO public.referral_commissions (referrer_id, referred_id, deposit_id, commission_amount, level)
  VALUES (_level3_referrer, _referred_user_id, _deposit_id, 2, 3);
  PERFORM public.update_wallet_balance(_level3_referrer, 2, 'bonus', 'Comissão Nível 3');
END;
$$;
