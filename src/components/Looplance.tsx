import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, Share2, Download, Trophy, MapPin, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Arena {
  id: string;
  nome: string;
}

interface Quadra {
  id: string;
  nome: string;
  arena_id: string;
}

interface Replay {
  id: string;
  video_url: string;
  quadra_id: string;
  created_at: string;
}

export default function Looplance() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [selectedArena, setSelectedArena] = useState<string | null>(null);
  const [selectedQuadra, setSelectedQuadra] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    fetchArenas();
    const savedXp = localStorage.getItem('looplance_xp');
    if (savedXp) setXp(parseInt(savedXp));
  }, []);

  const fetchArenas = async () => {
    const { data } = await supabase.from('arenas').select('*');
    if (data) setArenas(data);
    setLoading(false);
  };

  const fetchQuadras = async (arenaId: string) => {
    setLoading(true);
    const { data } = await supabase.from('quadras').select('*').eq('arena_id', arenaId);
    if (data) {
      setQuadras(data);
      if (data.length > 0) {
        setSelectedQuadra(data[0].id);
        fetchReplays(data[0].id);
      } else {
        setSelectedQuadra(null);
        setReplays([]);
      }
    }
    setLoading(false);
  };

  const fetchReplays = async (quadraId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('replays')
      .select('*')
      .eq('quadra_id', quadraId)
      .order('created_at', { ascending: false });
    if (data) setReplays(data);
    setLoading(false);
  };

  const addXp = (amount: number) => {
    const newXp = xp + amount;
    setXp(newXp);
    localStorage.setItem('looplance_xp', newXp.toString());
    toast.success(`+${amount} XP!`, {
      icon: <Trophy className="text-yellow-400" />,
      className: "bg-black border-primary text-primary",
    });
  };

  const handleShare = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Veja este lance no Looplance!',
          url: url,
        });
        addXp(20);
      } else {
        await navigator.clipboard.writeText(url);
        toast.info("Link copiado!");
        addXp(10);
      }
    } catch (error) {
      console.error('Error sharing', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md p-4 border-b border-white/10">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Play className="text-black h-5 w-5 fill-current" />
            </div>
            <h1 className="text-xl font-bold tracking-tighter italic">LOOPLANCE</h1>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">{xp} XP</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* Arena Selection */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest text-gray-500 font-bold ml-1">Arena</label>
          <div className="relative">
            <select 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-lg font-medium"
              onChange={(e) => {
                setSelectedArena(e.target.value);
                fetchQuadras(e.target.value);
              }}
              value={selectedArena || ''}
            >
              <option value="" disabled>Selecione uma Arena</option>
              {arenas.map(arena => (
                <option key={arena.id} value={arena.id}>{arena.nome}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>
        </div>

        {/* Quadra Tabs */}
        {selectedArena && quadras.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
            {quadras.map(quadra => (
              <button
                key={quadra.id}
                onClick={() => {
                  setSelectedQuadra(quadra.id);
                  fetchReplays(quadra.id);
                }}
                className={`flex-shrink-0 px-6 py-2 rounded-full border transition-all font-bold text-sm ${
                  selectedQuadra === quadra.id 
                  ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(173,255,47,0.3)]" 
                  : "bg-white/5 border-white/10 text-gray-400"
                }`}
              >
                {quadra.nome}
              </button>
            ))}
          </div>
        )}

        {/* Feed */}
        <div className="space-y-6">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="w-full aspect-video rounded-2xl bg-white/5" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-1/3 bg-white/5" />
                  <Skeleton className="h-4 w-1/4 bg-white/5" />
                </div>
              </div>
            ))
          ) : replays.length > 0 ? (
            replays.map((replay) => (
              <div key={replay.id} className="group relative bg-white/5 rounded-3xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-300">
                <div className="aspect-video relative overflow-hidden bg-black">
                  <video 
                    src={replay.video_url} 
                    className="w-full h-full object-cover"
                    controls
                    onPlay={() => addXp(5)}
                  />
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {quadras.find(q => q.id === replay.quadra_id)?.nome}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 flex justify-between items-center">
                  <div className="text-xs text-gray-500 font-medium">
                    {new Date(replay.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleShare(replay.video_url)}
                      className="p-3 bg-white/5 hover:bg-primary/20 hover:text-primary rounded-2xl border border-white/10 transition-all active:scale-90"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                    <a 
                      href={replay.video_url} 
                      download 
                      className="p-3 bg-white/5 hover:bg-primary/20 hover:text-primary rounded-2xl border border-white/10 transition-all active:scale-90"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-dashed border-white/20">
                <Play className="h-10 w-10 text-gray-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Nada por aqui ainda</h3>
                <p className="text-gray-500 text-sm max-w-[200px] mx-auto">
                  {selectedQuadra 
                    ? "Nenhum lance gravado nesta quadra hoje." 
                    : "Selecione uma quadra para ver os lances."}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-t border-white/10 p-2">
        <div className="max-w-lg mx-auto flex justify-around items-center">
          <button className="flex flex-col items-center p-2 text-primary">
            <div className="p-2 bg-primary/10 rounded-2xl">
              <Play className="h-6 w-6 fill-current" />
            </div>
            <span className="text-[10px] font-bold uppercase mt-1">Lances</span>
          </button>
          <button className="flex flex-col items-center p-2 text-gray-500 hover:text-white transition-colors">
            <div className="p-2 rounded-2xl">
              <Trophy className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold uppercase mt-1">Rank</span>
          </button>
          <button className="flex flex-col items-center p-2 text-gray-500 hover:text-white transition-colors">
            <div className="p-2 rounded-2xl">
              <MapPin className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold uppercase mt-1">Arenas</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
