
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

// Chaves do LocalStorage para Fallback Offline
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

// Default Catalog Data
const DEFAULT_DRONE_CATALOG = {
  "DJI": ["Matrice 350 RTK", "Matrice 30T", "Matrice 300 RTK", "Mavic 3 Thermal", "Mavic 3 Enterprise", "Agras T40", "Mini 3 Pro"],
  "Autel Robotics": ["EVO II Dual 640T V3", "EVO Max 4T"],
  "Teledyne FLIR": ["SIRAS", "Black Hornet 3"],
  "XAG": ["P100 Pro", "V40"]
};

// MOCK ADMIN USER (Backdoor)
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

// Helpers para LocalStorage
const getLocal = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn("Erro ao ler cache local:", e);
    return [];
  }
};

const setLocal = <T>(key: string, data: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Erro ao salvar cache local (quota excedida?):", e);
  }
};

// Seed Data para Pilotos (Garante Admin)
const seedPilotsIfEmpty = () => {
  const currentPilots = getLocal<Pilot>('sysarp_pilots');
  if (!currentPilots.some(p => p.email === MOCK_ADMIN.email)) {
    currentPilots.unshift(MOCK_ADMIN);
    setLocal('sysarp_pilots', currentPilots);
  }
  return currentPilots;
};

// Seed Data para Aeronaves
const seedDronesIfEmpty = () => {
  const currentDrones = getLocal<Drone>('sysarp_drones');
  if (currentDrones.length === 0) {
    const today = new Date();
    const tenDaysAgo = new Date(today); tenDaysAgo.setDate(today.getDate() - 10);
    const twentyFiveDaysAgo = new Date(today); twentyFiveDaysAgo.setDate(today.getDate() - 25);

    const seeds: Drone[] = [
      {
        id: 'seed-1',
        prefix: 'HARPIA 01',
        brand: 'DJI',
        model: 'Matrice 30T',
        serial_number: 'SN12345678',
        sisant: 'PP-12345',
        sisant_expiry_date: '2025-12-31',
        status: 'available',
        weight: 3700,
        max_flight_time: 41,
        max_range: 7000,
        max_altitude: 120,
        payloads: ['Termal', 'Zoom'],
        total_flight_hours: 120.5,
        last_30day_check: tenDaysAgo.toISOString()
      },
      {
        id: 'seed-2',
        prefix: 'HARPIA 02',
        brand: 'DJI',
        model: 'Mavic 3 Thermal',
        serial_number: 'SN87654321',
        sisant: 'PP-54321',
        sisant_expiry_date: '2026-06-30',
        status: 'available',
        weight: 920,
        max_flight_time: 45,
        max_range: 5000,
        max_altitude: 120,
        payloads: ['Termal'],
        total_flight_hours: 45.2,
        last_30day_check: twentyFiveDaysAgo.toISOString()
      }
    ];
    setLocal('sysarp_drones', seeds);
    return seeds;
  }
  return currentDrones;
};


// Generic Entity Handler
const createEntityHandler = <T extends { id: string }>(entityName: keyof typeof TABLE_MAP) => {
  const tableName = TABLE_MAP[entityName];
  const storageKey = STORAGE_KEYS[entityName];

  return {
    list: async (orderBy?: string): Promise<T[]> => {
      const cachedData = getLocal<T>(storageKey);

      // 1. Verificação Rápida de Conexão ou Configuração
      if (!isConfigured || !navigator.onLine) {
        if (entityName === 'Drone') seedDronesIfEmpty();
        if (entityName === 'Pilot') seedPilotsIfEmpty();
        return getLocal<T>(storageKey);
      }

      // 2. Lógica de Timeout Adaptativo
      const hasCache = cachedData.length > 0;
      const adaptiveTimeout = hasCache ? 2500 : 12000;

      try {
        let query = supabase.from(tableName).select('*');
        if (orderBy) {
          const ascending = !orderBy.startsWith('-');
          const column = orderBy.replace('-', '');
          query = query.order(column, { ascending });
        } else {
          // A tabela de migrations não tem 'created_at', então usamos 'id'
          if (entityName !== 'SchemaMigration') {
             query = query.order('created_at', { ascending: false });
          }
        }

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), adaptiveTimeout)
        );

        const { data, error } = await Promise.race([query, timeoutPromise]) as any;
        
        if (error) throw error;
        
        // SUCESSO: Atualiza o Cache Local
        setLocal(storageKey, data);
        
        return data as unknown as T[];
      } catch (e: any) {
        const msg = e.message || '';
        
        // NOVO: Tratamento específico para a tabela de migrações que pode não existir na primeira execução.
        if (entityName === 'SchemaMigration' && msg.includes("relation") && msg.includes("does not exist")) {
            console.warn("[SYSARP DB] Tabela 'schema_migrations' não encontrada, assumindo primeira execução.");
            setLocal(storageKey, []); // Limpa o cache local para garantir consistência
            return []; // Retorna array vazio, permitindo que o script de criação seja exibido.
        }
        
        // CORREÇÃO: Tratamento silencioso de erro de conexão ("Failed to fetch")
        if (msg.includes("Failed to fetch") || msg === "Timeout") {
           console.warn(`[Offline Mode] Falha ao conectar ao servidor para ${entityName}. Usando cache local.`);
           
           if (cachedData.length === 0) {
               if (entityName === 'Drone') return seedDronesIfEmpty() as any;
               if (entityName === 'Pilot') return seedPilotsIfEmpty() as any;
           }
           
           return cachedData;
        }

        // Se for outro erro (ex: tabela inexistente), loga mas não quebra se tiver cache
        console.error(`Erro ao carregar ${entityName}:`, e);
        if (hasCache) return cachedData;
        
        return [];
      }
    },

    filter: async (predicate: Partial<T> | ((item: T) => boolean)): Promise<T[]> => {
      const applyLocalFilter = () => {
        const items = getLocal<T>(storageKey);
        if (typeof predicate === 'function') {
          return items.filter(predicate);
        } else {
          return items.filter(item => Object.entries(predicate).every(([key, value]) => (item as any)[key] === value));
        }
      };

      if (!isConfigured || !navigator.onLine) {
         if (entityName === 'Pilot') seedPilotsIfEmpty();
         return applyLocalFilter();
      }

      // Adaptive Timeout também para filtros
      const cachedData = getLocal<T>(storageKey);
      const hasCache = cachedData.length > 0;
      const adaptiveTimeout = hasCache ? 2500 : 8000;

      try {
        if (typeof predicate === 'object') {
          let query = supabase.from(tableName).select('*');
          Object.entries(predicate).forEach(([key, value]) => {
            query = query.eq(key, value as any);
          });
          
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), adaptiveTimeout));
          const { data, error } = await Promise.race([query, timeoutPromise]) as any;
          
          if (error) throw error;
          
          return data as unknown as T[];
        }
        
        // Se o predicado for função, precisamos buscar tudo
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) throw error;
        
        setLocal(storageKey, data); 
        return (data as unknown as T[]).filter(predicate);

      } catch (e: any) {
        // Fallback silently on fetch error
        if (e.message?.includes("Failed to fetch") || e.message === "Timeout") {
           return applyLocalFilter();
        }
        console.warn(`Filter fallback for ${entityName}`, e);
        return applyLocalFilter();
      }
    },

    create: async (item: Omit<T, 'id' | 'created_at'>): Promise<T> => {
      const cleanItem = JSON.parse(JSON.stringify(item));
      if ('password' in cleanItem) delete cleanItem.password;
      
      const updateLocalCache = (newItem: T) => {
         const items = getLocal<T>(storageKey);
         items.unshift(newItem);
         setLocal(storageKey, items);
      };

      // Helper function for offline creation
      const createOffline = () => {
         const newItem = { 
             ...cleanItem, 
             id: crypto.randomUUID(), 
             created_at: new Date().toISOString() 
         } as T;
         updateLocalCache(newItem);
         return newItem;
      };

      if (!isConfigured) {
        return createOffline();
      }

      try {
        // Create usually needs longer timeout as it's critical
        const { data, error } = await supabase
          .from(tableName)
          .insert([cleanItem])
          .select()
          .single();
        
        if (error) throw error;
        
        updateLocalCache(data as T);
        return data as T;

      } catch (e: any) {
        const msg = e.message || '';
        
        // Network or Fetch error -> Fallback to Offline Mode
        if (msg.includes("Failed to fetch") || msg.includes("Timeout")) {
          console.warn(`[Offline Fallback] Erro de conexão ao criar ${entityName}. Salvando localmente.`);
          return createOffline();
        }

        const missingCol = msg.match(/Could not find the '(.+?)' column/)?.[1];
        if (missingCol) {
           // Fallback gracioso para a tabela de Auditoria se ela não existir
           if (entityName === 'SystemAudit' || entityName === 'SchemaMigration') {
             return createOffline();
           }
           // Fallback para novas tabelas de Operações Multidias
           if (['OperationDay', 'OperationDayAsset', 'OperationDayPilot'].includes(entityName)) {
             throw new Error("DB_TABLE_MISSING");
           }
           throw new Error(`Banco de Dados desatualizado: Falta a coluna '${missingCol}' na tabela '${tableName}'.`);
        }
        
        if (msg.includes("relation") && msg.includes("does not exist")) {
             // Fallback gracioso se a tabela de migrações não existir no primeiro uso
             if(entityName === 'SchemaMigration') return createOffline();
             throw new Error("DB_TABLE_MISSING");
        }
        
        // Fallback for SystemAudit on any error to prevent blocking main flow
        if (entityName === 'SystemAudit') {
           return createOffline();
        }

        throw new Error(`Erro ao salvar: ${msg}`);
      }
    },

    update: async (id: string, updates: Partial<T>): Promise<T> => {
      const updateLocalCache = (updatedItem: T) => {
         const items = getLocal<T>(storageKey);
         const index = items.findIndex(i => i.id === id);
         if (index !== -1) {
            items[index] = { ...items[index], ...updatedItem };
            setLocal(storageKey, items);
         }
         return items[index];
      };

      const updateOffline = () => {
         const items = getLocal<T>(storageKey);
         const index = items.findIndex(i => i.id === id);
         if (index === -1) throw new Error("Item não encontrado localmente para atualização offline.");
         
         const updatedItem = { ...items[index], ...updates };
         items[index] = updatedItem;
         setLocal(storageKey, items);
         return updatedItem;
      };

      if (!isConfigured) {
        return updateOffline();
      }

      try {
        const { data, error } = await supabase
          .from(tableName)
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        
        updateLocalCache(data as T);
        return data as T;
      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes("Failed to fetch") || msg.includes("Timeout")) {
           console.warn(`[Offline Fallback] Erro de conexão ao atualizar ${entityName}. Atualizando localmente.`);
           return updateOffline();
        }
        throw new Error(`Erro ao atualizar: ${msg}`);
      }
    },

    delete: async (id: string): Promise<void> => {
      const updateLocalCache = () => {
         const items = getLocal<T>(storageKey);
         const filtered = items.filter(i => i.id !== id);
         setLocal(storageKey, filtered);
      };

      if (!isConfigured) {
        updateLocalCache();
        return;
      }

      try {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw error;
        updateLocalCache();
      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes("Failed to fetch") || msg.includes("Timeout")) {
           console.warn(`[Offline Fallback] Erro de conexão ao excluir ${entityName}. Excluindo localmente.`);
           updateLocalCache();
           return;
        }
        throw new Error(`Erro ao excluir: ${msg}`);
      }
    }
  };
};

// Auth Handler
const authHandler = {
  me: async (): Promise<Pilot> => {
    const isAdminSession = localStorage.getItem('sysarp_admin_session');
    const localSession = localStorage.getItem('sysarp_user_session');
    
    // Check Local Session First if Offline is suspected or forced
    if (!isConfigured) {
       if (isAdminSession === 'true') return MOCK_ADMIN;
       if (localSession) return JSON.parse(localSession) as Pilot;
       throw new Error("Sessão não encontrada (Offline)");
    } else {
       if (isAdminSession) localStorage.removeItem('sysarp_admin_session');
    }

    try {
      // Short timeout for auth check to prevent hanging on load
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));
      
      const { data: authData, error: authError } = await Promise.race([
          supabase.auth.getUser(), 
          timeoutPromise
      ]) as any;

      if (authError || !authData?.user) {
        // CORREÇÃO CRÍTICA: Se houver erro de token inválido, limpa a sessão local para evitar loop de erro
        if (authError?.message?.includes("Refresh Token") || authError?.message?.includes("Invalid session")) {
            console.warn("[Auth] Sessão inválida ou expirada detectada. Limpando estado local.");
            localStorage.removeItem('sysarp_user_session');
            localStorage.removeItem('sb-hcnlrzzwwcbhkxfcolgw-auth-token'); // Limpa token do Supabase
        }
        throw new Error(authError?.message || "Não autenticado");
      }

      const user = authData.user;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
         // Auto-healing logic
         try {
           const { data: newProfile } = await supabase
              .from('profiles')
              .insert([{
                  id: user.id,
                  email: user.email,
                  full_name: user.user_metadata.full_name || 'Usuário Recuperado',
                  role: 'operator',
                  status: 'pending',
                  terms_accepted: true
              }])
              .select()
              .single();
              
           if(newProfile) return newProfile as Pilot;
         } catch(err) {
           console.error("Auto-healing falhou:", err);
         }
         throw new Error("Perfil não encontrado.");
      }
      return profile as Pilot;
    } catch (e: any) {
      // Fallback para sessão local se a rede falhar
      if (localSession && (e.message.includes("Failed to fetch") || e.message === "Timeout")) {
         console.warn("[Auth] Network error, using local session.");
         return JSON.parse(localSession) as Pilot;
      }
      throw e;
    }
  },

  login: async (email: string, password?: string): Promise<Pilot> => {
    const adminEmails = ['admin', 'admin@admin.com', 'admin@sysarp.mil.br'];
    
    if (!password) throw new Error("Senha obrigatória");

    // Offline / Mock Admin Logic
    if (!isConfigured || (adminEmails.includes(email.toLowerCase()) && password === 'admin123' && !navigator.onLine)) {
      if(adminEmails.includes(email.toLowerCase()) && password === 'admin123') {
        localStorage.setItem('sysarp_admin_session', 'true');
        // Audit Mock
        const auditLog = { user_id: MOCK_ADMIN.id, action: 'LOGIN', entity: 'System', details: 'Login de Admin (Offline)', timestamp: new Date().toISOString() };
        const logs = getLocal('sysarp_system_audit'); logs.unshift(auditLog); setLocal('sysarp_system_audit', logs);
        return MOCK_ADMIN;
      }
      const pilots = seedPilotsIfEmpty();
      const pilot = pilots.find(p => p.email === email);
      if (pilot && pilot.password === password) {
         if (pilot.status === 'pending') throw new Error("Cadastro aguardando validação do administrador.");
         localStorage.setItem('sysarp_user_session', JSON.stringify(pilot));
         return pilot;
      }
      throw new Error("Usuário não encontrado ou senha incorreta (Modo Offline)");
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.includes("Failed to fetch")) throw new Error("Erro de Conexão: Não foi possível conectar ao servidor.");
        if (error.message.includes("Email not confirmed")) throw new Error("E-mail não confirmado. Verifique sua caixa de entrada.");
        if (error.message.includes("Email logins are disabled")) throw new Error("Login por email desativado.");
        throw error;
      }
      if (!data.user) throw new Error("Erro no login");

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();

      if (!profile) {
         const tempProfile = { 
             id: data.user.id, 
             email: data.user.email!, 
             full_name: 'Perfil Pendente', 
             role: 'operator', 
             status: 'pending' 
         } as Pilot;
         localStorage.setItem('sysarp_user_session', JSON.stringify(tempProfile));
         return tempProfile;
      }

      if (profile.status === 'pending') {
          await supabase.auth.signOut();
          throw new Error("Seu cadastro está aguardando validação administrativa. Por favor, aguarde.");
      }

      if (profile.status === 'inactive') {
          await supabase.auth.signOut();
          throw new Error("Esta conta está desativada. Entre em contato com o suporte.");
      }

      localStorage.setItem('sysarp_user_session', JSON.stringify(profile));

      // Audit Login
      try {
          base44.entities.SystemAudit.create({
              user_id: profile.id,
              action: 'LOGIN',
              entity: 'Auth',
              details: 'Login realizado com sucesso',
              timestamp: new Date().toISOString()
          });
      } catch(e) { console.warn("Erro ao auditar login", e); }

      return profile as Pilot;
    } catch (e: any) {
      console.warn("Login Supabase falhou:", e);
      throw e; 
    }
  },

  createAccount: async (pilotData: Partial<Pilot> & { password?: string }): Promise<void> => {
     if (!pilotData.email || !pilotData.password) throw new Error("Email e senha obrigatórios");
    
     if (!isConfigured) {
       const pilots = getLocal<Pilot>('sysarp_pilots');
       const newPilot: Pilot = {
         ...pilotData, id: crypto.randomUUID(), role: 'operator', status: 'pending',
         full_name: pilotData.full_name!, email: pilotData.email!, 
         password: pilotData.password, change_password_required: false,
         terms_accepted_at: new Date().toISOString()
       } as Pilot;
       pilots.push(newPilot); setLocal('sysarp_pilots', pilots);
       return;
     }
 
     try {
       if (!navigator.onLine) throw new Error("Sem conexão com a internet.");
 
       const metaData = {
         full_name: pilotData.full_name || 'Usuário',
         phone: pilotData.phone || '',
         sarpas_code: pilotData.sarpas_code || '',
         crbm: pilotData.crbm || '',
         unit: pilotData.unit || '',
         license: pilotData.license || '',
         role: pilotData.role || 'operator',
         status: 'pending', // Garante status pendente no metadata
         terms_accepted: pilotData.terms_accepted || false,
         change_password_required: pilotData.change_password_required === true
       };
 
       const { data, error } = await supabase.auth.signUp({
         email: pilotData.email, 
         password: pilotData.password,
         options: { data: metaData }
       });
 
       if (error) throw error;
       if (!data.user) throw new Error("Erro ao criar usuário no Auth.");
 
       // Perfil é criado via trigger no DB. Não é mais necessário upsert no cliente.
 
     } catch (e: any) {
       const msg = e.message || '';
       if (msg.includes("Failed to fetch")) {
         throw new Error("Não foi possível conectar ao servidor Supabase.");
       }
       throw new Error(msg || "Erro no cadastro.");
     }
  },

  changePassword: async (userId: string, newPassword: string): Promise<void> => {
     if (userId === MOCK_ADMIN.id) return;
     const termsAcceptedAt = new Date().toISOString();
 
     if (!isConfigured) {
       const pilots = getLocal<Pilot>('sysarp_pilots');
       const index = pilots.findIndex(p => p.id === userId);
       if (index !== -1) {
         pilots[index].password = newPassword;
         pilots[index].change_password_required = false;
         pilots[index].terms_accepted = true;
         setLocal('sysarp_pilots', pilots);
       }
       return;
     }
 
     try {
       const { error } = await supabase.auth.updateUser({ password: newPassword });
       if (error) throw error;
       await supabase.from('profiles').update({ 
         change_password_required: false,
         terms_accepted: true,
         terms_accepted_at: termsAcceptedAt
       }).eq('id', userId);

       // Audit
       base44.entities.SystemAudit.create({
            user_id: userId,
            action: 'UPDATE',
            entity: 'Auth',
            details: 'Senha alterada pelo usuário',
            timestamp: new Date().toISOString()
       });

     } catch (e) {
       console.error(e);
     }
  },

  adminResetPassword: async (userId: string, newPassword: string): Promise<void> => {
    if (!isConfigured) {
        const pilots = getLocal<Pilot>('sysarp_pilots');
        const index = pilots.findIndex(p => p.id === userId);
        if (index !== -1) {
            pilots[index].password = newPassword;
            pilots[index].change_password_required = true;
            setLocal('sysarp_pilots', pilots);
        }
        return;
    }

    try {
        const { error } = await supabase.rpc('admin_reset_user_password', {
            user_id: userId,
            new_password: newPassword
        });

        if (error) {
            // Specific error for missing function
            if (error.code === '42883' || error.message.includes('function admin_reset_user_password')) {
                throw new Error("RPC_NOT_FOUND");
            }
            throw error;
        }

        // Also force change_password_required to true on the profile client-side for consistency
        await base44.entities.Pilot.update(userId, { change_password_required: true });

    } catch (e: any) {
        console.error("RPC adminResetPassword failed:", e);
        throw e;
    }
  },

  logout: async () => {
    // Try to log logout action before removing session
    try {
        const localSession = localStorage.getItem('sysarp_user_session');
        if (localSession) {
            const user = JSON.parse(localSession);
            await base44.entities.SystemAudit.create({
                user_id: user.id,
                action: 'LOGOUT',
                entity: 'Auth',
                details: 'Logout realizado',
                timestamp: new Date().toISOString()
            });
        }
    } catch(e) {}

    localStorage.removeItem('sysarp_admin_session');
    localStorage.removeItem('sysarp_user_session');
    if (isConfigured) await supabase.auth.signOut();
  },

  system: {
    getCatalog: async (): Promise<Record<string, string[]>> => {
       const stored = localStorage.getItem('droneops_catalog');
       return stored ? JSON.parse(stored) : DEFAULT_DRONE_CATALOG;
    },
    updateCatalog: async (newCatalog: Record<string, string[]>) => {
       localStorage.setItem('droneops_catalog', JSON.stringify(newCatalog));
    },
    diagnose: async () => {
      const results = [];
      const pilotsCache = getLocal<Pilot>('sysarp_pilots');
      results.push({ 
          check: 'Cache Local', 
          status: pilotsCache.length > 0 ? 'OK' : 'WARN', 
          message: `${pilotsCache.length} pilotos em cache.` 
      });

      if (!isConfigured) {
          results.push({ check: 'Conexão Supabase', status: 'OFFLINE', message: 'Rodando em modo local.' });
          return results;
      }

      try {
        const { error } = await supabase.from('profiles').select('count').limit(1).single();
        if (error) throw error;
        results.push({ check: 'Conexão Supabase', status: 'OK', message: 'Conectado e respondendo.' });
      } catch (e: any) {
        results.push({ check: 'Conexão Supabase', status: 'ERROR', message: e.message });
      }

      return results;
    }
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

        const fileName = `${Date.now()}_${file.name}`;
        try {
          const { error } = await supabase.storage.from('mission-files').upload(fileName, file);
          if (error) throw error;
          
          const { data: { publicUrl } } = supabase.storage.from('mission-files').getPublicUrl(fileName);
          return { url: publicUrl };
        } catch (e) {
          console.warn("Upload offline fallback.");
          return { url: URL.createObjectURL(file) };
        }
      }
    }
  }
};
