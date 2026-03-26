
-- Create deposits table to track PIX deposit requests
CREATE TABLE public.deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  misticpay_transaction_id TEXT,
  qrcode_url TEXT,
  copy_paste TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- Users can view their own deposits
CREATE POLICY "Users can view their own deposits"
ON public.deposits FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own deposits
CREATE POLICY "Users can create their own deposits"
ON public.deposits FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can update deposits (for webhook)
CREATE POLICY "Service role can update deposits"
ON public.deposits FOR UPDATE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_deposits_updated_at
BEFORE UPDATE ON public.deposits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
