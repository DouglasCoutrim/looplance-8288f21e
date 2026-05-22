import { MapPin, X } from 'lucide-react';
import { useActiveSession } from '../hooks/useActiveSession';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface CheckInButtonProps {
  arenaId: string;
  quadraId: string;
  arenaName: string;
  quadraName: string;
}

export const CheckInButton = ({ arenaId, quadraId, arenaName, quadraName }: CheckInButtonProps) => {
  const { session, startSession, endSession } = useActiveSession();

  const isActive = session?.quadraId === quadraId;

  const handleCheckIn = () => {
    if (!arenaId || !quadraId) {
      toast.error('Selecione uma arena e quadra primeiro!');
      return;
    }
    startSession(arenaId, quadraId);
    toast.success('Check-in realizado!', {
      description: `Você agora está em sessão na ${quadraName}.`,
    });
  };

  const handleCheckOut = () => {
    endSession();
    toast.info('Sessão encerrada.');
  };

  if (isActive) {
    return (
      <Button 
        onClick={handleCheckOut}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-destructive hover:bg-destructive/90 text-white font-bold rounded-full shadow-lg shadow-destructive/20 gap-2 px-6 py-6"
      >
        <X className="h-5 w-5" />
        Encerrar Check-in
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleCheckIn}
      className="fixed bottom-24 right-6 z-40 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full h-14 w-14 shadow-lg shadow-primary/20 p-0"
    >
      <MapPin className="h-6 w-6" />
    </Button>
  );
};
