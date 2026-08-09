-- codex_documents had RLS on with zero policies and no grants, so the
-- knowledge base was unreadable through the API for every role — including
-- the Foundry Console milestones page (knowledge signals silently absent).
-- Owner-only read, consistent with the rest of the console tables.
grant select on table codex_documents to authenticated;

create policy "owner select codex_documents" on codex_documents
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');
