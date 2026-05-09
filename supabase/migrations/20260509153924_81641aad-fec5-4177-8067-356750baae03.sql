ALTER TABLE public.products ADD COLUMN IF NOT EXISTS initial_stock integer NOT NULL DEFAULT 0;
UPDATE public.products SET initial_stock = stock WHERE initial_stock = 0;