
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

// Helper Date Formatting (Local YYYY-MM-DD)
// Corrige problema de timezone convertendo ISO para local corretamente
const formatLocalDate = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    // Ajuste para garantir a data local correta
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// Helper Time Formatting (Local HH:mm)
const formatLocalTime = (isoString: string): string => {
    if (!isoString) return '00:00';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '00:00';
    
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
};

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

  // FUNÇÃO REESCRITA PARA FORÇAR SINCRONIZAÇÃO CORRETA
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
                if (!op.start_time) continue; // Pula se não tiver data

                // Extração Segura de Data e Hora Local
                const dateStr = formatLocalDate(op.start_time);
                const timeStr = formatLocalTime(op.start_time);
                
                // Limpeza do Local
                let loc = op.name.replace('VERÃO: ', '');
                if (!loc || loc.trim() === '') loc = "Operação Verão (Local N/D)";

                // Lógica de Duração (Minutos) - PRIORIDADE ABSOLUTA: flight_hours
                let durationMinutes = 0;
                let endTimeStr = '';

                const rawFlightHours = Number(op.flight_hours);

                if (!isNaN(rawFlightHours) && rawFlightHours > 0) {
                    // Prioridade 1: O valor informado pelo piloto no encerramento
                    durationMinutes = Math.round(rawFlightHours * 60);
                    
                    // Recalcula o horário de término visual baseado no início + duração de voo
                    // Isso garante coerência visual no relatório
                    const startDateObj = new Date(op.start_time);
                    const estimatedEnd = new Date(startDateObj.getTime() + durationMinutes * 60000);
                    endTimeStr = formatLocalTime(estimatedEnd.toISOString());

                } else if (op.end_time) {
                    // Prioridade 2: Diferença Start/End se flight_hours não existir
                    const startObj = new Date(op.start_time);
                    const endObj = new Date(op.end_time);
                    if (!isNaN(endObj.getTime()) && !isNaN(startObj.getTime())) {
                        endTimeStr = formatLocalTime(op.end_time);
                        durationMinutes = Math.round((endObj.getTime() - startObj.getTime()) / 60000);
                        if (durationMinutes < 0) durationMinutes = 0;
                    } else {
                        endTimeStr = timeStr;
                    }
                } else {
                    // Sem flight_hours e sem end_time
                    endTimeStr = timeStr;
                    durationMinutes = 0;
                }

                // Payload Padrão
                const payload = {
                    operation_id: op.id,
                    pilot_id: op.pilot_id,
                    drone_id: op.drone_id,
                    mission_type: op.mission_type,
                    location: loc,
                    date: dateStr,
                    start_time: timeStr,
                    end_time: endTimeStr,
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
                    // ATUALIZAR SE NECESSÁRIO
                    // Critérios de atualização:
                    // 1. Data inválida no registro existente
                    // 2. Duração zerada no registro existente, mas operação tem horas
                    // 3. Diferença significativa na duração (ex: piloto editou a operação original)
                    
                    const isDataInvalid = existingRecord.date === 'Invalid Date' || !existingRecord.date;
                    const isTimeInvalid = existingRecord.start_time === 'Invalid Date' || !existingRecord.start_time;
                    
                    const opHasHours = durationMinutes > 0;
                    const existingHasNoHours = !existingRecord.flight_duration || existingRecord.flight_duration === 0;
                    const durationMismatch = Math.abs((existingRecord.flight_duration || 0) - durationMinutes) > 2; // tolerância 2 min

                    if (isDataInvalid || isTimeInvalid || (opHasHours && (existingHasNoHours || durationMismatch))) {
                        console.log(`Corrigindo registro de verão ${existingRecord.id} da op ${op.id}. Duração antiga: ${existingRecord.flight_duration}, Nova: ${durationMinutes}`);
                        
                        await supabase
                            .from(TABLE)
                            .update({
                                date: dateStr,
                                start_time: timeStr,
                                end_time: endTimeStr,
                                flight_duration: durationMinutes,
                                pilot_id: op.pilot_id,
                                drone_id: op.drone_id,
                                location: loc
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
