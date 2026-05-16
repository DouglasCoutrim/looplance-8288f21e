ALTER TABLE public.global_replays REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_replays;