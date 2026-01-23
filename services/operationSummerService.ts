
import { supabase, isConfigured } from './supabase';
import { SummerFlight, SummerStats, SummerAuditLog } from '../types_summer';
import { base44 } from './base44Client';

const TABLE = 'op_summer_flights';
const AUDIT_TABLE = 'op_summer_audit';
const STORAGE_KEY = 'sysarp_summer_flights';
const AUDIT_STORAGE_KEY = 'sysarp_summer_audit';

const getLocal = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLocal = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

const formatLocalDate = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

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
      const { data, error } = await supabase.from(TABLE).select('*, operation:operations(latitude, longitude)').order('date', { ascending: false });
      if (error) throw error;
      const flattenedData = (data || []).map((f: any) => {
        const { operation, ...rest } = f;
        if (operation) return { ...rest, latitude: operation.latitude, longitude: operation.longitude };
        return rest;
      });
      return flattenedData as SummerFlight[];
    } catch (e) { return getLocal(STORAGE_KEY); }
  },

  create: async (flight: Omit<SummerFlight, 'id' | 'created_at'>, userId: string): Promise<SummerFlight> => {
    if (flight.flight_duration === undefined || flight.flight_duration === null) {
      const today = new Date().toISOString().split('T')[0];
      const start = new Date(`${today}T${flight.start_time}`);
      const end = new Date(`${today}T${flight.end_time}`);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          flight.flight_duration = Math.round((end.getTime() - start.getTime()) / 60000);
          if (flight.flight_duration < 0) flight.flight_duration += 1440; 
      } else flight.flight_duration = 0;
    }
    const auditEntry = { user_id: userId, action: 'CREATE', details: `Voo registrado em ${flight.location} (${flight.mission_type})`, timestamp: new Date().toISOString() };
    if (!isConfigured) {
      const newItem = { ...flight, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      const items = getLocal(STORAGE_KEY); items.push(newItem); setLocal(STORAGE_KEY, items);
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
        if (idx !== -1) { items[idx] = { ...items[idx], ...cleanUpdates }; setLocal(STORAGE_KEY, items); }
        return;
    }
    try {
        const { error } = await supabase.from(TABLE).update(cleanUpdates).eq('id', id);
        if (error) throw error;
        await supabase.from(AUDIT_TABLE).insert({ user_id: userId, action: 'UPDATE', details: `Registro atualizado (Duração: ${cleanUpdates.flight_duration} min).`, timestamp: new Date().toISOString() });
    } catch (e: any) { throw new Error(e.message || "Falha na atualização do registro."); }
  },

  syncMissingFlights: async (userId: string): Promise<number> => {
    if (!isConfigured) return 0;
    try {
        const { data: allOps, error: opError } = await supabase.from('operations').select('*').eq('is_summer_op', true);
        if (opError) throw opError;
        if (!allOps || allOps.length === 0) return 0;
        const { data: existingSummer, error: sumError } = await supabase.from(TABLE).select('*'); 
        if (sumError) throw sumError;
        const existingMap = new Map();
        existingSummer?.forEach((s: any) => { if (s.operation_id) existingMap.set(s.operation_id, s); });
        let changesCount = 0;
        for (const op of allOps) {
            try {
                if (!op.start_time) continue;
                const dateStr = formatLocalDate(op.start_time);
                const timeStr = formatLocalTime(op.start_time);
                let loc = op.name.replace('VERÃO: ', '');
                if (!loc || loc.trim() === '') loc = "Operação Verão (Local N/D)";
                let durationMinutes = 0;
                let endTimeStr = '';
                const rawFlightHours = Number(op.flight_hours);
                if (!isNaN(rawFlightHours) && rawFlightHours > 0) {
                    durationMinutes = Math.round(rawFlightHours * 60);
                    const startDateObj = new Date(op.start_time);
                    const estimatedEnd = new Date(startDateObj.getTime() + durationMinutes * 60000);
                    endTimeStr = formatLocalTime(estimatedEnd.toISOString());
                } else if (op.end_time) {
                    const startObj = new Date(op.start_time);
                    const endObj = new Date(op.end_time);
                    if (!isNaN(endObj.getTime()) && !isNaN(startObj.getTime())) {
                        endTimeStr = formatLocalTime(op.end_time);
                        durationMinutes = Math.round((endObj.getTime() - startObj.getTime()) / 60000);
                        if (durationMinutes < 0) durationMinutes = 0;
                    } else endTimeStr = timeStr;
                } else { endTimeStr = timeStr; durationMinutes = 0; }
                const payload = { operation_id: op.id, pilot_id: op.pilot_id, drone_id: op.drone_id, mission_type: op.mission_type, location: loc, date: dateStr, start_time: timeStr, end_time: endTimeStr, flight_duration: durationMinutes, notes: op.description || "Sincronizado automaticamente" };
                const existingRecord = existingMap.get(op.id);
                if (!existingRecord) {
                    await operationSummerService.create({ ...payload, evidence_photos: [], evidence_videos: [] }, userId);
                    changesCount++;
                } else {
                    const isDataInvalid = existingRecord.date === 'Invalid Date' || !existingRecord.date;
                    const opHasHours = durationMinutes > 0;
                    const existingHasNoHours = !existingRecord.flight_duration || existingRecord.flight_duration === 0;
                    if (isDataInvalid || (opHasHours && existingHasNoHours)) {
                        await supabase.from(TABLE).update({ date: dateStr, start_time: timeStr, end_time: endTimeStr, flight_duration: durationMinutes, pilot_id: op.pilot_id, drone_id: op.drone_id, location: loc }).eq('id', existingRecord.id);
                        changesCount++;
                    }
                }
            } catch (err) { console.error(`Erro ao processar op ${op.id}:`, err); }
        }
        return changesCount;
    } catch (e) { throw e; }
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
    } catch (e: any) { throw new Error(e.message || "Erro desconhecido ao excluir registros."); }
  },

  getStats: async (): Promise<SummerStats> => {
    const flights = await operationSummerService.list();
    const stats: SummerStats = { total_flights: flights.length, total_hours: 0, flights_by_mission: {}, flights_by_drone: {}, top_locations: {} };
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
