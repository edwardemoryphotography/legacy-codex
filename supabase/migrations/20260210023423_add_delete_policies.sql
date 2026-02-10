/*
  # Add DELETE policies for all user-owned tables

  1. Security Changes
    - Add DELETE policy on `collaboration_sessions` for owners
    - Add DELETE policy on `session_phases` for session owners
    - Add DELETE policy on `artifacts` for owners
    - Add DELETE policy on `principles` for owners
    - Add DELETE policy on `narratives` for owners
    - Add DELETE policy on `reflections` for owners

  2. Notes
    - All delete policies require authentication and ownership verification
    - Session phases deletion checks ownership through the parent session
    - Cascade deletes on session_phases are handled by foreign key ON DELETE CASCADE
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own sessions'
  ) THEN
    CREATE POLICY "Users can delete own sessions"
      ON collaboration_sessions FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own session phases'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own artifacts'
  ) THEN
    CREATE POLICY "Users can delete own artifacts"
      ON artifacts FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own principles'
  ) THEN
    CREATE POLICY "Users can delete own principles"
      ON principles FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own narratives'
  ) THEN
    CREATE POLICY "Users can delete own narratives"
      ON narratives FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own reflections'
  ) THEN
    CREATE POLICY "Users can delete own reflections"
      ON reflections FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
