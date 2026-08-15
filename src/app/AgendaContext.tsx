import React, { createContext, useState, useContext, ReactNode } from 'react';

type Event = {
  name: string;
  time: string;
};

type AgendaItems = {
  [date: string]: Event[];
};

interface AgendaContextType {
  items: AgendaItems;
  addEvent: (date: string, time: string, name: string) => void;
}

const AgendaContext = createContext<AgendaContextType | undefined>(undefined);

export function AgendaProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AgendaItems>({
    '2026-08-16': [{ name: 'Arrivée à Londres', time: '14:00' }],
    '2026-08-17': [{ name: 'Cours d\'anglais', time: '09:00' }]
  });

  const addEvent = (date: string, time: string, name: string) => {
    setItems(prev => {
      const current = prev[date] || [];
      const updated = [...current, { name, time }];
      // Sort by time
      updated.sort((a, b) => a.time.localeCompare(b.time));
      return { ...prev, [date]: updated };
    });
  };

  return (
    <AgendaContext.Provider value={{ items, addEvent }}>
      {children}
    </AgendaContext.Provider>
  );
}

export function useAgenda() {
  const context = useContext(AgendaContext);
  if (!context) {
    throw new Error('useAgenda must be used within an AgendaProvider');
  }
  return context;
}
