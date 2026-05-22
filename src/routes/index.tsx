import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ArenaHeader } from '../components/ArenaHeader';
import { FilterSection } from '../components/FilterSection';
import { VideoCard } from '../components/VideoCard';
import { CheckInButton } from '../components/CheckInButton';
import { BottomNav } from '../components/BottomNav';
import { supabase } from '../integrations/supabase/client';
import { useActiveSession } from '../hooks/useActiveSession';
import { Toaster } from '../components/ui/sonner';
import { Skeleton } from '../components/ui/skeleton';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const [selectedArena, setSelectedArena] = useState<string>('');
  const [selectedQuadra, setSelectedQuadra] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState<string>('');
  const [replays, setReplays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useActiveSession();

  // Arena/Quadra names for components
  const [arenaName, setArenaName] = useState('');
  const [quadraName, setQuadraName] = useState('');

  useEffect(() => {
    if (selectedArena) {
      supabase.from('arenas').select('nome').eq('id', selectedArena).single().then(({ data }) => {
        if (data) setArenaName(data.nome);
      });
    }
    if (selectedQuadra) {
      supabase.from('quadras').select('nome').eq('id', selectedQuadra).single().then(({ data }) => {
        if (data) setQuadraName(data.nome);
      });
    }
  }, [selectedArena, selectedQuadra]);

  const fetchReplays = async () => {
    if (!selectedQuadra) return;
    
    setIsLoading(true);
    let query = supabase
      .from('replays')
      .select('id, video_url, created_at')
      .eq('quadra_id', selectedQuadra)
      .order('created_at', { ascending: false });

    if (session && session.quadraId === selectedQuadra) {
      query = query.gte('created_at', session.startTime);
    } else {
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query.gte('created_at', startOfDay.toISOString())
                     .lte('created_at', endOfDay.toISOString());
      }
      
      if (startTime && date) {
        const [hours, minutes] = startTime.split(':');
        const filterTime = new Date(date);
        filterTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        query = query.gte('created_at', filterTime.toISOString());
      }
    }

    const { data } = await query;
    if (data) setReplays(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReplays();

    // Set up real-time subscription
    if (selectedQuadra) {
      const channel = supabase
        .channel('replays-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'replays',
            filter: `quadra_id=eq.${selectedQuadra}`,
          },
          (payload) => {
            // Only add if it matches session constraints if active
            if (session && session.quadraId === selectedQuadra) {
               if (new Date(payload.new.created_at) >= new Date(session.startTime)) {
                 setReplays(prev => [payload.new, ...prev]);
               }
            } else {
              setReplays(prev => [payload.new, ...prev]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedQuadra, date, startTime, session]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <Toaster position="top-center" />
      
      <ArenaHeader 
        selectedArena={selectedArena}
        setSelectedArena={setSelectedArena}
        selectedQuadra={selectedQuadra}
        setSelectedQuadra={setSelectedQuadra}
      />

      <FilterSection 
        date={date}
        setDate={setDate}
        startTime={startTime}
        setStartTime={setStartTime}
      />

      <main className="px-4 py-2 space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <div className="flex justify-between items-center">
                 <div className="space-y-2">
                   <Skeleton className="h-4 w-32" />
                   <Skeleton className="h-3 w-24" />
                 </div>
                 <div className="flex gap-2">
                   <Skeleton className="h-8 w-8 rounded-full" />
                   <Skeleton className="h-8 w-8 rounded-full" />
                 </div>
              </div>
            </div>
          ))
        ) : replays.length > 0 ? (
          replays.map((replay) => (
            <VideoCard 
              key={replay.id}
              id={replay.id}
              videoUrl={replay.video_url}
              createdAt={replay.created_at}
              arenaName={arenaName}
              quadraName={quadraName}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="bg-secondary/30 p-6 rounded-full mb-6">
              <img src="/placeholder.svg" alt="Empty" className="w-24 h-24 opacity-20" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Nenhum lance gravado</h2>
            <p className="text-sm text-muted-foreground">
              {selectedQuadra 
                ? "Nenhum lance gravado nesta quadra hoje. Aperte o botão na quadra para gerar o seu!"
                : "Selecione uma Arena e uma Quadra para ver os lances."}
            </p>
          </div>
        )}
      </main>

      {selectedQuadra && (
        <CheckInButton 
          arenaId={selectedArena}
          quadraId={selectedQuadra}
          arenaName={arenaName}
          quadraName={quadraName}
        />
      )}

      <BottomNav />
    </div>
  );
}
