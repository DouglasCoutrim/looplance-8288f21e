import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logoMark from "@/assets/logo-mark.png";
import { Play, Shield, Smartphone, Building2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "LoopLance — Repita a emoção" },
      { name: "description", content: "Plataforma SaaS multi-arena para reviver os melhores lances do esporte amador." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          <img src={logoMark} alt="LoopLance" className="h-10 w-10" />
          <span className="text-xl font-bold tracking-tight">LoopLance</span>
        </div>
        <div className="flex gap-2">
          <Link to="/login"><Button variant="ghost">Entrar</Button></Link>
          <Link to="/signup"><Button>Criar conta</Button></Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-20 text-center md:pt-20">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          SaaS multi-arena para esporte amador
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
          Repita a <span className="text-gradient">emoção</span> dos seus lances.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          A arena grava, você revive. Capture, compartilhe e reviva os melhores momentos das partidas
          em qualquer quadra parceira do LoopLance.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/signup"><Button size="lg" className="shadow-glow">Começar agora</Button></Link>
          <Link to="/login"><Button size="lg" variant="outline">Já tenho conta</Button></Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 md:grid-cols-3">
        {[
          { icon: Smartphone, title: "App do Jogador", desc: "Escaneie o QR Code da quadra e veja seu feed de jogadas no celular." },
          { icon: Building2, title: "Painel da Arena", desc: "Gerencie quadras, suba seu logo (white label) e publique vídeos." },
          { icon: Shield, title: "Multi-tenant seguro", desc: "Cada arena vê apenas seus próprios dados. Isolamento total." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6">
            <Icon className="mb-3 h-8 w-8 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LoopLance · Repita a emoção
      </footer>
    </div>
  );
}
