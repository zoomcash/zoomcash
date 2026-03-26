
-- 1. Add currency and metadata columns to ledger_entries
ALTER TABLE public.ledger_entries 
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Create trigger to block UPDATE on ledger_entries (service_role bypasses RLS)
CREATE OR REPLACE FUNCTION public.prevent_ledger_update()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable. UPDATE operations are forbidden.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_ledger_update
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ledger_update();

-- 3. Create trigger to block DELETE on ledger_entries
CREATE OR REPLACE FUNCTION public.prevent_ledger_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable. DELETE operations are forbidden.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_ledger_delete
  BEFORE DELETE ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ledger_delete();

-- 4. Revoke direct UPDATE on merchants.balance-related fields
-- (merchants table has no balance column - saldo is computed from ledger, which is correct)
-- But add a trigger to prevent any attempt to add a balance column in the future
-- and ensure no direct wallet-style manipulation on merchants

-- 5. Create index for faster ledger balance computation
CREATE INDEX IF NOT EXISTS idx_ledger_merchant_type ON public.ledger_entries (merchant_id, entry_type);
