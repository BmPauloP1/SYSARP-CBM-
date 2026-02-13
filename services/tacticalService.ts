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
  stream_url?: string; // Adicionado suporte a live em setores (ex: monitoramento de perímetro)
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
  geojson: any;
  visible: boolean;
  color: string;
}

export const tacticalService = {
  
  getSectors: async (operationId: string): Promise<TacticalSector[]> => {
    if (!isConfigured) return [];
    const { data } = await supabase.from('tactical_sectors').select('*').eq('operation_id', operationId);
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

  getPOIs: async (operationId: string): Promise<TacticalPOI[]> => {
    if (!isConfigured) return [];
    const { data } = await supabase.from('tactical_pois').select('*').eq('operation_id', operationId);
    return data || [];
  },

  createPOI: async (poi: Omit<TacticalPOI, 'id' | 'created_at'>): Promise<TacticalPOI> => {
    const { data, error } = await supabase.from('tactical_pois').insert([poi]).select().single();
    if (error) throw error;
    return data;
  },

  updatePOI: async (id: string, updates: Partial<TacticalPOI>): Promise<void> => {
    await supabase.from('tactical_pois').update(updates).eq('id', id);
  },

  deletePOI: async (id: string): Promise<void> => {
    await supabase.from('tactical_pois').delete().eq('id', id);
  },

  getTacticalDrones: async (operationId: string): Promise<TacticalDrone[]> => {
    if (!isConfigured) return [];
    const { data } = await supabase.from('tactical_drones').select('*').eq('operation_id', operationId);
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

  saveKmlLayer: (opId: string, layer: TacticalKmlLayer) => {
    const key = `sysarp_kml_${opId}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    current.push(layer);
    localStorage.setItem(key, JSON.stringify(current));
  },

  getKmlLayers: (opId: string): TacticalKmlLayer[] => {
    const key = `sysarp_kml_${opId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  },

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
      } catch (e) { console.error(e); }
  }
};