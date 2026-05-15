import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRoleSimulator, type SimMode } from "@/contexts/role-simulator";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, X } from "lucide-react";

interface ArenaOpt { id: string; name: string }

export function RoleSimulatorBar() {
  const { realIsSuperAdmin } = useAuth();
  const { mode, simulatedArenaId, setMode, setSimulatedArenaId, reset } = useRoleSimulator();
  const [arenas, setArenas] = useState<ArenaOpt[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!realIsSuperAdmin) return;
    supabase.from("arenas").select("id, name").eq("active", true).order("name").then(({ data }) => {
      setArenas((data ?? []) as ArenaOpt[]);
    });
  }, [realIsSuperAdmin]);

  if (!realIsSuperAdmin) return null;

  const active = mode !== "real";
  if (!active && !open) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-end gap-2 border-b border-border bg-background/80 px-3 py-1 backdrop-blur">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
          <Eye className="mr-1 h-3 w-3" /> Simular role
        </Button>
      </div>
    );
  }

  const arenaName = arenas.find((a) => a.id === simulatedArenaId)?.name;

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-primary/40 bg-primary/10 px-3 py-2 backdrop-blur">
      {active && (
        <Badge variant="outline" className="border-primary text-primary">
          Simulando: {mode === "admin_arena" ? "Dono" : "Jogador"}
          {arenaName ? ` · ${arenaName}` : ""}
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">Visualizar como:</span>
      <Select value={mode} onValueChange={(v) => setMode(v as SimMode)}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="real">Super Admin (real)</SelectItem>
          <SelectItem value="admin_arena">Dono de Arena</SelectItem>
          <SelectItem value="player">Usuário Normal</SelectItem>
        </SelectContent>
      </Select>

      {(mode === "admin_arena" || mode === "player") && (
        <Select value={simulatedArenaId ?? ""} onValueChange={(v) => setSimulatedArenaId(v || null)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="Escolher arena..." />
          </SelectTrigger>
          <SelectContent>
            {arenas.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="ml-auto flex items-center gap-1">
        {active && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>
            <X className="mr-1 h-3 w-3" /> Sair da simulação
          </Button>
        )}
        {!active && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        )}
      </div>
    </div>
  );
}
