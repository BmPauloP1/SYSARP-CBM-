import { supabase, isConfigured } from './supabase';
import { Drone, Pilot } from '../types';

export interface TacticalSector {
  id: string;
  operation_id: string;
  name: string;
  type: 'sector' | 'route' | 'zone';
  color: string;
  geojson: any;
  responsible?: string;
  notes?: string;
  assigned_drones?: string[]; 
  created_at: string;
}

export interface TacticalPOI {
  id: string;
  operation_id: string;
  name: string;
  type: 'base' | 'victim' | 'hazard' | 'landing_zone' | 'interest' | 'ground_team' | 'vehicle' | 'k9' | 'footprint' | 'object';
  lat: number;
  lng: number;
  description?: string;
  stream_url?: string; 
  created_at: string;
}

export interface TacticalDrone {
  id: string;
  operation_id: string;
  drone_id: string;
  pilot_id?: string;
  status: 'active' | 'standby' | 'returning' | 'offline';
  current_lat?: number;
  current_lng?: number;
  sector_id?: string;
  battery_level?: number;
  flight_altitude?: number; 
  radius?: number;
  stream_url?: string; 
  drone?: Drone;
  pilot?: Pilot;
}

export interface TacticalKmlLayer {
  id: string;
  operation_id: string;
  name: string;
  type: 'sector' | 'path' | 'full';
  geojson: any;
  visible: boolean;
  color: string;
  created_at: string;
}

const STORAGE_DRONES = 'sysarp_tactical_drones';

const getLocal = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const setLocal = (key: string, data: any[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      // Limpeza de emergência de dados legados pesados
      localStorage.removeItem('sysarp_tactical_snapshots');
      localStorage.removeItem('sysarp_tactical_sectors');
      localStorage.removeItem('sysarp_tactical_pois');
      console.warn("LocalStorage limpo por excesso de cota.");
    }
  }
};

export const tacticalService = {
  
  // --- SETORES (POLÍGONOS) NO BANCO DE DADOS ---
  getSectors: async (operationId: string): Promise<TacticalSector[]> => {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('tactical_sectors')
        .select('*')
        .eq('operation_id', operationId);
      if (error) throw error;
      return data || [];
    } catch (e) {
      return getLocal<TacticalSector>('sysarp_tactical_sectors').filter(s => s.operation_id === operationId);
    }
  },

  createSector: async (sector: Omit<TacticalSector, 'id' | 'created_at'>): Promise<TacticalSector> => {
    if (!isConfigured) throw new Error("Supabase não configurado");
    const { data, error } = await supabase
      .from('tactical_sectors')
      .insert([sector])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateSector: async (id: string, updates: Partial<TacticalSector>): Promise<void> => {
    if (!isConfigured) return;
    await supabase.from('tactical_sectors').update(updates).eq('id', id);
  },

  deleteSector: async (sectorId: string): Promise<void> => {
    if (!isConfigured) return;
    await supabase.from('tactical_sectors').delete().eq('id', sectorId);
  },

  // --- POIS (PONTOS) NO BANCO DE DADOS ---
  getPOIs: async (operationId: string): Promise<TacticalPOI[]> => {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('tactical_pois')
        .select('*')
        .eq('operation_id', operationId);
      if (error) throw error;
      return data || [];
    } catch (e) {
      return getLocal<TacticalPOI>('sysarp_tactical_pois').filter(p => p.operation_id === operationId);
    }
  },

  createPOI: async (poi: Omit<TacticalPOI, 'id' | 'created_at'>): Promise<TacticalPOI> => {
    const { data, error } = await supabase
      .from('tactical_pois')
      .insert([poi])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updatePOI: async (id: string, updates: Partial<TacticalPOI>): Promise<void> => {
    await supabase.from('tactical_pois').update(updates).eq('id', id);
  },

  deletePOI: async (poiId: string): Promise<void> => {
    await supabase.from('tactical_pois').delete().eq('id', poiId);
  },

  // --- DRONES (MANTIDO LOCAL PARA PERFORMANCE EM TEMPO REAL) ---
  getTacticalDrones: async (operationId: string): Promise<TacticalDrone[]> => {
    const all = getLocal<TacticalDrone>(STORAGE_DRONES);
    return all.filter(d => d.operation_id === operationId);
  },

  assignDrone: async (assignment: Omit<TacticalDrone, 'id'>): Promise<TacticalDrone> => {
    const newAssignment = { ...assignment, id: crypto.randomUUID() };
    const all = getLocal<TacticalDrone>(STORAGE_DRONES);
    const filtered = all.filter(d => !(d.operation_id === assignment.operation_id && d.drone_id === assignment.drone_id));
    filtered.push(newAssignment);
    setLocal(STORAGE_DRONES, filtered);
    return newAssignment;
  },

  updateDroneStatus: async (id: string, updates: Partial<TacticalDrone>): Promise<void> => {
      const all = getLocal<TacticalDrone>(STORAGE_DRONES);
      const idx = all.findIndex(d => d.id === id);
      if (idx !== -1) {
          all[idx] = { ...all[idx], ...updates };
          setLocal(STORAGE_DRONES, all);
      }
  },

  removeDroneFromOp: async (id: string): Promise<void> => {
      const all = getLocal<TacticalDrone>(STORAGE_DRONES);
      setLocal(STORAGE_DRONES, all.filter(d => d.id !== id));
  },

  // --- KML E CAMADAS (LOCAL COM LIMPEZA AUTOMÁTICA) ---
  getKmlLayers: async (operationId: string): Promise<TacticalKmlLayer[]> => {
    return getLocal<TacticalKmlLayer>('sysarp_tactical_kml').filter(l => l.operation_id === operationId);
  },

  saveKmlLayer: async (layer: Omit<TacticalKmlLayer, 'id' | 'created_at'>): Promise<TacticalKmlLayer> => {
    const newLayer = { ...layer, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const all = getLocal<TacticalKmlLayer>('sysarp_tactical_kml');
    all.push(newLayer);
    setLocal('sysarp_tactical_kml', all);
    return newLayer;
  },

  updateKmlLayer: async (id: string, updates: Partial<TacticalKmlLayer>): Promise<void> => {
    const all = getLocal<TacticalKmlLayer>('sysarp_tactical_kml');
    const idx = all.findIndex(l => l.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      setLocal('sysarp_tactical_kml', all);
    }
  },

  deleteKmlLayer: async (id: string): Promise<void> => {
    const all = getLocal<TacticalKmlLayer>('sysarp_tactical_kml');
    setLocal('sysarp_tactical_kml', all.filter(l => l.id !== id));
  },

  // --- SNAPSHOTS (STORAGE CLOUD) ---
  saveMapSnapshot: async (operationId: string, base64: string) => {
      if (!isConfigured) return;
      try {
        const res = await fetch(base64);
        const blob = await res.blob();
        const file = new File([blob], `${operationId}.jpg`, { type: 'image/jpeg' });
        
        const { data, error } = await supabase.storage
            .from('mission-files')
            .upload(`snapshots/${operationId}.jpg`, file, { upsert: true });

        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage.from('mission-files').getPublicUrl(data.path);
        
        await supabase.from('operations').update({ 
          shapes: { ...((await supabase.from('operations').select('shapes').eq('id', operationId).single()).data?.shapes || {}), snapshot_url: publicUrl } 
        }).eq('id', operationId);
        
        // Limpa o snapshot antigo do navegador
        const localSnaps = JSON.parse(localStorage.getItem('sysarp_tactical_snapshots') || '{}');
        delete localSnaps[operationId];
        localStorage.setItem('sysarp_tactical_snapshots', JSON.stringify(localSnaps));

      } catch (e) {
        console.error("Erro ao persistir snapshot no Storage:", e);
      }
  },

  getMapSnapshot: (operationId: string): string | null => {
      return null; // As novas versões buscam direto pela URL salva no banco (operations.shapes.snapshot_url)
  }
};