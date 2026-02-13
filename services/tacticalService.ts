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

export const tacticalService = {
  
  // --- SETORES (POLÍGONOS) ---
  getSectors: async (operationId: string): Promise<TacticalSector[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('tactical_sectors').select('*').eq('operation_id', operationId);
    if (error) return [];
    return data || [];
  },

  createSector: async (sector: Omit<TacticalSector, 'id' | 'created_at'>): Promise<TacticalSector> => {
    const { data, error } = await supabase.from('tactical_sectors').insert([sector]).select().single();
    if (error) throw error;
    return data;
  },

  deleteSector: async (id: string): Promise<void> => {
    await supabase.from('tactical_sectors').delete().eq('id', id);
  },

  // --- POIS (PONTOS) ---
  getPOIs: async (operationId: string): Promise<TacticalPOI[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('tactical_pois').select('*').eq('operation_id', operationId);
    if (error) return [];
    return data || [];
  },

  createPOI: async (poi: Omit<TacticalPOI, 'id' | 'created_at'>): Promise<TacticalPOI> => {
    const { data, error } = await supabase.from('tactical_pois').insert([poi]).select().single();
    if (error) throw error;
    return data;
  },

  deletePOI: async (id: string): Promise<void> => {
    await supabase.from('tactical_pois').delete().eq('id', id);
  },

  // --- DRONES TÁTICOS (DESPACHO) ---
  getTacticalDrones: async (operationId: string): Promise<TacticalDrone[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('tactical_drones').select('*').eq('operation_id', operationId);
    if (error) return [];
    return data || [];
  },

  assignDrone: async (assignment: Omit<TacticalDrone, 'id'>): Promise<TacticalDrone> => {
    const { data, error } = await supabase.from('tactical_drones').insert([assignment]).select().single();
    if (error) throw error;
    return data;
  },

  updateDroneStatus: async (id: string, updates: Partial<TacticalDrone>): Promise<void> => {
    await supabase.from('tactical_drones').update(updates).eq('id', id);
  },

  removeDroneFromOp: async (id: string): Promise<void> => {
    await supabase.from('tactical_drones').delete().eq('id', id);
  },

  // --- SNAPSHOTS (STORAGE) ---
  saveMapSnapshot: async (operationId: string, base64: string) => {
      if (!isConfigured) return;
      try {
        const res = await fetch(base64);
        const blob = await res.blob();
        const file = new File([blob], `${operationId}.jpg`, { type: 'image/jpeg' });
        const { data, error } = await supabase.storage.from('mission-files').upload(`snapshots/${operationId}.jpg`, file, { upsert: true });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('mission-files').getPublicUrl(data.path);
        await supabase.from('operations').update({ shapes: { snapshot_url: publicUrl } }).eq('id', operationId);
        
        // Limpa cache local pesado se existir
        localStorage.removeItem('sysarp_tactical_snapshots');
      } catch (e) {
        console.error("Erro no storage snapshot", e);
      }
  },

  getMapSnapshot: (operationId: string): string | null => {
      return null; // Buscado via operations.shapes.snapshot_url no componente de relatórios
  },

  // --- KML LAYERS ---
  getKmlLayers: async (operationId: string): Promise<TacticalKmlLayer[]> => {
    const all = JSON.parse(localStorage.getItem('sysarp_tactical_kml') || '[]');
    return all.filter((l: any) => l.operation_id === operationId);
  },

  saveKmlLayer: async (layer: Omit<TacticalKmlLayer, 'id' | 'created_at'>): Promise<TacticalKmlLayer> => {
    const newLayer = { ...layer, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const all = JSON.parse(localStorage.getItem('sysarp_tactical_kml') || '[]');
    all.push(newLayer);
    localStorage.setItem('sysarp_tactical_kml', JSON.stringify(all));
    return newLayer;
  },

  deleteKmlLayer: async (id: string): Promise<void> => {
    const all = JSON.parse(localStorage.getItem('sysarp_tactical_kml') || '[]');
    localStorage.setItem('sysarp_tactical_kml', JSON.stringify(all.filter((l: any) => l.id !== id)));
  }
};