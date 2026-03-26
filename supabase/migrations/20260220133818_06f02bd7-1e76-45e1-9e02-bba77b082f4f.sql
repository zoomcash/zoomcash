
-- Create scratch cards table (admin-managed)
CREATE TABLE public.scratch_cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  price NUMERIC NOT NULL DEFAULT 1,
  is_free BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'Destaque',
  badge TEXT,
  vip BOOLEAN NOT NULL DEFAULT false,
  max_prize_label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scratch card prizes table
CREATE TABLE public.scratch_card_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT NOT NULL REFERENCES public.scratch_cards(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  weight NUMERIC NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.scratch_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scratch_card_prizes ENABLE ROW LEVEL SECURITY;

-- Everyone can read active cards
CREATE POLICY "Anyone can view active scratch cards"
ON public.scratch_cards FOR SELECT
USING (active = true);

-- Admins can do everything on scratch_cards
CREATE POLICY "Admins full access scratch cards"
ON public.scratch_cards FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Everyone can read prizes
CREATE POLICY "Anyone can view prizes"
ON public.scratch_card_prizes FOR SELECT
USING (true);

-- Admins can do everything on prizes
CREATE POLICY "Admins full access prizes"
ON public.scratch_card_prizes FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_scratch_cards_updated_at
BEFORE UPDATE ON public.scratch_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial cards
INSERT INTO public.scratch_cards (id, name, price, is_free, category, badge, vip, max_prize_label, description) VALUES
('gratis', 'Raspadinha Grátis 🎁', 0, true, 'Destaque', '🎁 Grátis', false, 'PRÊMIOS ATÉ R$ 50,00', 'Uma raspadinha grátis por dia! Raspe e tente a sorte sem gastar nada.'),
('pix-na-conta', 'PIX na conta', 1, false, 'PIX na conta', '🔥 Popular', true, 'PRÊMIOS ATÉ R$ 2.000,00', 'Raspe e receba prêmios em DINHEIRO até R$2.000 diretamente no seu PIX'),
('sonho-de-consumo', 'Sonho de Consumo 🤩', 2, false, 'Eletrônico', NULL, true, 'PRÊMIOS ATÉ R$ 5.000,00', 'Eletrônicos de alto valor: iPhone, TV, notebook e muito mais!'),
('me-mimei', 'Me mimei', 5, false, 'Cosméticos', NULL, true, 'PRÊMIOS ATÉ R$ 10.000,00', 'Shopee, Shein, presentinhos... é só dar uma raspadinha!'),
('super-premios', 'Super Prêmios', 10, false, 'Veículo', '🏆 Mega', true, 'PRÊMIOS ATÉ R$ 20.000,00', 'Sua chance de sair motorizado! Prêmios de até R$20.000');

-- Seed prizes
INSERT INTO public.scratch_card_prizes (card_id, symbol, label, value, weight, sort_order) VALUES
-- Grátis
('gratis', '💰', 'R$ 50', 50, 1, 1),
('gratis', '💵', 'R$ 10', 10, 2, 2),
('gratis', '💲', 'R$ 2', 2, 5, 3),
('gratis', '🪙', 'R$ 1', 1, 8, 4),
('gratis', '❌', 'Tente novamente', 0, 84, 5),
-- PIX
('pix-na-conta', '💰', 'R$ 2.000', 2000, 1, 1),
('pix-na-conta', '💵', 'R$ 500', 500, 3, 2),
('pix-na-conta', '💸', 'R$ 100', 100, 8, 3),
('pix-na-conta', '🪙', 'R$ 20', 20, 15, 4),
('pix-na-conta', '💲', 'R$ 5', 5, 25, 5),
('pix-na-conta', '❌', 'Tente novamente', 0, 48, 6),
-- Sonho de consumo
('sonho-de-consumo', '📱', 'iPhone 15 Pro', 5000, 1, 1),
('sonho-de-consumo', '💻', 'Notebook', 3000, 2, 2),
('sonho-de-consumo', '🎧', 'AirPods Pro', 1500, 4, 3),
('sonho-de-consumo', '🔊', 'JBL Speaker', 500, 10, 4),
('sonho-de-consumo', '💵', 'R$ 50', 50, 25, 5),
('sonho-de-consumo', '❌', 'Tente novamente', 0, 58, 6),
-- Me mimei
('me-mimei', '👜', 'Kit Premium', 10000, 1, 1),
('me-mimei', '🧴', 'Perfume Import.', 2000, 3, 2),
('me-mimei', '💄', 'Kit Maquiagem', 500, 8, 3),
('me-mimei', '🎁', 'Presente Shein', 100, 15, 4),
('me-mimei', '💵', 'R$ 20', 20, 25, 5),
('me-mimei', '❌', 'Tente novamente', 0, 48, 6),
-- Super Prêmios
('super-premios', '🏍️', 'Moto Honda', 20000, 1, 1),
('super-premios', '🚲', 'Bicicleta Elétrica', 5000, 2, 2),
('super-premios', '📱', 'iPhone 15', 5000, 3, 3),
('super-premios', '💰', 'R$ 1.000', 1000, 8, 4),
('super-premios', '💵', 'R$ 100', 100, 20, 5),
('super-premios', '❌', 'Tente novamente', 0, 66, 6);
