-- ============================================================
-- DishLens Database Schema
-- Supabase PostgreSQL
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. profiles (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  avatar_url  text,
  preferred_lang text not null default 'zh',
  dietary_tags text[] not null default '{}',
  allergens    text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', '食客'), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. dishes
-- ============================================================
create table if not exists public.dishes (
  id              uuid primary key default gen_random_uuid(),
  name_original   text not null,
  name_translated jsonb not null default '{}',   -- { "zh": "xx", "en": "xx" }
  description     jsonb not null default '{}',
  ingredients     text[] not null default '{}',
  allergens       text[] not null default '{}',
  taste_profile   text[] not null default '{}',
  cuisine_region  text,
  category        text,  -- appetizer | main | dessert | drink
  ai_image_url    text,
  image_source    text not null default 'ai',  -- ai | user | mixed
  rating_avg      numeric(2,1) check (rating_avg >= 0 and rating_avg <= 5),
  review_count    int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_dishes_name_original on dishes (name_original);
create index if not exists idx_dishes_category on dishes (category);

-- ============================================================
-- 3. dish_images
-- ============================================================
create table if not exists public.dish_images (
  id          uuid primary key default gen_random_uuid(),
  dish_id     uuid not null references public.dishes(id) on delete cascade,
  url         text not null,
  source      text not null default 'ai',  -- ai | user
  width       int,
  height      int,
  created_at  timestamptz not null default now()
);

create index if not exists idx_dish_images_dish_id on dish_images (dish_id);

-- ============================================================
-- 4. restaurants
-- ============================================================
create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  country     text,
  coordinates geography(point, 4326),
  created_at  timestamptz not null default now()
);

create index if not exists idx_restaurants_name on restaurants (name);

-- ============================================================
-- 5. translations (history)
-- ============================================================
create table if not exists public.translations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  image_hashes  text[] not null default '{}',
  photo_count   int not null default 1,
  source_lang   text not null default 'unknown',
  target_lang   text not null default 'zh',
  dish_count    int not null default 0,
  page_count    int not null default 1,
  status        text not null default 'done',  -- done | partial | failed
  result_json   jsonb,
  city          text,
  restaurant_name text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_translations_user_id on translations (user_id);
create index if not exists idx_translations_created_at on translations (created_at desc);

-- ============================================================
-- 6. reviews
-- ============================================================
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dish_id       uuid not null references public.dishes(id) on delete cascade,
  rating        int not null check (rating >= 1 and rating <= 5),
  content       text not null check (char_length(content) between 10 and 500),
  photos        text[] not null default '{}',
  lang          text not null default 'zh',
  helpful_count int not null default 0,
  created_at    timestamptz not null default now(),
  unique(user_id, dish_id)  -- one review per user per dish
);

create index if not exists idx_reviews_dish_id on reviews (dish_id);
create index if not exists idx_reviews_user_id on reviews (user_id);
create index if not exists idx_reviews_created_at on reviews (created_at desc);

-- Trigger: update dish rating_avg and review_count on review insert/update/delete
create or replace function public.update_dish_rating()
returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    update dishes set
      rating_avg = (select coalesce(round(avg(rating)::numeric, 1), 0) from reviews where dish_id = old.dish_id),
      review_count = (select count(*) from reviews where dish_id = old.dish_id)
    where id = old.dish_id;
    return old;
  else
    update dishes set
      rating_avg = (select coalesce(round(avg(rating)::numeric, 1), 0) from reviews where dish_id = new.dish_id),
      review_count = (select count(*) from reviews where dish_id = new.dish_id)
    where id = new.dish_id;
    return new;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_change on reviews;
create trigger on_review_change
  after insert or update or delete on reviews
  for each row execute function update_dish_rating();

-- ============================================================
-- 7. user_favorites
-- ============================================================
create table if not exists public.user_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dish_id     uuid not null references public.dishes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(user_id, dish_id)
);

create index if not exists idx_user_favorites_user_id on user_favorites (user_id);

-- ============================================================
-- 8. review_votes (helpful / not-helpful)
-- ============================================================
create table if not exists public.review_votes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  review_id   uuid not null references public.reviews(id) on delete cascade,
  vote        int not null check (vote in (-1, 1)),  -- 1 = helpful, -1 = not helpful
  created_at  timestamptz not null default now(),
  unique(user_id, review_id)
);

create index if not exists idx_review_votes_review_id on review_votes (review_id);

-- Trigger: update review helpful_count on vote
create or replace function public.update_review_helpful()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update reviews set helpful_count = helpful_count + new.vote
    where id = new.review_id;
  elsif (tg_op = 'DELETE') then
    update reviews set helpful_count = helpful_count - old.vote
    where id = old.review_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_vote on review_votes;
create trigger on_review_vote
  after insert or delete on review_votes
  for each row execute function update_review_helpful();

-- ============================================================
-- Row Level Security
-- ============================================================

-- profiles: users can read all, update only own
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on profiles;
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- dishes: anyone can read, authenticated can insert
alter table public.dishes enable row level security;

drop policy if exists "Dishes are viewable by everyone" on dishes;
create policy "Dishes are viewable by everyone"
  on dishes for select using (true);

drop policy if exists "Authenticated users can insert dishes" on dishes;
create policy "Authenticated users can insert dishes"
  on dishes for insert with check (auth.role() = 'authenticated');

-- dish_images: anyone can read, authenticated can insert
alter table public.dish_images enable row level security;

drop policy if exists "Dish images are viewable by everyone" on dish_images;
create policy "Dish images are viewable by everyone"
  on dish_images for select using (true);

drop policy if exists "Authenticated users can insert dish images" on dish_images;
create policy "Authenticated users can insert dish images"
  on dish_images for insert with check (auth.role() = 'authenticated');

-- restaurants: anyone can read, authenticated can insert
alter table public.restaurants enable row level security;

drop policy if exists "Restaurants are viewable by everyone" on restaurants;
create policy "Restaurants are viewable by everyone"
  on restaurants for select using (true);

drop policy if exists "Authenticated users can insert restaurants" on restaurants;
create policy "Authenticated users can insert restaurants"
  on restaurants for insert with check (auth.role() = 'authenticated');

-- translations: users see own only
alter table public.translations enable row level security;

drop policy if exists "Users can view own translations" on translations;
create policy "Users can view own translations"
  on translations for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own translations" on translations;
create policy "Users can insert own translations"
  on translations for insert with check (auth.uid() = user_id);

-- reviews: anyone can read, authenticated can CRUD own
alter table public.reviews enable row level security;

drop policy if exists "Reviews are viewable by everyone" on reviews;
create policy "Reviews are viewable by everyone"
  on reviews for select using (true);

drop policy if exists "Users can insert own review" on reviews;
create policy "Users can insert own review"
  on reviews for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own review" on reviews;
create policy "Users can update own review"
  on reviews for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own review" on reviews;
create policy "Users can delete own review"
  on reviews for delete using (auth.uid() = user_id);

-- user_favorites: users see/manage own only
alter table public.user_favorites enable row level security;

drop policy if exists "Users can view own favorites" on user_favorites;
create policy "Users can view own favorites"
  on user_favorites for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own favorites" on user_favorites;
create policy "Users can insert own favorites"
  on user_favorites for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own favorites" on user_favorites;
create policy "Users can delete own favorites"
  on user_favorites for delete using (auth.uid() = user_id);

-- review_votes: authenticated can vote
alter table public.review_votes enable row level security;

drop policy if exists "Users can manage own votes" on review_votes;
create policy "Users can manage own votes"
  on review_votes for all using (auth.uid() = user_id);
