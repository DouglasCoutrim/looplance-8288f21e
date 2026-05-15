import { createFileRoute } from "@tanstack/react-router";
import { runCleanupRoutine } from "@/lib/cleanup.server";

export const Route = createFileRoute("/api/public/hooks/cleanup-videos")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runCleanupRoutine();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
