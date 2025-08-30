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

-- Create a policy that allows everyone to read and insert (but not update/delete)
CREATE POLICY IF NOT EXISTS "Anyone can view high scores" ON high_scores
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Anyone can add high scores" ON high_scores
  FOR INSERT WITH CHECK (true);

-- Create a function to create the table (used as fallback)
CREATE OR REPLACE FUNCTION create_high_scores_table_if_not_exists()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function can be called to ensure the table exists
  -- The table creation is handled above, this is just a placeholder
  NULL;
END;
$$;