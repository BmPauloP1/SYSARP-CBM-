import { supabase, isConfigured } from './supabase';
import { SummerFlight, SummerStats, SummerAuditLog } from '../types_summer';
import { base44 } from './base44Client';

const TABLE = 'op_summer_flights';
const AUDIT_TABLE = 'op_summer_audit';
const STORAGE_KEY = 'sysarp_summer_flights';
const AUDIT_STORAGE_KEY = 'sysarp_summer_audit';

// Helpers LocalStorage
const getLocal = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLocal = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

export const operationSummerService = {
  
  list: async (): Promise<SummerFlight[]> => {
    if (!isConfigured) return getLocal(STORAGE_KEY);
    
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*, operation:operations(latitude, longitude)')
        .order('date', { ascending: false });
        
      if (error) throw error;
      
      // Flatten the join result to attach coordinates directly
      const flattenedData = (data || []).map((f: any) => {
        const { operation, ...rest } = f;
        if (operation) {
          return { ...rest, latitude: operation.latitude, longitude: operation.longitude };
        }
        return rest;
      });

      return flattenedData as SummerFlight[];
    } catch (e) {
      return getLocal(STORAGE_KEY);
    }
  },

  create: async (flight: Omit<SummerFlight, 'id' | 'created_at'>, userId: string): Promise<SummerFlight> => {
    // Calcular duração se não vier
    if (!flight.flight_duration) {
      const today = new Date().toISOString().split('T')[0];
      const start = new Date(`${today}T${flight.start_time}`);
      const end = new Date(`${today}T${flight.end_time}`);
      // Fallback para duração se as datas forem inválidas
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          flight.flight_duration = Math.round((end.getTime() - start.getTime()) / 60000);
          if (flight.flight_duration < 0) flight.flight_duration += 1440; // Ajuste virada de dia
      } else {
          flight.flight_duration = 0;
      }
    }

    const auditEntry = {
      user_id: userId,
      action: 'CREATE',
      details: `Voo registrado em ${flight.location} (${flight.mission_type})`,
      timestamp: new Date().toISOString()
    };

    if (!isConfigured) {
      const newItem = { ...flight, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      const items = getLocal(STORAGE_KEY);
      items.push(newItem);
      setLocal(STORAGE_KEY, items);

      // Local Audit
      const audits = getLocal(AUDIT_STORAGE_KEY);
      audits.push({ ...auditEntry, id: crypto.randomUUID(), flight_id: newItem.id });
      setLocal(AUDIT_STORAGE_KEY, audits);

      return newItem as SummerFlight;
    }

    // Tenta upsert para evitar duplicidade se já existir ID da operação
    let query = supabase.from(TABLE).insert([flight]);
    
    // Se tiver operation_id, verifica antes (opcional, mas seguro)
    if (flight.operation_id) {
        const { data: existing } = await supabase.from(TABLE).select('id').eq('operation_id', flight.operation_id).single();
        if (existing) {
            // Atualiza se já existe
            const { data, error } = await supabase.from(TABLE).update(flight).eq('id', existing.id).select().single();
            if (error) throw error;
            return data as SummerFlight;
        }
    }

    const { data, error } = await query.select().single();

    if (error) throw error;

    // Log Auditoria Remota (Best Effort)
    try {
      await supabase.from(AUDIT_TABLE).insert({
        flight_id: data.id,
        ...auditEntry
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar auditoria (create):", auditErr);
    }

    return data as SummerFlight;
  },

  // NOVA FUNÇÃO: Sincroniza operações marcadas como 'is_summer_op' que não estão na tabela de verão
  syncMissingFlights: async (userId: string): Promise<number> => {
    if (!isConfigured) return 0;

    try {
        // 1. Buscar todas as operações marcadas como verão na tabela principal
        const { data: allOps, error: opError } = await supabase
            .from('operations')
            .select('*')
            .eq('is_summer_op', true);
        
        if (opError) throw opError;
        if (!allOps || allOps.length === 0) return 0;

        // 2. Buscar IDs que já existem na tabela summer
        const { data: existingSummer, error: sumError } = await supabase
            .from(TABLE)
            .select('operation_id');
            
        if (sumError) throw sumError;
        
        const existingOpIds = new Set(existingSummer?.map((s: any) => s.operation_id).filter(Boolean));

        // 3. Identificar faltantes
        const missingOps = allOps.filter((op: any) => !existingOpIds.has(op.id));

        if (missingOps.length === 0) return 0;

        // 4. Criar registros faltantes
        let createdCount = 0;
        for (const op of missingOps) {
            try {
                // Extrair data e hora do start_time ISO string
                const dateObj = new Date(op.start_time);
                const dateStr = dateObj.toISOString().split('T')[0];
                const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                
                // Extrair location do nome (remove 'VERÃO: ' se existir)
                let loc = op.name.replace('VERÃO: ', '').replace('VERÃO ', '').trim();
                if (!loc) loc = "Local não especificado";
                
                // Calcular duração aproximada
                let duration = 0;
                let endTimeStr = '23:59';
                
                if (op.end_time) {
                    const endObj = new Date(op.end_time);
                    duration = Math.round((endObj.getTime() - dateObj.getTime()) / 60000);
                    endTimeStr = endObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                } else if (op.flight_hours) {
                    duration = Math.round(op.flight_hours * 60);
                    // Estima fim
                    const endObj = new Date(dateObj.getTime() + duration * 60000);
                    endTimeStr = endObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                }

                const payload = {
                    operation_id: op.id,
                    pilot_id: op.pilot_id,
                    drone_id: op.drone_id,
                    mission_type: op.mission_type,
                    location: loc,
                    date: dateStr,
                    start_time: timeStr,
                    end_time: endTimeStr,
                    flight_duration: duration > 0 ? duration : 0,
                    notes: op.description || "Recuperado via Sincronização",
                    evidence_photos: [],
                    evidence_videos: []
                };

                // Usa a função create que já temos, que trata auditoria
                await operationSummerService.create(payload as any, userId);
                createdCount++;
            } catch (err) {
                console.error(`Erro ao sincronizar operação ${op.id}:`, err);
            }
        }

        return createdCount;

    } catch (e) {
        console.error("Erro geral na sincronização:", e);
        throw e;
    }
  },

  delete: async (ids: string[], userId: string): Promise<void> => {
    if (!isConfigured) {
      const items = getLocal(STORAGE_KEY);
      const filtered = items.filter((i: any) => !ids.includes(i.id));
      setLocal(STORAGE_KEY, filtered);
      return;
    }

    try {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .in('id', ids);

      if (error) throw error;

      try {
        await supabase.from(AUDIT_TABLE).insert({
          user_id: userId,
          action: 'DELETE',
          details: `Exclusão de ${ids.length} registro(s).`,
          timestamp: new Date().toISOString()
        });
      } catch (auditError: any) {
        console.warn("Aviso: Falha ao criar log de auditoria para exclusão:", auditError.message);
      }

    } catch (e: any) {
      console.error("Erro crítico ao excluir voos:", e);
      throw new Error(e.message || "Erro desconhecido ao excluir registros.");
    }
  },

  getStats: async (): Promise<SummerStats> => {
    const flights = await operationSummerService.list();
    
    const stats: SummerStats = {
      total_flights: flights.length,
      total_hours: 0,
      flights_by_mission: {},
      flights_by_drone: {},
      top_locations: {}
    };

    flights.forEach(f => {
      stats.total_hours += (f.flight_duration || 0) / 60;
      
      stats.flights_by_mission[f.mission_type] = (stats.flights_by_mission[f.mission_type] || 0) + 1;
      stats.flights_by_drone[f.drone_id] = (stats.flights_by_drone[f.drone_id] || 0) + 1;
      stats.top_locations[f.location] = (stats.top_locations[f.location] || 0) + 1;
    });

    return stats;
  },

  getAuditLogs: async (): Promise<SummerAuditLog[]> => {
    if (!isConfigured) return getLocal(AUDIT_STORAGE_KEY);
    try {
        const { data, error } = await supabase.from(AUDIT_TABLE).select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.debug("Failed to fetch audit logs (offline fallback)", e);
        return getLocal(AUDIT_STORAGE_KEY);
    }
  }
};