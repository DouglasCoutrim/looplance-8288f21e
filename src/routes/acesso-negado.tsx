import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/acesso-negado")({ component: Denied });

function Denied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-4 rounded-full bg-destructive/15 p-4 text-destructive">
        <ShieldAlert className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-bold">Acesso negado</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Você não tem permissão para acessar esta área. Volte para os seus replays
        ou entre com uma conta autorizada.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild><Link to="/">Início</Link></Button>
        <Button asChild variant="outline"><Link to="/login">Trocar de conta</Link></Button>
      </div>
    </div>
  );
}
