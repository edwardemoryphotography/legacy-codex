-- Restore public read-only access to the knowledge base.
-- Legacy Codex and the kg viewer sign in anonymously; the owner-only policy
-- from 20260809000100 did not cover them. This matches the documented intent
-- ("documents: verified_public_read_only" in codex-kg-redesign/supabase/project.json).
-- Write access remains denied for all API roles (42501 verified).
grant select on table codex_documents to anon;

drop policy if exists "owner select codex_documents" on codex_documents;

create policy "public read codex_documents" on codex_documents
  for select to anon, authenticated
  using (true);
