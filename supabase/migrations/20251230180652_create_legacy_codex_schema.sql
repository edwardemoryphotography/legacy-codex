/*
  # Legacy Codex Database Schema
  
  This migration creates the core database structure for the Edward Emory Legacy Codex,
  a framework for neurodivergent collaboration with AI.

  ## New Tables
  
  ### `profiles`
  User profiles extending Supabase auth.users
  - `id` (uuid, primary key, references auth.users)
  - `display_name` (text)
  - `bio` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `collaboration_sessions`
  Tracks collaboration sessions using the 7-phase protocol
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `title` (text)
  - `description` (text)
  - `current_phase` (integer, 1-7)
  - `status` (text: active, paused, completed)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `session_phases`
  Records progress through the 7 phases of collaboration
  - `id` (uuid, primary key)
  - `session_id` (uuid, references collaboration_sessions)
  - `phase_number` (integer, 1-7)
  - `phase_name` (text: initial_assumption, challenge, reflection, reframing, clarification, verification, meta_recognition)
  - `content` (text)
  - `notes` (text)
  - `completed` (boolean)
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)
  
  ### `artifacts`
  Stores work products created during sessions
  - `id` (uuid, primary key)
  - `session_id` (uuid, references collaboration_sessions)
  - `user_id` (uuid, references profiles)
  - `title` (text)
  - `type` (text: code, document, diagram, note, framework)
  - `content` (text)
  - `metadata` (jsonb)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `principles`
  Keystone principles that guide the work
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `title` (text)
  - `description` (text)
  - `category` (text: methodology, mindset, practice, value)
  - `order_index` (integer)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `narratives`
  Stories and case studies of successful collaborations
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `session_id` (uuid, references collaboration_sessions, nullable)
  - `title` (text)
  - `content` (text)
  - `tags` (text array)
  - `is_public` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `reflections`
  Meta-recognitions and insights extracted from sessions
  - `id` (uuid, primary key)
  - `session_id` (uuid, references collaboration_sessions)
  - `user_id` (uuid, references profiles)
  - `insight` (text)
  - `context` (text)
  - `tags` (text array)
  - `created_at` (timestamptz)

  ## Security
  
  - Enable RLS on all tables
  - Users can only access their own data
  - Public narratives are readable by authenticated users
  - Strict ownership checks on all operations
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create collaboration_sessions table
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  current_phase integer DEFAULT 1 CHECK (current_phase >= 1 AND current_phase <= 7),
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON collaboration_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON collaboration_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON collaboration_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON collaboration_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create session_phases table
CREATE TABLE IF NOT EXISTS session_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  phase_number integer NOT NULL CHECK (phase_number >= 1 AND phase_number <= 7),
  phase_name text NOT NULL CHECK (phase_name IN ('initial_assumption', 'challenge', 'reflection', 'reframing', 'clarification', 'verification', 'meta_recognition')),
  content text DEFAULT '',
  notes text DEFAULT '',
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session phases"
  ON session_phases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaboration_sessions
      WHERE collaboration_sessions.id = session_phases.session_id
      AND collaboration_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session phases"
  ON session_phases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collaboration_sessions
      WHERE collaboration_sessions.id = session_phases.session_id
      AND collaboration_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own session phases"
  ON session_phases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaboration_sessions
      WHERE collaboration_sessions.id = session_phases.session_id
      AND collaboration_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collaboration_sessions
      WHERE collaboration_sessions.id = session_phases.session_id
      AND collaboration_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own session phases"
  ON session_phases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collaboration_sessions
      WHERE collaboration_sessions.id = session_phases.session_id
      AND collaboration_sessions.user_id = auth.uid()
    )
  );

-- Create artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text DEFAULT 'note' CHECK (type IN ('code', 'document', 'diagram', 'note', 'framework')),
  content text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own artifacts"
  ON artifacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own artifacts"
  ON artifacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own artifacts"
  ON artifacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own artifacts"
  ON artifacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create principles table
CREATE TABLE IF NOT EXISTS principles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT 'practice' CHECK (category IN ('methodology', 'mindset', 'practice', 'value')),
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE principles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own principles"
  ON principles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own principles"
  ON principles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own principles"
  ON principles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own principles"
  ON principles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create narratives table
CREATE TABLE IF NOT EXISTS narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES collaboration_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text DEFAULT '',
  tags text[] DEFAULT ARRAY[]::text[],
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own narratives"
  ON narratives FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view public narratives"
  ON narratives FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can insert own narratives"
  ON narratives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own narratives"
  ON narratives FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own narratives"
  ON narratives FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create reflections table
CREATE TABLE IF NOT EXISTS reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight text NOT NULL,
  context text DEFAULT '',
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reflections"
  ON reflections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflections"
  ON reflections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflections"
  ON reflections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reflections"
  ON reflections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_user_id ON collaboration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_status ON collaboration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_phases_session_id ON session_phases(session_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_session_id ON artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_principles_user_id ON principles(user_id);
CREATE INDEX IF NOT EXISTS idx_narratives_user_id ON narratives(user_id);
CREATE INDEX IF NOT EXISTS idx_narratives_is_public ON narratives(is_public);
CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_session_id ON reflections(session_id);
