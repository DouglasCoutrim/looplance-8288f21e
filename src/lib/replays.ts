// URL base do bucket público `replays` no projeto Supabase externo
// usado pelo pipeline Python para gravar os MP4s finais.
export const REPLAYS_BASE_URL =
  "https://htirxluqufyexmpuhhbt.supabase.co/storage/v1/object/public/replays/";

/**
 * Aceita tanto URL absoluta quanto apenas o nome do arquivo
 * (ex: "replay_quadra_1_1778428122.mp4") e devolve a URL pública final.
 */
export function resolveReplayUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return REPLAYS_BASE_URL + value.replace(/^\/+/, "");
}
