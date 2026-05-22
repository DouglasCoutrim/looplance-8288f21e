import { useState, useEffect } from 'react';
import { MapPin, ChevronDown, User } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useGamification } from '../hooks/useGamification';

interface ArenaHeaderProps {
  arenas: any[];
  quadras: any[];
  selectedArena: string;
  setSelectedArena: (id: string) => void;
  selectedQuadra: string;
  setSelectedQuadra: (id: string) => void;
}

export const ArenaHeader = ({ 
  arenas,
  quadras,
  selectedArena, 
  setSelectedArena, 
  selectedQuadra, 
  setSelectedQuadra 
}: ArenaHeaderProps) => {
  const { points } = useGamification();


  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md pb-4 pt-6 px-4 border-b border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img 
            src="/logo-mark.png" 
            alt="LoopLance Logo" 
            className="h-8 w-auto object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            LoopLance
          </span>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
          <User className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary">{points} XP</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={selectedArena} onValueChange={setSelectedArena} disabled={arenas.length === 0}>
          <SelectTrigger className="bg-card border-border/50 h-10 text-xs">
            <SelectValue placeholder={arenas.length === 0 ? "Carregando..." : "Escolher Arena"} />
          </SelectTrigger>
          <SelectContent>
            {arenas.map((arena) => (
              <SelectItem key={arena.id} value={arena.id}>
                {arena.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedQuadra} onValueChange={setSelectedQuadra} disabled={!selectedArena || quadras.length === 0}>
          <SelectTrigger className="bg-card border-border/50 h-10 text-xs">
            <SelectValue placeholder={!selectedArena ? "Escolher Quadra" : quadras.length === 0 ? "Nenhuma Quadra" : "Escolher Quadra"} />
          </SelectTrigger>
          <SelectContent>
            {quadras.map((quadra) => (
              <SelectItem key={quadra.id} value={quadra.id}>
                {quadra.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
};
