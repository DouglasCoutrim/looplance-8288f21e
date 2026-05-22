import { Share2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGamification } from '../hooks/useGamification';

interface VideoCardProps {
  id: string;
  videoUrl: string;
  createdAt: string;
  arenaName?: string;
  quadraName?: string;
}

export const VideoCard = ({ id, videoUrl, createdAt, arenaName, quadraName }: VideoCardProps) => {
  const { addPoints } = useGamification();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meu lance no LoopLance!',
          text: `Confira este lance incrível na ${arenaName || 'nossa arena'}!`,
          url: window.location.href,
        });
        addPoints(10, 'Compartilhamento realizado!');
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      addPoints(5, 'Link copiado!');
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-card border border-white/5 group shadow-2xl">
      <div className="relative aspect-[9/16] bg-black sm:aspect-video">
        <video 
          src={videoUrl} 
          className="h-full w-full object-cover"
          controls
          playsInline
          onPlay={() => addPoints(5, 'Assistindo um lance!')}
        />
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Replay</span>
          </div>
        </div>
      </div>
      <div className="p-4 bg-gradient-to-t from-black/80 to-transparent -mt-20 relative z-10">
        <div className="flex items-end justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-white text-base drop-shadow-md">
              {quadraName || 'Lance incrível'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-white/70 font-medium">
                {format(new Date(createdAt), "HH:mm", { locale: ptBR })}
              </p>
              <span className="text-white/30 text-[10px]">•</span>
              <p className="text-[10px] text-white/50 uppercase font-bold tracking-tight">
                {format(new Date(createdAt), "dd MMM", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 backdrop-blur-md text-accent border border-accent/30 transition-all active:scale-95"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <a 
              href={videoUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 transition-all active:scale-95"
            >
              <Download className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
