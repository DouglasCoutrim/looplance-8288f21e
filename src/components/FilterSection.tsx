import { Calendar, Clock, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Button } from './ui/button';

interface FilterSectionProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  startTime: string;
  setStartTime: (time: string) => void;
}

export const FilterSection = ({ date, setDate, startTime, setStartTime }: FilterSectionProps) => {
  return (
    <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 rounded-full border-border/50 bg-secondary/30 text-xs font-normal shrink-0">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            {date ? format(date, "dd/MM/yy", { locale: ptBR }) : 'Data'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <div className="relative shrink-0">
        <select 
          value={startTime} 
          onChange={(e) => setStartTime(e.target.value)}
          className="appearance-none h-9 pl-8 pr-4 rounded-full border border-border/50 bg-secondary/30 text-xs font-normal outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Qualquer hora</option>
          <option value="08:00">Após 08h</option>
          <option value="12:00">Após 12h</option>
          <option value="18:00">Após 18h</option>
          <option value="20:00">Após 20h</option>
        </select>
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary pointer-events-none" />
      </div>

      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full bg-secondary/30">
        <Filter className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
