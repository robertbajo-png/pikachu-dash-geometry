# Supabase Setup Guide för Cross-Platform High Scores

## Steg 1: Skapa Supabase Project
1. Gå till [supabase.com](https://supabase.com) och skapa ett konto
2. Skapa ett nytt projekt
3. Kopiera din Project URL och anon public key från Settings > API

## Steg 2: Konfigurera Environment Variables
Skapa en `.env.local` fil i projektets root och lägg till:

```env
VITE_SUPABASE_URL=ditt-supabase-url-här
VITE_SUPABASE_ANON_KEY=din-anon-key-här
```

## Steg 3: Skapa Databas Table
Kör följande SQL i Supabase SQL Editor:

```sql
-- Create the high_scores table
CREATE TABLE IF NOT EXISTS high_scores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(10) NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);

-- Enable Row Level Security (optional)
ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;

-- Create policies that allow everyone to read and insert
CREATE POLICY IF NOT EXISTS "Anyone can view high scores" ON high_scores
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Anyone can add high scores" ON high_scores
  FOR INSERT WITH CHECK (true);
```

## Steg 4: Test
Starta applikationen och testa att lägga till high scores. De ska nu sparas i Supabase och visas på alla enheter!

## Fallback Behavior
Om Supabase inte är konfigurerat eller inte fungerar kommer spelet att fortsätta använda localStorage som backup.

## Säkerhet
- Row Level Security är aktiverat
- Endast läsning och insättning är tillåtet
- Inga känsliga data exponeras