import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [items, setItems] = useState<AgendaItems>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem('@agenda_items');
        if (jsonValue != null) {
          setItems(JSON.parse(jsonValue));
        } else {
          setItems({
            '2026-08-16': [{ name: 'Arrivée à Londres (Demo)', time: '14:00' }]
          });
        }
      } catch (e) {
        console.error('Failed to load agenda items', e);
      }
    };
    loadData();
  }, []);

  const addEvent = async (date: string, time: string, name: string) => {
    setItems(prev => {
      const current = prev[date] || [];
      const updated = [...current, { name, time }];
      updated.sort((a, b) => a.time.localeCompare(b.time));
      
      const newItems = { ...prev, [date]: updated };
      
      AsyncStorage.setItem('@agenda_items', JSON.stringify(newItems)).catch(e => {
        console.error('Failed to save agenda items', e);
      });
      
      return newItems;
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
