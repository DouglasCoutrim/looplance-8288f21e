import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export const useGamification = () => {
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    const savedPoints = localStorage.getItem('looplance_points');
    if (savedPoints) {
      setPoints(parseInt(savedPoints, 10));
    }
  }, []);

  const addPoints = (amount: number, reason: string) => {
    const newPoints = points + amount;
    setPoints(newPoints);
    localStorage.setItem('looplance_points', newPoints.toString());
    
    // Confetti effect
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00FF85', '#22D3EE', '#FFFFFF']
    });

    toast.success(`+${amount} XP! ${reason}`, {
      description: 'Você está subindo no ranking!',
      duration: 2000,
    });
  };

  return { points, addPoints };
};
