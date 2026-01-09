
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
    // Calcular duração se não vier definida
    if (flight.flight_duration === undefined || flight.flight_duration === null) {
      const today = new Date().toISOString().split('T')[0];
      const start = new Date(`${today}T${flight.start_time}`);
      const end = new Date(`${today}T${flight.end_time}`);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          flight.flight_duration = Math.round((end.getTime() - start.getTime()) / 60000);
          if (flight.flight_duration < 0) flight.flight_duration += 1440; 
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
      return newItem as SummerFlight;
    }

    const { data, error } = await supabase.from(TABLE).insert([flight]).select().single();
    if (error) throw error;

    try { await supabase.from(AUDIT_TABLE).insert({ flight_id: data.id, ...auditEntry }); } catch (e) {}

    return data as SummerFlight;
  },

  update: async (id: string, updates: Partial<SummerFlight>, userId: string): Promise<void> => {
    const cleanUpdates = { ...updates };
    delete (cleanUpdates as any).id;
    delete (cleanUpdates as any).created_at;
    delete (cleanUpdates as any).latitude;
    delete (cleanUpdates as any).longitude;
    delete (cleanUpdates as any).operation;

    // LÓGICA DE SEGURANÇA:
    // Se a atualização contiver flight_duration explícito (vindo de edição manual ou sync), respeite-o.
    // Apenas recalcule se o usuário mexer nos horários E não fornecer a duração.
    if (cleanUpdates.start_time && cleanUpdates.end_time && (cleanUpdates.flight_duration === undefined || cleanUpdates.flight_duration === null)) {
       const dummyDate = '2024-01-01';
       const start = new Date(`${dummyDate}T${cleanUpdates.start_time}`);
       const end = new Date(`${dummyDate}T${cleanUpdates.end_time}`);
       if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
           let diff = Math.round((end.getTime() - start.getTime()) / 60000);
           if (diff < 0) diff += 1440;
           cleanUpdates.flight_duration = diff;
       }
    }

    if (!isConfigured) {
        const items = getLocal(STORAGE_KEY);
        const idx = items.findIndex((i: any) => i.id === id);
        if (idx !== -1) {
            items[idx] = { ...items[idx], ...cleanUpdates };
            setLocal(STORAGE_KEY, items);
        }
        return;
    }

    try {
        const { error } = await supabase.from(TABLE).update(cleanUpdates).eq('id', id);
        if (error) throw error;

        await supabase.from(AUDIT_TABLE).insert({
            user_id: userId,
            action: 'UPDATE',
            details: `Registro atualizado (Duração: ${cleanUpdates.flight_duration} min).`,
            timestamp: new Date().toISOString()
        });

    } catch (e: any) {
        console.error("Erro ao atualizar voo:", e);
        throw new Error(e.message || "Falha na atualização do registro.");
    }
  },

  // FUNÇÃO REESCRITA: Prioridade Absoluta para Horas Voadas (Motor)
  syncMissingFlights: async (userId: string): Promise<number> => {
    if (!isConfigured) return 0;

    try {
        // 1. Buscar APENAS operações marcadas como verão
        const { data: allOps, error: opError } = await supabase
            .from('operations')
            .select('*')
            .eq('is_summer_op', true);
        
        if (opError) throw opError;
        if (!allOps || allOps.length === 0) return 0;

        // 2. Buscar registros já existentes na tabela summer para comparação
        const { data: existingSummer, error: sumError } = await supabase
            .from(TABLE)
            .select('*'); 
            
        if (sumError) throw sumError;
        
        // Mapeia ID da Operação -> Registro de Verão Existente
        const existingMap = new Map();
        existingSummer?.forEach((s: any) => {
            if (s.operation_id) existingMap.set(s.operation_id, s);
        });

        let changesCount = 0;

        // 3. Iterar sobre as operações de verão
        for (const op of allOps) {
            try {
                // Preparar dados calculados da Operação Geral
                const dateObj = new Date(op.start_time);
                
                // Data Local Estável
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                // Remove prefixo para limpar o local
                const loc = op.name.replace('VERÃO: ', '');
                
                let durationMinutes = 0;
                let endTimeStr = '23:59'; // Valor padrão caso algo falhe

                const rawFlightHours = Number(op.flight_hours);

                // --- LÓGICA CRÍTICA DE TEMPO ---
                // O cálculo deve ser baseado EXCLUSIVAMENTE nas "Horas Voadas" se disponíveis.
                // Ignoramos o horário de término da ocorrência pois ele inclui tempo de solo/pausa.
                
                if (!isNaN(rawFlightHours) && rawFlightHours > 0) {
                    
                    // Converte horas decimais exatas (ex: 0.5 = 30min, 0.42 = 25min)
                    durationMinutes = Math.round(rawFlightHours * 60);
                    
                    // RECALCULA o horário de término para o registro de verão
                    // Ex: Início 09:00 + 25min voo = Término 09:25.
                    // Isso garante consistência visual (09:00 - 09:25 = 25min).
                    const endObj = new Date(dateObj.getTime() + durationMinutes * 60000);
                    endTimeStr = endObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    
                } else if (op.end_time) {
                    // Fallback: Se NÃO houve horas voadas informadas (ex: op cancelada ou sem voo),
                    // usamos a diferença de tempo, mas com cautela.
                    const endObj = new Date(op.end_time);
                    durationMinutes = Math.round((endObj.getTime() - dateObj.getTime()) / 60000);
                    if (durationMinutes < 0) durationMinutes = 0;
                    endTimeStr = endObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                }

                // Garante que não é negativo
                if (durationMinutes < 0) durationMinutes = 0;

                const payload = {
                    operation_id: op.id,
                    pilot_id: op.pilot_id,
                    drone_id: op.drone_id,
                    mission_type: op.mission_type,
                    location: loc,
                    date: dateStr, // Data informada pelo solicitante (baseada no inicio)
                    start_time: timeStr,
                    end_time: endTimeStr, // Calculado estritamente pelo tempo de voo ou fallback
                    flight_duration: durationMinutes,
                    notes: op.description || "Sincronizado automaticamente"
                };

                const existingRecord = existingMap.get(op.id);

                if (!existingRecord) {
                    // CRIAR NOVO REGISTRO
                    await operationSummerService.create({
                        ...payload,
                        evidence_photos: [],
                        evidence_videos: []
                    }, userId);
                    changesCount++;
                } else {
                    // ATUALIZAR SE HOUVER DIVERGÊNCIA
                    // Verifica se a duração no registro de verão está errada comparada ao cálculo real
                    // (ex: estava usando tempo total de pausa, agora corrige para tempo de voo)
                    if (existingRecord.flight_duration !== durationMinutes) {
                        console.log(`Corrigindo tempo voo ${op.id}: ${existingRecord.flight_duration}m -> ${durationMinutes}m`);
                        
                        await supabase
                            .from(TABLE)
                            .update({
                                flight_duration: durationMinutes,
                                end_time: endTimeStr, // Força atualização do horário final correto
                                pilot_id: op.pilot_id,
                                drone_id: op.drone_id,
                                notes: payload.notes
                            })
                            .eq('id', existingRecord.id);
                        
                        changesCount++;
                    }
                }
            } catch (err) {
                console.error(`Erro ao processar op ${op.id}:`, err);
            }
        }

        return changesCount;

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
      const { error } = await supabase.from(TABLE).delete().in('id', ids);
      if (error) throw error;
      try { await supabase.from(AUDIT_TABLE).insert({ user_id: userId, action: 'DELETE', details: `Exclusão de ${ids.length} registro(s).`, timestamp: new Date().toISOString() }); } catch (e) {}
    } catch (e: any) {
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
        const { data } = await supabase.from(AUDIT_TABLE).select('*').order('timestamp', { ascending: false });
        return data || [];
    } catch (e) { return getLocal(AUDIT_STORAGE_KEY); }
  }
};
