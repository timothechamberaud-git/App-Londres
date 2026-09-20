import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event, AgendaItems, parseIcsToAgenda, fetchIcalFeed } from '../services/icalParser';

export { Event, AgendaItems };

export const DEFAULT_PRONOTE_URL = '';

interface AgendaContextType {
  items: AgendaItems;
  pronoteUrl: string;
  lastSync: string | null;
  isSyncing: boolean;
  addEvent: (date: string, time: string, name: string, location?: string, teacher?: string) => void;
  syncPronote: (urlOverride?: string) => Promise<boolean>;
  importIcsRaw: (icsContent: string) => Promise<boolean>;
  unlinkPronote: () => Promise<void>;
  clearAgenda: () => void;
}

const AgendaContext = createContext<AgendaContextType | undefined>(undefined);

export function AgendaProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AgendaItems>({});
  const [pronoteUrl, setPronoteUrl] = useState<string>(DEFAULT_PRONOTE_URL);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Fonction de fusion : conserve les événements manuels et remplace les événements Pronote
  const mergePronoteItems = (currentItems: AgendaItems, newPronoteItems: AgendaItems): AgendaItems => {
    const merged: AgendaItems = {};

    // 1. Récupérer tous les événements manuels existants
    for (const [date, eventList] of Object.entries(currentItems)) {
      const manualEvents = eventList.filter(e => e.source === 'manual');
      if (manualEvents.length > 0) {
        merged[date] = [...manualEvents];
      }
    }

    // 2. Ajouter les nouveaux événements Pronote
    for (const [date, pronoteEvents] of Object.entries(newPronoteItems)) {
      if (!merged[date]) {
        merged[date] = [];
      }
      merged[date].push(...pronoteEvents);
      // Tri chronologique
      merged[date].sort((a, b) => a.time.localeCompare(b.time));
    }

    return merged;
  };

  const syncPronote = useCallback(async (urlOverride?: string): Promise<boolean> => {
    const targetUrl = (urlOverride !== undefined ? urlOverride : pronoteUrl).trim();
    if (!targetUrl) return false;

    setIsSyncing(true);
    try {
      const icsText = await fetchIcalFeed(targetUrl);
      const pronoteAgenda = parseIcsToAgenda(icsText);

      setItems(prevItems => {
        const merged = mergePronoteItems(prevItems, pronoteAgenda);
        AsyncStorage.setItem('@agenda_items', JSON.stringify(merged)).catch(e => {
          console.error('Failed to save agenda items', e);
        });
        return merged;
      });

      const now = new Date();
      const formattedNow = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      setLastSync(formattedNow);
      setPronoteUrl(targetUrl);

      await AsyncStorage.setItem('@pronote_ical_url', targetUrl);
      await AsyncStorage.setItem('@pronote_last_sync', formattedNow);

      return true;
    } catch (error) {
      console.error('Erreur de synchronisation Pronote:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [pronoteUrl]);

  // Chargement initial des données enregistrées
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem('@pronote_ical_url');
        const savedSync = await AsyncStorage.getItem('@pronote_last_sync');
        const jsonValue = await AsyncStorage.getItem('@agenda_items');

        const activeUrl = savedUrl || DEFAULT_PRONOTE_URL;
        setPronoteUrl(activeUrl);
        if (savedSync) setLastSync(savedSync);

        let parsedItems: AgendaItems = {};
        if (jsonValue != null) {
          parsedItems = JSON.parse(jsonValue);
          setItems(parsedItems);
        }

        // Si aucun événement n'est en cache et qu'une URL est définie, synchroniser automatiquement
        if (Object.keys(parsedItems).length === 0 && activeUrl) {
          syncPronote(activeUrl).catch(err => console.log('Auto-sync initial skipped or failed:', err));
        }
      } catch (e) {
        console.error('Failed to load agenda data', e);
      }
    };
    loadData();
  }, [syncPronote]);

  const importIcsRaw = async (icsContent: string): Promise<boolean> => {
    try {
      const pronoteAgenda = parseIcsToAgenda(icsContent);
      setItems(prevItems => {
        const merged = mergePronoteItems(prevItems, pronoteAgenda);
        AsyncStorage.setItem('@agenda_items', JSON.stringify(merged)).catch(e => {
          console.error('Failed to save agenda items', e);
        });
        return merged;
      });

      const now = new Date();
      const formattedNow = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (import manuel)`;
      setLastSync(formattedNow);
      await AsyncStorage.setItem('@pronote_last_sync', formattedNow);
      return true;
    } catch (e) {
      console.error('Erreur import ICS brut', e);
      throw e;
    }
  };

  const unlinkPronote = async () => {
    setPronoteUrl('');
    setLastSync(null);
    await AsyncStorage.removeItem('@pronote_ical_url');
    await AsyncStorage.removeItem('@pronote_last_sync');

    // Conserver uniquement les événements manuels
    setItems(prev => {
      const onlyManual: AgendaItems = {};
      for (const [date, list] of Object.entries(prev)) {
        const filtered = list.filter(item => item.source === 'manual');
        if (filtered.length > 0) {
          onlyManual[date] = filtered;
        }
      }
      AsyncStorage.setItem('@agenda_items', JSON.stringify(onlyManual)).catch(console.error);
      return onlyManual;
    });
  };

  const addEvent = async (date: string, time: string, name: string, location?: string, teacher?: string) => {
    setItems(prev => {
      const current = prev[date] || [];
      const newEvent: Event = {
        id: `manual-${Date.now()}`,
        name,
        time,
        location,
        teacher,
        source: 'manual',
      };
      const updated = [...current, newEvent];
      updated.sort((a, b) => a.time.localeCompare(b.time));

      const newItems = { ...prev, [date]: updated };

      AsyncStorage.setItem('@agenda_items', JSON.stringify(newItems)).catch(e => {
        console.error('Failed to save agenda items', e);
      });

      return newItems;
    });
  };

  const clearAgenda = async () => {
    setItems({});
    await AsyncStorage.removeItem('@agenda_items');
  };

  return (
    <AgendaContext.Provider
      value={{
        items,
        pronoteUrl,
        lastSync,
        isSyncing,
        addEvent,
        syncPronote,
        importIcsRaw,
        unlinkPronote,
        clearAgenda,
      }}
    >
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

