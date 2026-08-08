-- Allow the Foundry Console routing page to enrich routed requests and
-- evidence items with their linked Control Panel actions.
-- The actions table had RLS enabled with no policies, silently hiding
-- linked-action context from the owner console.
create policy "owner select actions" on actions
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'freddyv@duck.com');
