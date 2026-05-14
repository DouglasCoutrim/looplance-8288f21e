import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Radio, Film, User } from "lucide-react";

const items = [
  { to: "/", label: "Início", icon: Home },
  { to: "/ao-vivo", label: "Ao Vivo", icon: Radio },
  { to: "/replays", label: "Replays", icon: Film },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map((it) => {
          const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "drop-shadow-[0_0_6px_currentColor]" : ""}`} />
                <span className="uppercase tracking-wider">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
