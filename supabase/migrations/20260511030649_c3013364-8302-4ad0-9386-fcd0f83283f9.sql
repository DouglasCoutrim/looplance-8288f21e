CREATE OR REPLACE VIEW public.arena_button_camera_map AS
SELECT
  ab.arena_id,
  ab.hardware_pin AS pino,
  ab.camera_id,
  c.rtsp_url AS rtsp,
  c.name AS camera_name,
  ab.label AS button_label,
  ab.button_number
FROM public.arena_buttons ab
LEFT JOIN public.cameras c ON c.id = ab.camera_id
WHERE ab.hardware_pin IS NOT NULL;

ALTER VIEW public.arena_button_camera_map SET (security_invoker = true);

GRANT SELECT ON public.arena_button_camera_map TO authenticated;