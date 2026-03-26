
-- ============================================================
-- 1. SECURE BALANCE UPDATE FUNCTION (replaces direct wallet UPDATE)
-- Only allows server-validated balance changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  _user_id UUID,
  _amount NUMERIC,
  _type transaction_type,
  _description TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_balance NUMERIC;
  _new_balance NUMERIC;
BEGIN
  -- Get current balance with row lock
  SELECT balance INTO _current_balance
  FROM public.wallets
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  -- Calculate new balance
  IF _type IN ('bet', 'withdrawal') THEN
    _new_balance := _current_balance - _amount;
  ELSE
    _new_balance := _current_balance + _amount;
  END IF;

  -- Prevent negative balance
  IF _new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Update wallet
  UPDATE public.wallets SET balance = _new_balance WHERE user_id = _user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (_user_id, _type, _amount, _description);

  RETURN _new_balance;
END;
$$;

-- ============================================================
-- 2. REMOVE direct wallet UPDATE for regular users
-- Only admins and the security definer function can update
-- ============================================================
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- ============================================================
-- 3. RESTRICT transactions INSERT - users can only insert 'bet' type
-- 'win', 'bonus', 'deposit', 'withdrawal' must come from server functions
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;

CREATE POLICY "Users can insert bet transactions only"
ON public.transactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND type = 'bet'
);

-- ============================================================
-- 4. RESTRICT bets UPDATE - users cannot change status to 'won' or 'cashout'
-- Only allow updating 'pending' bets, and not changing payout/multiplier upward
-- ============================================================
DROP POLICY IF EXISTS "Users can update own bets" ON public.bets;

CREATE POLICY "Users can update own pending bets"
ON public.bets FOR UPDATE
USING (
  auth.uid() = user_id
  AND status = 'pending'
);

-- ============================================================
-- 5. ADMIN APPROVE WITHDRAWAL FUNCTION (server-side only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  _withdrawal_id UUID,
  _action TEXT,
  _admin_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _withdrawal RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Validate action
  IF _action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid action. Must be approved or rejected';
  END IF;

  -- Get withdrawal with lock
  SELECT * INTO _withdrawal
  FROM public.withdrawals
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF _withdrawal.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal already processed';
  END IF;

  -- Update withdrawal status
  UPDATE public.withdrawals
  SET status = _action, admin_note = _admin_note, updated_at = now()
  WHERE id = _withdrawal_id;

  -- If approved, deduct balance and record transaction
  IF _action = 'approved' THEN
    PERFORM public.update_wallet_balance(
      _withdrawal.user_id,
      _withdrawal.amount,
      'withdrawal',
      'Saque PIX aprovado - ' || _withdrawal.pix_key
    );
  END IF;
END;
$$;

-- ============================================================
-- 6. SECURE GAME WIN FUNCTION (only way to credit wins)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_game_win(
  _user_id UUID,
  _amount NUMERIC,
  _game_type TEXT,
  _bet_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance NUMERIC;
BEGIN
  -- Verify the caller is the user
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate amount
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid win amount';
  END IF;

  -- Update bet status if provided
  IF _bet_id IS NOT NULL THEN
    UPDATE public.bets
    SET status = 'won', payout = _amount
    WHERE id = _bet_id AND user_id = _user_id AND status = 'pending';
  END IF;

  -- Credit the win via secure function
  _new_balance := public.update_wallet_balance(
    _user_id,
    _amount,
    'win',
    'Prêmio ' || _game_type
  );

  RETURN _new_balance;
END;
$$;
