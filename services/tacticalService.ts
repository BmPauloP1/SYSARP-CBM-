
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
  type: 'base' | 'victim' | 'hazard' | 'landing_zone' | 'interest' | 'ground_team' | 'vehicle' | 'k9';
  lat: number;
  lng: number;
  description?: string;
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
  stream_url?: string; // Adicionado: URL de live individual do drone
  drone?: Drone;
  pilot?: Pilot;
}

const STORAGE_SECTORS = 'sysarp_tactical_sectors';
const STORAGE_POIS = 'sysarp_tactical_pois';
const STORAGE_DRONES = 'sysarp_tactical_drones';
const STORAGE_SNAPSHOTS = 'sysarp_tactical_snapshots'; // Adicionado: Cache de imagens do mapa

const getLocal = <T>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch { return []; }
};

const setLocal = (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data));

export const tacticalService = {
  
  getSectors: async (operationId: string): Promise<TacticalSector[]> => {
    const all = getLocal<TacticalSector>(STORAGE_SECTORS);
    return all.filter(s => s.operation_id === operationId);
  },

  createSector: async (sector: Omit<TacticalSector, 'id' | 'created_at'>): Promise<TacticalSector> => {
    const newSector = {
        ...sector,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        assigned_drones: []
    };
    const all = getLocal<TacticalSector>(STORAGE_SECTORS);
    all.push(newSector);
    setLocal(STORAGE_SECTORS, all);
    return newSector;
  },

  updateSector: async (id: string, updates: Partial<TacticalSector>): Promise<void> => {
    const all = getLocal<TacticalSector>(STORAGE_SECTORS);
    const idx = all.findIndex(s => s.id === id);
    if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        setLocal(STORAGE_SECTORS, all);
    }
  },

  deleteSector: async (sectorId: string): Promise<void> => {
    const all = getLocal<TacticalSector>(STORAGE_SECTORS);
    setLocal(STORAGE_SECTORS, all.filter(s => s.id !== sectorId));
  },

  getPOIs: async (operationId: string): Promise<TacticalPOI[]> => {
    const all = getLocal<TacticalPOI>(STORAGE_POIS);
    return all.filter(p => p.operation_id === operationId);
  },

  createPOI: async (poi: Omit<TacticalPOI, 'id' | 'created_at'>): Promise<TacticalPOI> => {
    const newPOI = {
        ...poi,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
    };
    const all = getLocal<TacticalPOI>(STORAGE_POIS);
    all.push(newPOI);
    setLocal(STORAGE_POIS, all);
    return newPOI;
  },

  deletePOI: async (poiId: string): Promise<void> => {
    const all = getLocal<TacticalPOI>(STORAGE_POIS);
    setLocal(STORAGE_POIS, all.filter(p => p.id !== poiId));
  },

  getTacticalDrones: async (operationId: string): Promise<TacticalDrone[]> => {
    const all = getLocal<TacticalDrone>(STORAGE_DRONES);
    return all.filter(d => d.operation_id === operationId);
  },

  assignDrone: async (assignment: Omit<TacticalDrone, 'id'>): Promise<TacticalDrone> => {
    const newAssignment = {
        ...assignment,
        id: crypto.randomUUID()
    };
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

  // ADICIONADO: Métodos para Snapshot do Mapa
  saveMapSnapshot: (operationId: string, base64: string) => {
      try {
        const snapshots = JSON.parse(localStorage.getItem(STORAGE_SNAPSHOTS) || '{}');
        snapshots[operationId] = base64;
        localStorage.setItem(STORAGE_SNAPSHOTS, JSON.stringify(snapshots));
      } catch (e) {
        console.error("Failed to save snapshot", e);
      }
  },

  getMapSnapshot: (operationId: string): string | null => {
      try {
        const snapshots = JSON.parse(localStorage.getItem(STORAGE_SNAPSHOTS) || '{}');
        // Ensure result is string or null, handle potential corrupt data
        return (snapshots && typeof snapshots === 'object' && snapshots[operationId]) ? String(snapshots[operationId]) : null;
      } catch {
        return null;
      }
  }
};
