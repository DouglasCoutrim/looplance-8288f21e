import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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
    toast.success(`+${amount} XP! ${reason}`, {
      description: 'Você está subindo no ranking!',
      duration: 2000,
    });
  };

  return { points, addPoints };
};
