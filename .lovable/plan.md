
# Prompt para gerar o backend Python

Copie o bloco abaixo e cole no Claude. Ele contém todo o contexto (schema do Lovable Cloud, hardware, fluxo, formato dos uploads) que o Claude precisa para gerar o backend completo, organizado em arquivos.

---

````text
Você é um engenheiro Python sênior. Gere um backend completo, pronto para rodar
em um mini-PC dentro da arena. Entregue o código separado por arquivos
(`main.py`, `config.py`, `recorder.py`, `clipper.py`, `uploader.py`,
`board.py`, `supabase_client.py`, `requirements.txt`, `.env.example`,
`systemd/looplance-agent.service`, `README.md`). Comente em português.

## Objetivo
Cada arena tem um PC local com câmeras IP (RTSP) e uma placa zero-delay
ARC-968 conectada via USB (HID/Serial) com 12 botões (K1..K12, L1, L2, R1,
R2, SE, ST, K11, K12). Quando um jogador aperta um botão, o backend deve
salvar os ÚLTIMOS 30 SEGUNDOS da câmera vinculada àquele botão como replay,
fazer upload no Supabase da própria arena e registrar a linha em `videos` no
Supabase central (Lovable Cloud).

## Stack obrigatória
- Python 3.11+
- `ffmpeg` (subprocess) para gravação contínua e recorte
- `supabase-py` para Lovable Cloud central + Supabase local da arena
- `pyserial` ou `hid` (escolha o melhor; deixe abstraído em `board.py`)
- `python-dotenv`, `httpx`, `loguru`, `pydantic` v2

## Configuração (.env)
```
ARENA_ID=<uuid da arena>
CENTRAL_SUPABASE_URL=https://tylsafugcyeezpbomcfe.supabase.co
CENTRAL_SUPABASE_SERVICE_KEY=<service role do Lovable Cloud>
RECORDINGS_DIR=/var/lib/looplance/recordings
SEGMENT_SECONDS=10
REPLAY_SECONDS=30
BOARD_PORT=auto   # ex: /dev/ttyUSB0 ou auto-detect
LOG_LEVEL=INFO
```

## Schema do Lovable Cloud (somente leitura, exceto onde indicado)
Tabelas relevantes (Postgres/Supabase):

- `arenas(id uuid, name, slug, supabase_url, supabase_service_key,
  supabase_anon_key, videos_bucket text default 'replays',
  retention_days int)` — leia a linha do ARENA_ID para obter URL/keys/bucket
  do Supabase LOCAL da arena.
- `zero_delay_boards(id, arena_id, name, serial, model)` — placas físicas.
- `arena_buttons(id, arena_id, board_id, button_number int, hardware_pin
  text, label, camera_id)` — mapeia cada pino físico (`hardware_pin` =
  K1,K2,...) à `camera_id`.
- `cameras(id, arena_id, name, rtsp_url, button_id)` — fonte RTSP.
- `courts(id, arena_id, name)`.
- `court_cameras(court_id, camera_id, arena_id)` — descubra `court_id` da
  câmera para preencher `videos.court_id` (use o primeiro vínculo).
- `videos(id, arena_id, court_id, title, video_url, thumbnail_url,
  duration_seconds, uploaded_by, created_at)` — INSERT a cada replay.
  `video_url` deve ser a URL pública do bucket da arena.

## Fluxo
1. **Boot**: carregar arena do Lovable Cloud central (filtrando por
   ARENA_ID). Carregar placas, botões (com `hardware_pin` e `camera_id`) e
   câmeras. Construir mapa `pin -> camera_rtsp` e `pin -> camera_id`.
2. **Recorder (`recorder.py`)**: para cada câmera, abrir um processo ffmpeg
   que grava continuamente em segmentos rotativos de `SEGMENT_SECONDS` em
   `RECORDINGS_DIR/<camera_id>/seg-%Y%m%d-%H%M%S.mp4`. Manter no máximo
   `ceil(REPLAY_SECONDS / SEGMENT_SECONDS) + 2` segmentos por câmera
   (apagar mais antigos). Reiniciar ffmpeg em caso de queda da RTSP com
   backoff exponencial.
3. **Board (`board.py`)**: thread escutando a ARC-968 via USB
   (HID/Serial — implemente as duas e selecione por config). Emitir evento
   `on_button_press(hardware_pin)` em rising-edge com debounce de 800ms por
   pino.
4. **Clipper (`clipper.py`)**: ao receber pressão, identificar
   `camera_id` pelo pino. Concatenar os últimos segmentos cobrindo
   `REPLAY_SECONDS` com `ffmpeg -f concat`, recortar exatamente os 30s
   finais (`-ss -30 -t 30`), gerar thumbnail (`ffmpeg -ss 1 -vframes 1
   thumb.jpg`). Não bloquear o recorder.
5. **Uploader (`uploader.py`)**:
   - Conectar no Supabase LOCAL da arena (`supabase_url` +
     `supabase_service_key` lidos da arena).
   - Upload do MP4 em `<videos_bucket>/<court_id|sem-quadra>/<yyyy>/<mm>/
     <dd>/<uuid>.mp4` e da thumb `.jpg` no mesmo caminho com sufixo
     `_thumb.jpg`. Bucket público.
   - Pegar URL pública. Se o upload falhar 3x, mover o arquivo para
     `RECORDINGS_DIR/_pending/` e retentar em background.
6. **Registrar replay**: INSERT em `videos` no Lovable Cloud central
   (`arena_id`, `court_id`, `title='Replay <camera.name> <hh:mm:ss>'`,
   `video_url`, `thumbnail_url`, `duration_seconds=30`).
7. **Hot-reload**: a cada 60s, reler arenas/câmeras/botões; se mudar,
   reconfigurar recorders/mapeamentos sem perder os buffers atuais.
8. **Logs estruturados** com `loguru`, rotação diária em
   `/var/log/looplance/agent.log`.
9. **Health endpoint** opcional (FastAPI em :8088) com `/health` e
   `/status` (lista câmeras, último replay por câmera, conexão da placa).

## Requisitos não-funcionais
- Código async onde fizer sentido; subprocessos isolados por câmera.
- Tratamento robusto de erro: nenhuma exceção pode derrubar o agente.
- Sem credenciais hard-coded. Tudo via env / banco.
- `requirements.txt` com versões fixas.
- `systemd/looplance-agent.service` rodando como serviço (Restart=always).
- README com: instalação (apt: ffmpeg, libusb), setup do .env, primeiro
  boot, troubleshooting (RTSP, USB permissions com udev rule).

## Detecção da placa ARC-968
A ARC-968 expõe os 12 botões via USB. Implemente DUAS estratégias em
`board.py`:
- `SerialBoard`: lê linhas tipo `"K1\n"` em 9600 8N1.
- `HidBoard`: usa `hid` lib, mapeia bytes do report para os pinos
  K1..K12, L1, L2, R1, R2, SE, ST.
Selecione pela env `BOARD_DRIVER=serial|hid` (default `serial`). Auto-
detect a porta se `BOARD_PORT=auto`.

## Saída esperada
Entregue:
1. Estrutura de arquivos em árvore.
2. Conteúdo COMPLETO de cada arquivo dentro de blocos ```python.
3. Comandos para rodar (dev e systemd).
4. Exemplo de payload INSERT na tabela `videos`.
5. Checklist de testes manuais (RTSP fake com `ffmpeg -re -i sample.mp4
   -f rtsp rtsp://...`, simular botão).

Não use placeholders tipo `<TODO>`. Tudo deve compilar e rodar.
````

---

## O que eu já configurei do seu lado (para você não esquecer)

- `arenas.supabase_url`, `supabase_service_key`, `videos_bucket`,
  `retention_days` já existem.
- A tabela `videos` central já tem trigger `sync_global_replay` que
  publica para o feed global automaticamente — basta inserir lá.
- Limpeza por retenção já roda via `pg_cron` chamando
  `/api/public/hooks/cleanup-videos` às 03:00 UTC.

## Próximos passos sugeridos

1. Cole o prompt no Claude e gere o código.
2. Suba o agente em 1 PC de teste com 1 câmera RTSP.
3. Me diga se quer um endpoint `/api/public/hooks/agent-heartbeat` no
   Lovable para mostrar status online/offline da arena no painel admin.

