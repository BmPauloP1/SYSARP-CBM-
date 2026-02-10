
import { supabase, isConfigured } from './supabase';
import { Drone, Operation, Pilot, Maintenance, FlightLog, ConflictNotification, DroneChecklist, SystemAuditLog, OperationDay, OperationDayAsset, OperationDayPilot } from '../types';

// Mapeamento de nomes de tabelas
const TABLE_MAP = {
  Operation: 'operations',
  Pilot: 'profiles',
  Drone: 'drones',
  Maintenance: 'maintenances',
  FlightLog: 'flight_logs',
  ConflictNotification: 'conflict_notifications',
  DroneChecklist: 'drone_checklists',
  SystemAudit: 'system_audit',
  OperationDay: 'operation_days',
  OperationDayAsset: 'operation_day_assets',
  OperationDayPilot: 'operation_day_pilots',
  SchemaMigration: 'schema_migrations'
};

const STORAGE_KEYS = {
  Operation: 'sysarp_operations',
  Pilot: 'sysarp_pilots',
  Drone: 'sysarp_drones',
  Maintenance: 'sysarp_maintenance',
  FlightLog: 'sysarp_flight_logs',
  ConflictNotification: 'sysarp_notifications',
  DroneChecklist: 'sysarp_drone_checklists',
  SystemAudit: 'sysarp_system_audit',
  OperationDay: 'sysarp_op_days',
  OperationDayAsset: 'sysarp_op_day_assets',
  OperationDayPilot: 'sysarp_op_day_pilots',
  SchemaMigration: 'sysarp_schema_migrations'
};

const DEFAULT_DRONE_CATALOG = {
  "DJI": ["Matrice 350 RTK", "Matrice 30T", "Matrice 300 RTK", "Mavic 3 Thermal", "Mini 3 Pro"],
  "Autel Robotics": ["EVO II Dual 640T V3", "EVO Max 4T"]
};

const MOCK_ADMIN: Pilot = {
  id: 'admin-local-id',
  full_name: 'Administrador Sistema',
  email: 'admin@sysarp.mil.br',
  role: 'admin',
  status: 'active',
  phone: '41999999999',
  sarpas_code: 'ADMIN01',
  crbm: '1º CRBM - Curitiba (Leste/Litoral)',
  unit: 'BOA - Batalhão de Operações Aéreas',
  license: 'ADMIN-KEY',
  course_type: 'internal',
  course_name: 'Administração de Sistema',
  course_year: 2024,
  course_hours: 9999,
  change_password_required: false,
  terms_accepted: true,
  password: 'admin123'
};

const getLocal = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const setLocal = <T>(key: string, data: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

const seedPilotsIfEmpty = () => {
  const currentPilots = getLocal<Pilot>('sysarp_pilots');
  if (!currentPilots.some(p => p.email === MOCK_ADMIN.email)) {
    currentPilots.unshift(MOCK_ADMIN);
    setLocal('sysarp_pilots', currentPilots);
  }
  return currentPilots;
};

const seedDronesIfEmpty = () => {
  const currentDrones = getLocal<Drone>('sysarp_drones');
  if (currentDrones.length === 0) {
    const seeds: Drone[] = [
      { id: 'seed-1', prefix: 'HARPIA 01', brand: 'DJI', model: 'Matrice 30T', serial_number: 'SN12345678', sisant: 'PP-12345', sisant_expiry_date: '2025-12-31', status: 'available', weight: 3700, max_flight_time: 41, max_range: 7000, max_altitude: 120, payloads: ['Termal'], total_flight_hours: 120.5 }
    ];
    setLocal('sysarp_drones', seeds);
    return seeds;
  }
  return currentDrones;
};

const createEntityHandler = <T extends { id: string }>(entityName: keyof typeof TABLE_MAP) => {
  const tableName = TABLE_MAP[entityName];
  const storageKey = STORAGE_KEYS[entityName];

  return {
    list: async (orderBy?: string): Promise<T[]> => {
      const cachedData = getLocal<T>(storageKey);
      if (!isConfigured || !navigator.onLine) {
        if (entityName === 'Drone') seedDronesIfEmpty();
        if (entityName === 'Pilot') seedPilotsIfEmpty();
        return getLocal<T>(storageKey);
      }

      try {
        let query = supabase.from(tableName).select('*');
        if (orderBy) {
          const ascending = !orderBy.startsWith('-');
          const column = orderBy.replace('-', '');
          query = query.order(column, { ascending });
        } else if (entityName !== 'SchemaMigration') {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await Promise.race([
          query,
          new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 8000))
        ]) as any;
        
        if (error) throw error;
        setLocal(storageKey, data);
        return data as unknown as T[];
      } catch (e: any) {
        if (e.message?.includes("fetch") || e.message === "Timeout") {
           return cachedData;
        }
        return cachedData;
      }
    },

    filter: async (predicate: Partial<T> | ((item: T) => boolean)): Promise<T[]> => {
      const applyLocalFilter = () => {
        const items = getLocal<T>(storageKey);
        if (typeof predicate === 'function') return items.filter(predicate);
        return items.filter(item => Object.entries(predicate).every(([key, value]) => (item as any)[key] === value));
      };

      if (!isConfigured || !navigator.onLine) return applyLocalFilter();

      try {
        if (typeof predicate === 'object') {
          let query = supabase.from(tableName).select('*');
          Object.entries(predicate).forEach(([key, value]) => { query = query.eq(key, value as any); });
          const { data, error } = await query;
          if (error) throw error;
          return data as unknown as T[];
        }
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) throw error;
        return (data as unknown as T[]).filter(predicate);
      } catch { return applyLocalFilter(); }
    },

    create: async (item: Omit<T, 'id' | 'created_at'>): Promise<T> => {
      const createOffline = () => {
         // Fix TypeScript error by converting to unknown first to safely cast to generic type T
         // This is necessary because Omit<T, ...> & { id: string } doesn't strictly overlap with T in TypeScript's view when T is generic
         const newItem = { ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() } as unknown as T;
         const items = getLocal<T>(storageKey); items.unshift(newItem); setLocal(storageKey, items);
         return newItem;
      };
      if (!isConfigured) return createOffline();
      try {
        const { data, error } = await supabase.from(tableName).insert([item]).select().single();
        if (error) throw error;
        return data as T;
      } catch (e: any) {
        if (e.message?.includes("fetch")) return createOffline();
        throw e;
      }
    },

    update: async (id: string, updates: Partial<T>): Promise<T> => {
      if (!isConfigured) {
         const items = getLocal<T>(storageKey);
         const idx = items.findIndex(i => i.id === id);
         if (idx !== -1) { items[idx] = { ...items[idx], ...updates }; setLocal(storageKey, items); return items[idx]; }
         throw new Error("Item not found");
      }
      try {
        const { data, error } = await supabase.from(tableName).update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data as T;
      } catch (e: any) {
        if (e.message?.includes("fetch")) {
            const items = getLocal<T>(storageKey);
            const idx = items.findIndex(i => i.id === id);
            if (idx !== -1) { items[idx] = { ...items[idx], ...updates }; setLocal(storageKey, items); return items[idx]; }
        }
        throw e;
      }
    },

    delete: async (id: string): Promise<void> => {
      if (!isConfigured) { setLocal(storageKey, getLocal<T>(storageKey).filter(i => i.id !== id)); return; }
      try { await supabase.from(tableName).delete().eq('id', id); } catch {}
    }
  };
};

const authHandler = {
  me: async (): Promise<Pilot> => {
    const localSession = localStorage.getItem('sysarp_user_session');
    if (!isConfigured) {
       if (localSession) return JSON.parse(localSession);
       throw new Error("Não autenticado");
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        if (localSession) return JSON.parse(localSession);
        throw new Error("Não autenticado");
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
      if (!profile && localSession) return JSON.parse(localSession);
      return profile as Pilot;
    } catch (e: any) {
      if (localSession) return JSON.parse(localSession);
      throw e;
    }
  },

  login: async (email: string, password?: string): Promise<Pilot> => {
    if (!isConfigured || (email === 'admin@sysarp.mil.br' && password === 'admin123' && !navigator.onLine)) {
      if (email === 'admin@sysarp.mil.br' && password === 'admin123') {
          localStorage.setItem('sysarp_user_session', JSON.stringify(MOCK_ADMIN));
          return MOCK_ADMIN;
      }
      throw new Error("Usuário ou senha inválidos.");
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || '' });
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      if (profile) localStorage.setItem('sysarp_user_session', JSON.stringify(profile));
      return profile as Pilot;
    } catch (e: any) { throw e; }
  },

  createAccount: async (pilotData: Partial<Pilot> & { password?: string }): Promise<void> => {
    if (!isConfigured) return;
    await supabase.auth.signUp({ email: pilotData.email!, password: pilotData.password!, options: { data: pilotData } });
  },

  changePassword: async (userId: string, newPassword: string): Promise<void> => {
    if (isConfigured) await supabase.auth.updateUser({ password: newPassword });
  },

  adminResetPassword: async (userId: string, newPassword: string): Promise<void> => {
    if (isConfigured) await supabase.rpc('admin_reset_user_password', { user_id: userId, new_password: newPassword });
  },

  logout: async () => {
    localStorage.removeItem('sysarp_user_session');
    if (isConfigured) await supabase.auth.signOut();
  },

  system: {
    getCatalog: async () => JSON.parse(localStorage.getItem('droneops_catalog') || JSON.stringify(DEFAULT_DRONE_CATALOG)),
    updateCatalog: async (newCatalog: any) => localStorage.setItem('droneops_catalog', JSON.stringify(newCatalog)),
    diagnose: async () => [{ check: 'Modo', status: isConfigured ? 'ONLINE' : 'LOCAL' }]
  }
};

export const base44 = {
  entities: {
    Operation: createEntityHandler<Operation>('Operation'),
    Pilot: createEntityHandler<Pilot>('Pilot'),
    Drone: createEntityHandler<Drone>('Drone'),
    Maintenance: createEntityHandler<Maintenance>('Maintenance'),
    FlightLog: createEntityHandler<FlightLog>('FlightLog'),
    ConflictNotification: createEntityHandler<ConflictNotification>('ConflictNotification'),
    DroneChecklist: createEntityHandler<DroneChecklist>('DroneChecklist'),
    SystemAudit: createEntityHandler<SystemAuditLog>('SystemAudit'),
    OperationDay: createEntityHandler<OperationDay>('OperationDay'),
    OperationDayAsset: createEntityHandler<OperationDayAsset>('OperationDayAsset'),
    OperationDayPilot: createEntityHandler<OperationDayPilot>('OperationDayPilot'),
    SchemaMigration: createEntityHandler<{ id: string }>('SchemaMigration'),
  },
  auth: authHandler,
  system: authHandler.system,
  integrations: {
    Core: {
      UploadFile: async ({ file }: { file: File }) => {
        if (!isConfigured) return { url: URL.createObjectURL(file) };
        try {
          const { data, error } = await supabase.storage.from('mission-files').upload(`${Date.now()}_${file.name}`, file);
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('mission-files').getPublicUrl(data.path);
          return { url: publicUrl };
        } catch { return { url: URL.createObjectURL(file) }; }
      }
    }
  }
};
