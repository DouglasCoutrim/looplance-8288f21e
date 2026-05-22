import { Home, Search, Trophy, User } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card pb-safe px-4 shadow-lg">
      <Link to="/" className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary [&.active]:text-primary">
        <Home className="h-6 w-6" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>
      <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary">
        <Search className="h-6 w-6" />
        <span className="text-[10px] font-medium">Buscar</span>
      </button>
      <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary">
        <Trophy className="h-6 w-6" />
        <span className="text-[10px] font-medium">Ranking</span>
      </button>
      <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary">
        <User className="h-6 w-6" />
        <span className="text-[10px] font-medium">Perfil</span>
      </button>
    </nav>
  );
};
