import { supabase, isConfigured } from './supabase';
import { TermoCautela, CautelaStatus } from '../types_cautela';
import { inventoryService } from './inventoryService';

const TABLE = 'termos_cautela';
const ITENS_TABLE = 'termo_cautela_itens';

export const cautelaService = {
  list: async (): Promise<TermoCautela[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        drone:drones(*),
        pilot:profiles(*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string): Promise<TermoCautela> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        *,
        drone:drones(*),
        pilot:profiles(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;

    // Buscar itens do snapshot
    const { data: itensData } = await supabase
      .from(ITENS_TABLE)
      .select('materials(*)')
      .eq('termo_cautela_id', id);

    return {
      ...data,
      itens: (itensData || []).map((i: any) => i.materials)
    };
  },

  create: async (payload: Partial<TermoCautela>): Promise<void> => {
    // 1. Criar Termo
    const { data, error } = await supabase
      .from(TABLE)
      .insert([{
        drone_id: payload.drone_id,
        pilot_id: payload.pilot_id,
        unidade_nome: payload.unidade_nome,
        patrimonio: payload.patrimonio,
        data_inicio: payload.data_inicio,
        tempo_dias: payload.tempo_dias,
        tempo_indeterminado: payload.tempo_indeterminado,
        status: 'GERADA'
      }])
      .select()
      .single();

    if (error) throw error;

    // 2. Snapshot automática de itens do almoxarifado vinculados ao drone
    const droneMaterials = await inventoryService.getMaterialsByDrone(payload.drone_id!);
    if (droneMaterials.length > 0) {
      const inserts = droneMaterials.map(m => ({
        termo_cautela_id: data.id,
        item_almoxarifado_id: m.id
      }));
      await supabase.from(ITENS_TABLE).insert(inserts);
    }
  },

  sign: async (id: string, pilotName: string): Promise<void> => {
    const { error } = await supabase
      .from(TABLE)
      .update({
        assinatura_eletronica: pilotName,
        data_hora_assinatura: new Date().toISOString(),
        status: 'ASSINADA'
      })
      .eq('id', id)
      .eq('status', 'GERADA');
    
    if (error) throw error;
  },

  close: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from(TABLE)
      .update({ status: 'ENCERRADA' })
      .eq('id', id);
    
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};