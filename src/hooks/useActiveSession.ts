import { useState, useEffect } from 'react';

export interface ActiveSession {
  arenaId: string;
  quadraId: string;
  startTime: string;
}

export const useActiveSession = () => {
  const [session, setSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem('looplance_session');
    if (savedSession) {
      setSession(JSON.parse(savedSession));
    }
  }, []);

  const startSession = (arenaId: string, quadraId: string) => {
    const newSession = {
      arenaId,
      quadraId,
      startTime: new Date().toISOString(),
    };
    setSession(newSession);
    localStorage.setItem('looplance_session', JSON.stringify(newSession));
  };

  const endSession = () => {
    setSession(null);
    localStorage.removeItem('looplance_session');
  };

  return { session, startSession, endSession };
};
