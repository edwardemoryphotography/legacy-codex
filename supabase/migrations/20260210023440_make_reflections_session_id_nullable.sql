/*
  # Make reflections.session_id nullable

  1. Modified Tables
    - `reflections`
      - `session_id` changed from NOT NULL to nullable
  
  2. Notes
    - Allows creating reflections without linking to a specific session
    - Existing data is unaffected since the table is currently empty
*/

ALTER TABLE reflections ALTER COLUMN session_id DROP NOT NULL;
