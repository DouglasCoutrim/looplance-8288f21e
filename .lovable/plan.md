
# Prompt técnico para o Claude — Backend Python local da arena

Copie TUDO o que está dentro do bloco abaixo (entre as linhas `===PROMPT START===` e `===PROMPT END===`) e cole no Claude. Esse prompt está sincronizado com o schema atual do Supabase do Lovable Cloud e com os componentes do frontend (Carrossel, Player, Painel Admin, editor de crop em `replay_jobs`).

---

===PROMPT START===

Você é um engenheiro Python sênior. Construa um **backend local que roda dentro de cada arena**, em um mini-PC conectado a câmeras IP (RTSP) e a uma placa Zero Delay USB ARC-968 (12 botões físicos). O frontend (web app Lovable + TanStack Start) e o banco central (Supabase/Lovable Cloud) já estão prontos. Você NÃO pode alterar o schema. Apenas LÊ configuração e INSERE replays.

Entregue o código separado em arquivos, todo comentado em **português**:

```
agent/
  main.py
  config.py
  supabase_client.py
  board.py
  recorder.py
  clipper.py
  overlay.py            # moldura de patrocinadores
  uploader.py
  jobs_worker.py        # consome a fila de replay_jobs (crop manual do frontend)
  realtime.py           # escuta mudanças no Supabase central
  health.py             # FastAPI /health e /status
  requirements.txt
  .env.example
  systemd/looplance-agent.service
  README.md
```

## Stack
- Python 3.11+
- `ffmpeg` (subprocess) para gravação contínua, recorte, crop e overlay PNG
- `supabase-py` v2 para Supabase **central** (Lovable Cloud) E Supabase **local** da arena
- `pyserial` + `hid` (escolha em runtime via env `BOARD_DRIVER=serial|hid`)
- `python-dotenv`, `httpx`, `loguru`, `pydantic` v2, `fastapi`, `uvicorn`

## .env
```
ARENA_ID=<uuid da arena>
CENTRAL_SUPABASE_URL=https://tylsafugcyeezpbomcfe.supabase.co
CENTRAL_SUPABASE_SERVICE_KEY=<service role do Lovable Cloud>
RECORDINGS_DIR=/var/lib/looplance/recordings
SEGMENT_SECONDS=10
REPLAY_SECONDS=30
BOARD_DRIVER=serial
BOARD_PORT=auto
SPONSOR_FRAME_PATH=/etc/looplance/sponsor_frame.png   # opcional, alpha PNG 1080x1920
LOG_LEVEL=INFO
HEALTH_PORT=8088
```

## Schema EXATO do Supabase central (Lovable Cloud) — não alterar

> Todas as tabelas estão no schema `public`. Não há FKs explícitas — relacionamentos são por convenção via `arena_id`, `court_id`, `camera_id`, `button_id`, `board_id`.

### `arenas`
`id uuid PK`, `name text`, `slug text`, `logo_url text`, `primary_color text`,
`owner_id uuid`, `active bool`, `city text`, `state text`,
`supabase_url text`, `supabase_service_key text`, `supabase_anon_key text`,
`videos_bucket text default 'replays'`, `retention_days int`, `created_at timestamptz`.

→ O agente lê a linha `WHERE id = ARENA_ID` para descobrir:
- `supabase_url` + `supabase_service_key` → cliente Supabase **LOCAL da arena** (onde os MP4 são salvos)
- `videos_bucket` → bucket onde fazer upload (padrão `replays`)
- `retention_days` → informativo; a limpeza é feita pelo Lovable via cron, o agente não apaga nada do bucket

### `zero_delay_boards`
`id uuid PK`, `arena_id uuid`, `name text`, `serial text`, `model text default 'ARC-968'`.

### `arena_buttons`
`id uuid PK`, `arena_id uuid`, `board_id uuid`, `button_number int`,
`hardware_pin text` (valores: `K1,K2,K3,K4,L2,R2,L1,R1,SE,ST,K11,K12`),
`label text`, `camera_id uuid` (FK lógica → `cameras.id`).

→ Mapeamento físico: `hardware_pin -> camera_id`.

### `cameras`
`id uuid PK`, `arena_id uuid`, `name text`, `rtsp_url text`, `button_id uuid` (FK lógica → `arena_buttons.id`).

### `courts`
`id uuid PK`, `arena_id uuid`, `name text`, `qr_token text`.

### `court_cameras`
`id uuid PK`, `arena_id uuid`, `court_id uuid`, `camera_id uuid`.
→ Use o **primeiro vínculo** `WHERE camera_id = X` para descobrir `court_id` ao salvar o replay.

### `videos` — INSERT obrigatório a cada replay
Campos: `id uuid default gen_random_uuid()`, `arena_id uuid NOT NULL`,
`court_id uuid NULL`, `title text NOT NULL`, `video_url text NOT NULL`,
`thumbnail_url text NULL`, `duration_seconds int NULL`, `uploaded_by uuid NULL`,
`created_at timestamptz default now()`.

→ Há uma trigger `sync_global_replay` que já espelha automaticamente para `global_replays` (feed público). Você **não escreve** em `global_replays`.

### `replay_jobs` — fila de cortes manuais feitos pelo usuário no frontend
Campos relevantes para o worker:
`id uuid`, `user_id uuid`, `arena_id uuid`,
`source_video_id uuid NULL`, `source_video_url text NULL`,
`status text default 'pending'` (use: `pending` → `processing` → `done` | `error`),
`aspect_ratio text default '9:16'`,
`start_time numeric NULL`, `end_time numeric NULL`,
`timestamp_inicio numeric default 0`, `duracao_segundos int default 30`,
`crop_x numeric default 0`, `crop_y numeric default 0`,
`crop_w numeric default 1`, `crop_h numeric default 1`,
`coords_json jsonb NULL`,
`output_url text NULL`, `thumbnail_url text NULL`,
`created_at`, `updated_at`.

**Formato das coordenadas de crop (enviado pelo frontend):**
- `crop_x`, `crop_y`, `crop_w`, `crop_h` são **NORMALIZADOS (0..1)** relativos ao vídeo original.
- Conversão para ffmpeg (vídeo W×H em pixels):
  `x = round(crop_x * W)`, `y = round(crop_y * H)`,
  `w = round(crop_w * W)`, `h = round(crop_h * H)`
  → filtro: `crop=w:h:x:y`
- `aspect_ratio` é `"9:16"` (vertical, padrão) ou `"16:9"`. Após o crop, escale/pad para essa proporção mantendo a área cortada centralizada.
- `start_time`/`end_time` (segundos, com decimais) têm prioridade sobre `timestamp_inicio`/`duracao_segundos`. Se ambos `NULL`, use `timestamp_inicio` + `duracao_segundos`.
- `coords_json` é opcional/debug — ignore se já tiver os campos numéricos.

## Bucket de mídia — padrão obrigatório

Os MP4 e thumbs vão para o **Supabase LOCAL da arena**, no bucket `videos_bucket` (default `replays`), que é **público**.

- Caminho do arquivo dentro do bucket:
  `<court_id ou "sem-quadra">/<yyyy>/<mm>/<dd>/<uuid>.mp4`
  thumb: `<court_id ou "sem-quadra">/<yyyy>/<mm>/<dd>/<uuid>_thumb.jpg`
- URL pública final = `{supabase_url}/storage/v1/object/public/{videos_bucket}/{path}`
- **Grave a URL pública COMPLETA** em `videos.video_url` e `videos.thumbnail_url`.
  (O frontend tem um helper `resolveReplayUrl` que aceita URL absoluta OU só o nome do arquivo — mas sempre prefira URL absoluta para evitar ambiguidade entre buckets de arenas diferentes.)

## Fluxo principal — botão físico → replay

1. **Boot**: usando `CENTRAL_SUPABASE_SERVICE_KEY`, leia a arena (`WHERE id = ARENA_ID`), as `zero_delay_boards`, `arena_buttons`, `cameras`, `courts`, `court_cameras`. Monte em memória:
   - `pin_to_camera: dict[str, {camera_id, rtsp_url, court_id}]`
2. **Recorder (`recorder.py`)**: para CADA câmera, um subprocesso ffmpeg que grava continuamente em segmentos de `SEGMENT_SECONDS` em `RECORDINGS_DIR/<camera_id>/seg-%Y%m%d-%H%M%S.mp4`. Manter no máx `ceil(REPLAY_SECONDS/SEGMENT_SECONDS) + 2` segmentos (apagar o resto). Reiniciar com backoff exponencial se a RTSP cair.
3. **Board (`board.py`)**: thread escutando a ARC-968.
   - `SerialBoard`: 9600 8N1, lê linhas tipo `"K1\n"`.
   - `HidBoard`: lib `hid`, mapeia bits do report para os 12 pinos.
   - Emite `on_press(hardware_pin)` em rising-edge com **debounce 800ms por pino**.
4. **Clipper (`clipper.py`)**: ao receber o pino:
   - Resolva `camera_id` via `pin_to_camera`.
   - Concatene os últimos N segmentos cobrindo `REPLAY_SECONDS` (`ffmpeg -f concat`).
   - Recorte exatamente os últimos 30s: `-sseof -30 -t 30 -c copy` (fallback re-encode se `-c copy` falhar).
   - Aplique a **moldura de patrocinadores** se `SPONSOR_FRAME_PATH` existir:
     `ffmpeg -i clip.mp4 -i sponsor.png -filter_complex "[0:v][1:v]overlay=0:0" -c:a copy out.mp4`
   - Gere thumbnail: `ffmpeg -ss 1 -vframes 1 thumb.jpg`.
5. **Uploader (`uploader.py`)**:
   - Cliente Supabase com `arena.supabase_url` + `arena.supabase_service_key`.
   - Upload `out.mp4` + `thumb.jpg` no caminho do padrão acima. Content-Type correto.
   - Retry 3x com backoff. Se falhar, mova para `RECORDINGS_DIR/_pending/` e retente em background a cada 60s.
6. **Registrar replay**: INSERT no Supabase **central** em `videos`:
   ```json
   {
     "arena_id": "<ARENA_ID>",
     "court_id": "<court_id ou null>",
     "title": "Replay <camera.name> <HH:MM:SS>",
     "video_url": "<URL pública completa do MP4>",
     "thumbnail_url": "<URL pública completa da thumb>",
     "duration_seconds": 30
   }
   ```
   A trigger `sync_global_replay` faz o feed global aparecer automaticamente.

## Worker da fila `replay_jobs` (cortes manuais do frontend)

`jobs_worker.py` deve:
- Em loop (poll a cada 5s) OU via Realtime (preferido — veja seção abaixo), buscar `replay_jobs WHERE arena_id = ARENA_ID AND status = 'pending'`.
- Atualizar para `status='processing'` (UPDATE no central via service key).
- Baixar `source_video_url` (URL pública do bucket).
- Aplicar:
  - Trim: `-ss start_time -to end_time` (ou `-ss timestamp_inicio -t duracao_segundos`).
  - Crop: converter `crop_x,y,w,h` (0..1) para pixels usando `ffprobe` para obter W×H. Filtro: `crop=w:h:x:y`.
  - Aspect ratio: após o crop, `scale=...,pad=...` para 9:16 ou 16:9 mantendo o conteúdo centralizado, sem distorcer.
  - Re-encode H.264 `+faststart`.
- Upload do resultado no MESMO bucket da arena (mesmo padrão de path do fluxo automático).
- Atualizar a linha: `status='done'`, `output_url=<URL pública>`, `thumbnail_url=<URL pública>`, `updated_at=now()`.
- Em erro, `status='error'` e logue o motivo (NÃO grave segredos).

## Realtime — o que o agente DEVE escutar

Use Supabase Realtime no cliente central. Canais e ações:

1. **`arena_buttons` / `cameras` / `court_cameras` / `zero_delay_boards`** (eventos `*`) com filtro `arena_id=eq.<ARENA_ID>`:
   → Ao receber qualquer mudança, dispare `reload_config()` (rebuild do `pin_to_camera`, reinicialize recorders apenas para câmeras cuja `rtsp_url` mudou — não derrube as outras).
2. **`replay_jobs`** evento `INSERT` com filtro `arena_id=eq.<ARENA_ID> AND status=eq.pending`:
   → Enfileira no worker imediatamente (sem esperar o poll de 5s).
3. **`arenas`** evento `UPDATE` com filtro `id=eq.<ARENA_ID>`:
   → Se `supabase_url`, `supabase_service_key` ou `videos_bucket` mudaram, recrie o cliente de upload.

Fallback: se o WebSocket cair, mantenha o poll a cada 60s como rede de segurança.

## Health endpoint (`health.py`)

FastAPI em `:HEALTH_PORT`:
- `GET /health` → `{"ok": true}`
- `GET /status` → JSON com: arena, lista de câmeras (id, name, recording=bool, last_segment_at), placa (driver, port, connected), último replay por câmera, tamanho da fila `_pending/`.

## Requisitos não-funcionais
- Async onde fizer sentido; subprocessos ffmpeg isolados por câmera.
- NENHUMA exceção pode derrubar o agente. Catch genérico + log + retry.
- Sem credenciais hard-coded. Tudo via env ou banco.
- `requirements.txt` com versões fixas.
- `systemd/looplance-agent.service` (`Restart=always`, `User=looplance`).
- Logs estruturados via `loguru`, rotação diária em `/var/log/looplance/agent.log`.
- udev rule de exemplo no README para liberar `/dev/ttyUSB*` e HID sem sudo.

## Saída esperada do Claude
1. Árvore de arquivos.
2. Conteúdo COMPLETO de cada arquivo em blocos ```python (sem `<TODO>`).
3. Comandos de instalação (`apt install ffmpeg libusb-1.0-0 libhidapi-hidraw0` + `pip install -r requirements.txt`).
4. Como rodar em dev (`python -m agent.main`) e em produção (systemd).
5. Exemplo de payload `INSERT` em `videos` e exemplo de `UPDATE` em `replay_jobs`.
6. Checklist de teste manual:
   - RTSP fake: `ffmpeg -re -stream_loop -1 -i sample.mp4 -c copy -f rtsp rtsp://127.0.0.1:8554/cam1`
   - Simular botão sem a placa (modo `MOCK`): endpoint POST `/debug/press/{pin}` no health server, ativado só se `LOG_LEVEL=DEBUG`.
   - Criar uma linha em `replay_jobs` pelo SQL editor e ver virar `done`.

===PROMPT END===

---

## Lembretes do lado Lovable (já feitos, não precisa pedir pro Claude)

- Schema `arenas.supabase_url / supabase_service_key / supabase_anon_key / videos_bucket / retention_days` já existe.
- Trigger `sync_global_replay` em `videos` já publica para o feed global.
- Limpeza por retenção roda via `pg_cron` chamando `/api/public/hooks/cleanup-videos` às 03:00 UTC.
- Helper do frontend: `resolveReplayUrl()` aceita URL absoluta ou só o nome do arquivo (base `https://htirxluqufyexmpuhhbt.supabase.co/storage/v1/object/public/replays/`). Para múltiplas arenas, **sempre grave a URL absoluta** em `videos.video_url`.
