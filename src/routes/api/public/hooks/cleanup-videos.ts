import { createFileRoute } from "@tanstack/react-router";
import { runCleanupRoutine } from "@/lib/cleanup.server";

export const Route = createFileRoute("/api/public/hooks/cleanup-videos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require a shared secret to prevent unauthenticated mass deletion.
        const expected = process.env.CLEANUP_WEBHOOK_SECRET;
        if (!expected) {
          return new Response(
            JSON.stringify({ ok: false, error: "Cleanup secret not configured" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }
        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!provided || provided.length !== expected.length) {
          return new Response(
            JSON.stringify({ ok: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        // Constant-time compare
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
          diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
        }
        if (diff !== 0) {
          return new Response(
            JSON.stringify({ ok: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

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
