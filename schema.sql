
-- SCRIPT DE CORRECTION ET D'INITIALISATION COMPLET

-- 1. Types & Extensions
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'supplier');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Table Profiles (Avec politique d'auto-création)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role user_role DEFAULT 'user' NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  preferred_currency TEXT DEFAULT 'USD',
  is_verified_supplier BOOLEAN DEFAULT false NOT NULL, 
  payment_status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table Products (Avec FK explicite)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(15,2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL, 
  image_url TEXT,
  supplier_id UUID NOT NULL, -- FK ajoutée explicitement plus bas
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  moq INTEGER DEFAULT 1 CHECK (moq >= 1),
  likes_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Gestion explicite de la FK pour éviter l'erreur "more than one relationship"
DO $$ BEGIN
  ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_supplier_id_fkey;
  ALTER TABLE public.products ADD CONSTRAINT products_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN null; END $$;

-- 4. Autres Tables
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MODIFICATION: Ajout des colonnes pour le support Multimédia
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  type TEXT DEFAULT 'text',     -- Pour gérer 'image', 'file', 'call_log'
  file_url TEXT,                -- URL du fichier Supabase Storage
  file_name TEXT,               -- Nom original du fichier
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- *** MIGRATION DE SECOURS *** 
-- Si la table existe déjà sans les colonnes, ceci les ajoutera
DO $$ BEGIN
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url TEXT;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name TEXT;
EXCEPTION WHEN others THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  total_amount NUMERIC(15,2) NOT NULL,
  status order_status DEFAULT 'pending' NOT NULL,
  shipping_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. STORAGE (Création Bucket & Policies)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-uploads', 'chat-uploads', true) 
ON CONFLICT (id) DO NOTHING;

-- Policies Storage (Permettre l'upload aux authentifiés)
DROP POLICY IF EXISTS "Public Access Products" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Products" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete Products" ON storage.objects;
CREATE POLICY "Public Access Products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Auth Upload Products" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Delete Products" ON storage.objects FOR DELETE USING (bucket_id = 'products' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Public Access Chats" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Chats" ON storage.objects;
CREATE POLICY "Public Access Chats" ON storage.objects FOR SELECT USING (bucket_id = 'chat-uploads');
CREATE POLICY "Auth Upload Chats" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-uploads' AND auth.role() = 'authenticated');

INSERT INTO storage.buckets (id, name, public) 
VALUES ('id-cards', 'id-cards', false) 
ON CONFLICT (id) DO NOTHING;

-- Policies Storage for ID Cards
DROP POLICY IF EXISTS "Auth Upload ID Cards" ON storage.objects;
DROP POLICY IF EXISTS "Admin Access ID Cards" ON storage.objects;
CREATE POLICY "Auth Upload ID Cards" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'id-cards' AND auth.role() = 'authenticated');
CREATE POLICY "Admin Access ID Cards" ON storage.objects FOR SELECT USING (bucket_id = 'id-cards' AND (auth.uid() = owner OR auth.jwt()->>'email' = 'irmerveilkanku@gmail.com'));

-- 6. Sécurité (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  id_card_url TEXT,
  status TEXT DEFAULT 'pending_id', -- 'pending_id', 'pending_admin', 'pending_payment', 'completed', 'rejected'
  payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own requests" ON public.verification_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own requests" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own requests" ON public.verification_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin can see all requests" ON public.verification_requests FOR SELECT USING (auth.jwt()->>'email' = 'irmerveilkanku@gmail.com');
CREATE POLICY "Admin can update all requests" ON public.verification_requests FOR UPDATE USING (auth.jwt()->>'email' = 'irmerveilkanku@gmail.com');

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reported_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- User being reported
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, -- Optional product context
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can see their own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admin can manage reports" ON public.reports FOR ALL USING (auth.jwt()->>'email' = 'irmerveilkanku@gmail.com');

-- Politiques PROFILES
DROP POLICY IF EXISTS "Lecture publique des profils" ON public.profiles;
CREATE POLICY "Lecture publique des profils" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Modification propre profil" ON public.profiles;
CREATE POLICY "Modification propre profil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Creation propre profil" ON public.profiles;
CREATE POLICY "Creation propre profil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Politiques PRODUCTS
DROP POLICY IF EXISTS "Lecture publique des produits" ON public.products;
CREATE POLICY "Lecture publique des produits" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Fournisseurs insert" ON public.products;
CREATE POLICY "Fournisseurs insert" ON public.products FOR INSERT WITH CHECK (auth.uid() = supplier_id);
DROP POLICY IF EXISTS "Fournisseurs update" ON public.products;
CREATE POLICY "Fournisseurs update" ON public.products FOR UPDATE USING (auth.uid() = supplier_id);
DROP POLICY IF EXISTS "Fournisseurs delete" ON public.products;
CREATE POLICY "Fournisseurs delete" ON public.products FOR DELETE USING (auth.uid() = supplier_id);

-- Politiques MESSAGES
DROP POLICY IF EXISTS "Lecture messages" ON public.messages;
CREATE POLICY "Lecture messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Envoi messages" ON public.messages;
CREATE POLICY "Envoi messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Politiques ORDERS
DROP POLICY IF EXISTS "Lecture commandes" ON public.orders;
CREATE POLICY "Lecture commandes" ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() IN (SELECT supplier_id FROM products WHERE id = product_id));
DROP POLICY IF EXISTS "Creation commandes" ON public.orders;
CREATE POLICY "Creation commandes" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Maj commandes fournisseur" ON public.orders;
CREATE POLICY "Maj commandes fournisseur" ON public.orders FOR UPDATE USING (auth.uid() IN (SELECT supplier_id FROM products WHERE id = product_id));

-- 7. Trigger Auto-Creation Profil (Fallback)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
  target_role public.user_role;
  is_verified boolean;
  stale_profile_id UUID;
BEGIN
  -- 1. Username generation
  base_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  
  IF base_username IS NULL OR length(trim(base_username)) < 2 THEN
    base_username := 'user_' || substr(new.id::text, 1, 8);
  END IF;
  
  final_username := base_username;

  -- 2. Ensure username uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) AND counter < 100 LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;

  -- 3. Role extraction
  BEGIN
    target_role := (new.raw_user_meta_data->>'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    target_role := 'user';
  END;

  -- 4. Verification status
  BEGIN
    IF new.raw_user_meta_data->>'is_verified_supplier' IS NOT NULL THEN
      is_verified := (new.raw_user_meta_data->>'is_verified_supplier')::boolean;
    ELSE
      is_verified := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    is_verified := NULL;
  END;

  IF is_verified IS NULL THEN
    IF new.email = 'irmerveilkanku@gmail.com' THEN
      is_verified := true;
    ELSIF target_role = 'supplier' THEN
      is_verified := false;
    ELSE
      is_verified := true;
    END IF;
  END IF;

  -- 5. Cleanup stale profiles (if email exists but ID is different)
  -- This prevents unique constraint violation on email
  BEGIN
    SELECT id INTO stale_profile_id FROM public.profiles WHERE email = new.email AND id != new.id;
    IF stale_profile_id IS NOT NULL THEN
      DELETE FROM public.profiles WHERE id = stale_profile_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore delete errors, proceed to insert
    NULL;
  END;

  -- 6. Insert Profile
  INSERT INTO public.profiles (
    id, 
    username, 
    email, 
    country, 
    city, 
    address, 
    role, 
    is_verified_supplier,
    preferred_currency
  )
  VALUES (
    new.id, 
    final_username, 
    COALESCE(new.email, 'no-email@tradehub.com'), 
    COALESCE(new.raw_user_meta_data->>'country', 'RDC'), 
    COALESCE(new.raw_user_meta_data->>'city', 'Kinshasa'), 
    COALESCE(new.raw_user_meta_data->>'address', 'Non spécifiée'),
    target_role,
    is_verified,
    COALESCE(new.raw_user_meta_data->>'preferred_currency', 'USD')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
    address = EXCLUDED.address,
    role = EXCLUDED.role,
    is_verified_supplier = EXCLUDED.is_verified_supplier,
    preferred_currency = EXCLUDED.preferred_currency,
    updated_at = timezone('utc'::text, now());
    
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- En cas d'erreur fatale dans le trigger, on essaie au moins de retourner NEW
  -- pour ne pas bloquer la création de l'utilisateur dans auth.users
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'order', 'message', 'product'
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- 8. FONCTION POUR RÉCUPÉRER LES CONVERSATIONS (ESSENTIEL POUR LE CHAT)
DROP FUNCTION IF EXISTS get_user_conversations(UUID);

CREATE OR REPLACE FUNCTION get_user_conversations(current_user_id UUID)
RETURNS TABLE (
    partner_id UUID,
    username TEXT,
    avatar_url TEXT,
    is_online BOOLEAN,
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH unique_partners AS (
        SELECT DISTINCT 
            CASE WHEN sender_id = current_user_id THEN receiver_id ELSE sender_id END as pid
        FROM messages
        WHERE sender_id = current_user_id OR receiver_id = current_user_id
    ),
    last_msgs AS (
        SELECT DISTINCT ON (
            CASE WHEN sender_id = current_user_id THEN receiver_id ELSE sender_id END
        )
            CASE WHEN sender_id = current_user_id THEN receiver_id ELSE sender_id END as pid,
            text,
            created_at
        FROM messages
        WHERE sender_id = current_user_id OR receiver_id = current_user_id
        ORDER BY 
            CASE WHEN sender_id = current_user_id THEN receiver_id ELSE sender_id END,
            created_at DESC
    )
    SELECT 
        p.id as partner_id,
        p.username,
        p.avatar_url,
        true as is_online, -- Placeholder pour le statut en ligne
        lm.text as last_message,
        lm.created_at as last_message_time
    FROM unique_partners up
    JOIN profiles p ON p.id = up.pid
    LEFT JOIN last_msgs lm ON lm.pid = up.pid
    ORDER BY lm.created_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
