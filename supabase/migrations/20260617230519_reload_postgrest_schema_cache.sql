-- Reload PostgREST schema cache so newly added columns (user_id, updated_at) are recognized
NOTIFY pgrst, 'reload schema';
