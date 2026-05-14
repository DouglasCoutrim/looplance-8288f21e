import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoMark from "@/assets/logo-mark.png";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-glow">
        <div className="mb-6 flex flex-col items-center">
          <img src={logoMark} alt="LoopLance" className="h-16 w-16" />
          <h1 className="mt-3 text-2xl font-bold">Entrar</h1>
          <p className="text-sm text-muted-foreground">Acesse sua conta LoopLance</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tem conta? <Link to="/signup" className="text-primary hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}
