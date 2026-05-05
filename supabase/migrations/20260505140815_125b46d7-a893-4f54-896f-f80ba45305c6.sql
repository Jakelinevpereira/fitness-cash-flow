
-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Add user_id to existing tables
ALTER TABLE public.transactions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Drop public policies and add per-user RLS
DROP POLICY IF EXISTS "public access transactions" ON public.transactions;
DROP POLICY IF EXISTS "public access sales" ON public.sales;
DROP POLICY IF EXISTS "public access products" ON public.products;

CREATE POLICY "own transactions select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own transactions insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transactions update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own transactions delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own sales select" ON public.sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sales insert" ON public.sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sales update" ON public.sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sales delete" ON public.sales FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own products select" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own products insert" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own products update" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own products delete" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- 6. Default user_id to auth.uid() so inserts can omit it
ALTER TABLE public.transactions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.sales ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.products ALTER COLUMN user_id SET DEFAULT auth.uid();
