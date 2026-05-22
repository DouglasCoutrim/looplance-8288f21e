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
    <div className="overflow-hidden rounded-2xl bg-card shadow-md border border-border/50 group">
      <div className="relative aspect-video bg-black">
        <video 
          src={videoUrl} 
          className="h-full w-full object-cover"
          controls
          playsInline
          onPlay={() => addPoints(5, 'Assistindo um lance!')}
        />
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              {quadraName || 'Lance incrível'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {format(new Date(createdAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <a 
              href={videoUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
