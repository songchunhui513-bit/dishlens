-- DishLens Supabase Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- Requires: RLS enabled, auth.users table exists (built-in)

-- ── Profiles (extends auth.users) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '食客',
  avatar_url TEXT,
  preferred_lang TEXT DEFAULT 'zh',
  dietary_tags TEXT[] DEFAULT '{}',
  allergens TEXT[] DEFAULT '{}',
  ui_lang TEXT DEFAULT 'zh',
  show_allergens BOOLEAN DEFAULT false,
  show_veg BOOLEAN DEFAULT false,
  show_gluten_free BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', '食客'), NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── Restaurants ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_zh TEXT,
  city TEXT,
  cuisine_type TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read restaurants" ON public.restaurants FOR SELECT USING (true);

-- ── Dishes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_original TEXT NOT NULL,
  name_translated JSONB NOT NULL DEFAULT '{}',
  description JSONB NOT NULL DEFAULT '{}',
  ingredients TEXT[] DEFAULT '{}',
  allergens TEXT[] DEFAULT '{}',
  taste_profile TEXT[] DEFAULT '{}',
  confidence REAL DEFAULT 0.5,
  source_language TEXT DEFAULT 'en',
  restaurant_id UUID REFERENCES public.restaurants(id),
  ai_image_url TEXT,
  image_source TEXT DEFAULT 'ai',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dishes_name_original ON public.dishes(name_original);
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read dishes" ON public.dishes FOR SELECT USING (true);

-- ── Dish Images ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dish_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source TEXT DEFAULT 'ai',
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dish_images_dish ON public.dish_images(dish_id);
ALTER TABLE public.dish_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read dish images" ON public.dish_images FOR SELECT USING (true);

-- ── Reviews ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  lang TEXT DEFAULT 'zh',
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_dish ON public.reviews(dish_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);

-- ── Review Votes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can vote" ON public.review_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read votes" ON public.review_votes FOR SELECT USING (true);

-- ── Translations (history) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_name TEXT DEFAULT 'Unknown Restaurant',
  city TEXT,
  image_hashes TEXT[] DEFAULT '{}',
  photo_count INTEGER DEFAULT 1,
  source_lang TEXT DEFAULT 'unknown',
  target_lang TEXT DEFAULT 'zh',
  dish_count INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'done',
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_translations_user ON public.translations(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_created ON public.translations(created_at DESC);
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own translations" ON public.translations FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Authenticated users can create translations" ON public.translations FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── User Favorites ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dish_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.user_favorites(user_id);
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own favorites" ON public.user_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create favorites" ON public.user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.user_favorites FOR DELETE USING (auth.uid() = user_id);
