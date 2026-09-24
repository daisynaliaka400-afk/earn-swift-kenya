ALTER TABLE public.tasks
  ADD COLUMN action_url text,
  ADD COLUMN instructions text,
  ADD COLUMN sponsor_name text;

ALTER TABLE public.tasks
  ADD CONSTRAINT active_tasks_require_action_url
  CHECK (NOT is_active OR (action_url IS NOT NULL AND action_url ~ '^https://'));

COMMENT ON COLUMN public.tasks.action_url IS 'Verified HTTPS destination where the member performs the task.';
COMMENT ON COLUMN public.tasks.instructions IS 'Concrete completion and proof instructions supplied by the task sponsor.';
COMMENT ON COLUMN public.tasks.sponsor_name IS 'Organization responsible for the task offer.';