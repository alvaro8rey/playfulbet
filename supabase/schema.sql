-- =====================================================
-- PlayfulBet — Supabase SQL Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  points INTEGER NOT NULL DEFAULT 1000,
  total_bets INTEGER NOT NULL DEFAULT 0,
  won_bets INTEGER NOT NULL DEFAULT 0,
  lost_bets INTEGER NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT points_non_negative CHECK (points >= 0)
);

-- Events table
CREATE TYPE IF NOT EXISTS public.sport_type AS ENUM (
  'football', 'tennis', 'basketball', 'baseball', 'volleyball', 'other'
);

CREATE TYPE IF NOT EXISTS public.event_status AS ENUM (
  'pending', 'live', 'finished', 'cancelled'
);

CREATE TYPE IF NOT EXISTS public.bet_result AS ENUM (
  'home', 'draw', 'away'
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sport public.sport_type NOT NULL DEFAULT 'football',
  competition TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_odds DECIMAL(6,2) NOT NULL CHECK (home_odds > 1.0),
  draw_odds DECIMAL(6,2) CHECK (draw_odds > 1.0),
  away_odds DECIMAL(6,2) NOT NULL CHECK (away_odds > 1.0),
  event_date TIMESTAMPTZ NOT NULL,
  status public.event_status NOT NULL DEFAULT 'pending',
  home_score INTEGER,
  away_score INTEGER,
  result public.bet_result,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Bets table
CREATE TYPE IF NOT EXISTS public.bet_status AS ENUM (
  'pending', 'won', 'lost', 'cancelled'
);

CREATE TABLE IF NOT EXISTS public.bets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  prediction public.bet_result NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 10),
  odds DECIMAL(6,2) NOT NULL,
  potential_win INTEGER NOT NULL,
  status public.bet_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMPTZ,

  -- One pending bet per user constraint
  CONSTRAINT one_pending_bet_per_user UNIQUE NULLS NOT DISTINCT (user_id, status)
    DEFERRABLE INITIALLY DEFERRED
);

-- NOTE: The UNIQUE constraint above might be too strict in some PostgreSQL versions.
-- If it causes issues, remove it and rely on application-level validation instead.
-- Alternative: use a partial unique index (see below)

-- Partial unique index: only one pending bet per user
DROP INDEX IF EXISTS idx_one_pending_bet_per_user;
CREATE UNIQUE INDEX idx_one_pending_bet_per_user
  ON public.bets (user_id)
  WHERE status = 'pending';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_event_id ON public.bets(event_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bets(status);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_event_updated
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Anyone can view profiles (for leaderboard)
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- EVENTS POLICIES
-- =====================================================

-- Everyone can view events
CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT
  USING (true);

-- Only admins can create/update/delete events
CREATE POLICY "Admins can manage events"
  ON public.events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- =====================================================
-- BETS POLICIES
-- =====================================================

-- Users can view their own bets
CREATE POLICY "Users can view own bets"
  ON public.bets FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all bets (for resolution)
CREATE POLICY "Admins can view all bets"
  ON public.bets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Users can create their own bets
CREATE POLICY "Users can create own bets"
  ON public.bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update bets (for resolution)
CREATE POLICY "Admins can update bets"
  ON public.bets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- =====================================================
-- ADMIN SETUP
-- =====================================================

-- To make a user admin, run:
-- UPDATE public.profiles SET is_admin = true WHERE username = 'your_username';

-- =====================================================
-- SAMPLE DATA (optional - remove in production)
-- =====================================================

-- Sample events (uncomment to use)
/*
INSERT INTO public.events (sport, competition, home_team, away_team, home_odds, draw_odds, away_odds, event_date, status)
VALUES
  ('football', 'LaLiga', 'Real Madrid', 'FC Barcelona', 2.10, 3.40, 3.50, NOW() + INTERVAL '2 days', 'pending'),
  ('football', 'Premier League', 'Manchester City', 'Arsenal', 1.80, 3.60, 4.50, NOW() + INTERVAL '3 days', 'pending'),
  ('tennis', 'Wimbledon', 'Carlos Alcaraz', 'Novak Djokovic', 1.75, NULL, 2.10, NOW() + INTERVAL '1 day', 'pending'),
  ('basketball', 'NBA', 'Los Angeles Lakers', 'Golden State Warriors', 1.90, NULL, 1.95, NOW() + INTERVAL '4 days', 'pending'),
  ('football', 'Champions League', 'Bayern Munich', 'PSG', 2.20, 3.30, 3.40, NOW() + INTERVAL '5 days', 'pending');
*/
