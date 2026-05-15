import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, Cable, LayoutDashboard, LogOut, PlayCircle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoFull from "@/assets/logo-full.png";
import logoMark from "@/assets/logo-mark.png";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { isSuperAdmin, adminArenaId, playerArenaIds, user } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [playerSlug, setPlayerSlug] = useState<string | null>(null);

  useEffect(() => {
    const id = playerArenaIds[0];
    if (!id) return;
    supabase.from("arenas").select("slug").eq("id", id).maybeSingle()
      .then(({ data }) => setPlayerSlug(data?.slug ?? null));
  }, [playerArenaIds.join(",")]);

  const items: NavItem[] = [];
  if (isSuperAdmin) {
    items.push({ title: "Arenas", url: "/admin", icon: Building2 });
  }
  if (adminArenaId) {
    items.push({ title: "Painel da Arena", url: "/painel", icon: LayoutDashboard });
  }
  items.push({ title: "Início", url: "/", icon: PlayCircle });
  void playerSlug;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center justify-center py-2">
          {collapsed
            ? <img src={logoMark} alt="LoopLance" className="h-7" />
            : <img src={logoFull} alt="LoopLance" className="h-8" />}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>Sair</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
