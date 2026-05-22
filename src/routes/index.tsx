import { createFileRoute } from "@tanstack/react-router";
import logoFull from "@/assets/logo-full.png";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "LoopLance — Bem-vindo" },
      { name: "description", content: "Sua plataforma de replays esportivos." },
    ],
  }),
});

function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-foreground">
      <header className="mb-8">
        <img src={logoFull} alt="LoopLance" className="h-24 w-auto" />
      </header>
      
      <main className="text-center max-w-md mx-auto">
        <h1 className="text-3xl font-extrabold mb-4 text-primary">Pronto para Recomeçar</h1>
        <p className="text-muted-foreground mb-8">
          Todas as funcionalidades foram removidas. O layout base e a identidade visual foram preservados para a nova estrutura.
        </p>
        
        <div className="p-6 rounded-2xl border border-border bg-card">
          <p className="text-sm font-medium">O banco de dados e as rotas estão limpos.</p>
        </div>
      </main>
    </div>
  );
}
