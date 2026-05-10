import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import logoFull from "@/assets/logo-full.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoFull} alt="LoopLance" className="h-9" />
          </Link>
          {title && <h1 className="hidden text-sm font-medium text-muted-foreground md:block">{title}</h1>}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
