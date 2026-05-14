import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import logoFull from "@/assets/logo-full.png";

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-3 backdrop-blur">
            <SidebarTrigger />
            <img src={logoFull} alt="LoopLance" className="h-11 w-auto" />
            {title && <h1 className="text-sm font-medium text-muted-foreground">{title}</h1>}
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
