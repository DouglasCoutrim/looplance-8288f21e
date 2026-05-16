import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Trash2, Plus, KeyRound } from "lucide-react";
import {
  listIngestTokens,
  createIngestToken,
  revokeIngestToken,
} from "@/lib/ingest-tokens.functions";

export const Route = createFileRoute("/admin/ingest/$arenaId")({
  component: IngestTokensPage,
});

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function IngestTokensPage() {
  const { arenaId } = Route.useParams();
  const { user, loading, isSuperAdmin } = useAuth();
  const [arenaName, setArenaName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ token: string; name: string } | null>(null);

  const list = useServerFn(listIngestTokens);
  const create = useServerFn(createIngestToken);
  const revoke = useServerFn(revokeIngestToken);

  async function load() {
    setPageLoading(true);
    try {
      const { data: a } = await supabase
        .from("arenas")
        .select("name")
        .eq("id", arenaId)
        .maybeSingle();
      setArenaName(a?.name ?? "Arena");

      if (user) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("arena_id", arenaId)
          .eq("role", "admin_arena")
          .maybeSingle();
        setIsAdmin(Boolean(roleRow) || isSuperAdmin);
      }

      const res = await list({ data: { arenaId } });
      setTokens(res.tokens as TokenRow[]);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao carregar tokens");
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    if (!loading && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, arenaId, isSuperAdmin]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await create({ data: { arenaId, name: newName.trim() } });
      setJustCreated({ token: res.token, name: newName.trim() });
      setNewName("");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao criar token");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revogar este token? O servidor que o utiliza deixará de enviar replays.")) return;
    try {
      await revoke({ data: { tokenId: id } });
      toast.success("Token revogado");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao revogar");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  }

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if (isAdmin === false) return <Navigate to="/acesso-negado" />;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/arena/$id" params={{ id: arenaId }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <KeyRound className="h-6 w-6 text-primary" /> Tokens de Ingestão
            </h1>
            <p className="text-sm text-muted-foreground">{arenaName}</p>
          </div>
        </div>

        <Card className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Tokens usados pelo servidor Python local para enviar replays via
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">POST /api/public/ingest/replay</code>.
            Apenas o hash é guardado — copie o valor agora, ele não será mostrado novamente.
          </p>
          <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="name">Nome do token</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Servidor Quadra 1"
                maxLength={80}
              />
            </div>
            <Button type="submit" disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Gerar</>}
            </Button>
          </form>
        </Card>

        {justCreated && (
          <Card className="border-primary p-4">
            <p className="mb-2 text-sm font-semibold">Token criado para "{justCreated.name}"</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Copie agora. Por segurança, este valor não poderá ser visto novamente.
            </p>
            <div className="flex items-center gap-2 rounded bg-muted p-2">
              <code className="flex-1 break-all font-mono text-xs">{justCreated.token}</code>
              <Button size="sm" variant="outline" onClick={() => copy(justCreated.token)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setJustCreated(null)}
            >
              Já copiei, fechar
            </Button>
          </Card>
        )}

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Tokens existentes</h2>
          {pageLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum token criado ainda.</p>
          ) : (
            <ul className="divide-y">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code className="font-mono">{t.token_prefix}…</code>
                      {" · criado "}
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                      {t.last_used_at
                        ? ` · usado ${new Date(t.last_used_at).toLocaleString("pt-BR")}`
                        : " · nunca usado"}
                      {t.revoked_at && <span className="ml-2 text-destructive">revogado</span>}
                    </p>
                  </div>
                  {!t.revoked_at && (
                    <Button size="sm" variant="ghost" onClick={() => handleRevoke(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Configuração no servidor Python</h3>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`ARENA_ID=${arenaId}
ARENA_INGEST_TOKEN=arn_...
INGEST_URL=https://looplance.lovable.app/api/public/ingest/replay`}
          </pre>
        </Card>
      </div>
    </AppShell>
  );
}
