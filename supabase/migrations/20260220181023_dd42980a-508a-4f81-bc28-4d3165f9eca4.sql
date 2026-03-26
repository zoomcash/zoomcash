
-- Table to store each user's referral code
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral code"
ON public.referral_codes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral code"
ON public.referral_codes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Table to track who referred whom
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals as referrer"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referral as referred"
ON public.referrals FOR SELECT
USING (auth.uid() = referred_id);

-- Table to track referral commissions earned
CREATE TABLE public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  deposit_id uuid NOT NULL,
  commission_amount numeric NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commissions"
ON public.referral_commissions FOR SELECT
USING (auth.uid() = referrer_id);

-- Admin policies
CREATE POLICY "Admins can view all referral codes"
ON public.referral_codes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all referrals"
ON public.referrals FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all commissions"
ON public.referral_commissions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Function to process referral commission when deposit is confirmed
-- Called from the webhook after a deposit of >= R$30 is confirmed
CREATE OR REPLACE FUNCTION public.process_referral_commission(_referred_user_id uuid, _deposit_id uuid, _deposit_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer_id uuid;
  _already_paid boolean;
BEGIN
  -- Only process for deposits >= 30
  IF _deposit_amount < 30 THEN
    RETURN;
  END IF;

  -- Find who referred this user
  SELECT referrer_id INTO _referrer_id
  FROM public.referrals
  WHERE referred_id = _referred_user_id;

  IF _referrer_id IS NULL THEN
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

  -- Record commission
  INSERT INTO public.referral_commissions (referrer_id, referred_id, deposit_id, commission_amount)
  VALUES (_referrer_id, _referred_user_id, _deposit_id, 10);

  -- Credit R$10 to referrer's wallet
  PERFORM public.update_wallet_balance(
    _referrer_id,
    10,
    'bonus',
    'Comissão de indicação'
  );
END;
$$;

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  _code text;
  _exists boolean;
BEGIN
  LOOP
    _code := upper(substr(md5(random()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = _code) INTO _exists;
    EXIT WHEN NOT _exists;
  END LOOP;
  RETURN _code;
END;
$$;

-- Function to register a referral (called during signup)
CREATE OR REPLACE FUNCTION public.register_referral(_referred_id uuid, _referral_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer_id uuid;
BEGIN
  -- Find the referrer by code
  SELECT user_id INTO _referrer_id
  FROM public.referral_codes
  WHERE code = upper(trim(_referral_code));

  IF _referrer_id IS NULL THEN
    RETURN; -- Invalid code, silently ignore
  END IF;

  -- Can't refer yourself
  IF _referrer_id = _referred_id THEN
    RETURN;
  END IF;

  -- Insert referral (UNIQUE on referred_id prevents duplicates)
  INSERT INTO public.referrals (referrer_id, referred_id)
  VALUES (_referrer_id, _referred_id)
  ON CONFLICT (referred_id) DO NOTHING;
END;
$$;
