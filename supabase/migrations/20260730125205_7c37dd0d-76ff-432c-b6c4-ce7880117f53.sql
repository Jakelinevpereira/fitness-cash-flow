
UPDATE public.sales SET product_name = 'Blusa Dryfit', product_id = 'e6bf0c50-a0d0-4290-af09-f823a94029a3'
WHERE product_name ILIKE 'camisa dryfit';

UPDATE public.sales SET product_name = 'Baby Look Dryfit Poliamida', product_id = '21c53af1-6c27-4f95-b85a-5a70ad9d21fa'
WHERE btrim(product_name) ILIKE 'baby look dryfit poliamida';

UPDATE public.sales SET product_name = btrim(product_name) WHERE product_name <> btrim(product_name);
