import { supabase, isConfigured } from './supabase';
import { Material, MaterialType, MaterialLog, BatteryStats, PropellerStats, HealthStatus } from '../types_inventory';

const STORAGE_MAT_KEY = 'sysarp_materials';
const STORAGE_LOG_KEY = 'sysarp_material_logs';

// Fix: Made getLocal generic to return typed arrays instead of any[], improving type safety.
const getLocal = <T,>(key: string): T[] => JSON.parse(localStorage.getItem(key) || '[]');
const setLocal = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

export const inventoryService = {
  
  // --- LEITURA ---
  getAllMaterials: async (): Promise<Material[]> => {
    if (!isConfigured) {
      // Fix: Use generic type argument for getLocal to ensure a typed return value.
      return getLocal<Material>(STORAGE_MAT_KEY);
    }
    try {
      const { data, error } = await supabase
        .from('materials')
        .select(`
          *,
          battery_stats (*),
          propeller_stats (*)
        `);
      if (error) throw error;
      // Fix: Handle cases where `data` is null (e.g., no records found) to prevent runtime errors on `.map`.
      return (data || []).map((m: any) => ({
        ...m,
        battery_stats: m.battery_stats?.[0] || undefined,
        propeller_stats: m.propeller_stats?.[0] || undefined
      })) as Material[];
    } catch (e) {
      console.warn("Full inventory fetch error, using local:", e);
      return getLocal<Material>(STORAGE_MAT_KEY);
    }
  },
  
  getMaterialsByDrone: async (droneId: string): Promise<Material[]> => {
    if (!isConfigured) {
      const all = getLocal<Material>(STORAGE_MAT_KEY);
      return all.filter((m: Material) => m.drone_id === droneId);
    }

    try {
      const { data, error } = await supabase
        .from('materials')
        .select(`
          *,
          battery_stats (*),
          propeller_stats (*)
        `)
        .eq('drone_id', droneId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fix: Handle cases where `data` is null to prevent runtime errors and correctly flatten join results.
      return (data || []).map((m: any) => ({
        ...m,
        battery_stats: m.battery_stats?.[0] || undefined,
        propeller_stats: m.propeller_stats?.[0] || undefined
      })) as Material[];
    } catch (e) {
      console.warn("Inventory fetch error, using local:", e);
      const all = getLocal<Material>(STORAGE_MAT_KEY);
      return all.filter((m: Material) => m.drone_id === droneId);
    }
  },

  getLogs: async (materialId: string): Promise<MaterialLog[]> => {
    if (!isConfigured) return [];
    const { data } = await supabase.from('material_logs').select('*').eq('material_id', materialId).order('created_at', { ascending: false });
    return data || [];
  },

  // --- ESCRITA ---

  addMaterial: async (material: Partial<Material>, stats: Partial<BatteryStats | PropellerStats>): Promise<void> => {
    const newItem = {
      ...material,
      quantity: material.quantity || 1, // Default quantity
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    if (!isConfigured) {
      const current = getLocal<Material>(STORAGE_MAT_KEY);
      current.push({ 
        ...newItem, 
        battery_stats: material.type === 'battery' ? { ...stats, material_id: newItem.id } : undefined,
        propeller_stats: material.type === 'propeller' ? { ...stats, material_id: newItem.id } : undefined
      } as Material);
      setLocal(STORAGE_MAT_KEY, current);
      return;
    }

    // 1. Cria Material Base
    const { data: matData, error: matError } = await supabase.from('materials').insert([newItem]).select().single();
    if (matError) throw matError;

    const matId = matData.id;

    // 2. Cria Stats Específicos
    if (material.type === 'battery') {
      await supabase.from('battery_stats').insert([{ ...stats, material_id: matId }]);
    } else if (material.type === 'propeller') {
      await supabase.from('propeller_stats').insert([{ ...stats, material_id: matId }]);
    }

    // 3. Log Inicial
    await inventoryService.logAction(matId, 'create', `Item cadastrado (Qtd: ${newItem.quantity})`);
  },

  updateMaterial: async (id: string, materialUpdates: Partial<Material>, statsUpdates?: any): Promise<void> => {
    if (!isConfigured) {
       // Simple local update logic for offline demo
       const current = getLocal<Material>(STORAGE_MAT_KEY);
       const index = current.findIndex((m: any) => m.id === id);
       if (index !== -1) {
         current[index] = { ...current[index], ...materialUpdates };
         if (statsUpdates && current[index].battery_stats) current[index].battery_stats = { ...current[index].battery_stats, ...statsUpdates };
         setLocal(STORAGE_MAT_KEY, current);
       }
       return;
    }

    await supabase.from('materials').update(materialUpdates).eq('id', id);

    if (statsUpdates) {
      if (materialUpdates.type === 'battery') {
        await supabase.from('battery_stats').update(statsUpdates).eq('material_id', id);
      } else if (materialUpdates.type === 'propeller') {
        await supabase.from('propeller_stats').update(statsUpdates).eq('material_id', id);
      }
    }
  },

  deleteMaterial: async (id: string): Promise<void> => {
    if (!isConfigured) {
      const current = getLocal<Material>(STORAGE_MAT_KEY);
      setLocal(STORAGE_MAT_KEY, current.filter((m: any) => m.id !== id));
      return;
    }
    await supabase.from('materials').delete().eq('id', id);
  },

  // --- LÓGICA DE USO E DESGASTE ---

  registerUsage: async (materialId: string, type: MaterialType, amount: number, details: string) => {
    if (!isConfigured) return;

    if (type === 'battery') {
      const { data: stats } = await supabase.from('battery_stats').select('cycles, max_cycles').eq('material_id', materialId).single();
      if (stats) {
        const newCycles = (stats.cycles || 0) + amount;
        const degradation = (newCycles / stats.max_cycles) * 100;
        const newHealth = Math.max(0, 100 - degradation);

        await supabase.from('battery_stats').update({ 
          cycles: newCycles, 
          health_percent: Math.round(newHealth) 
        }).eq('material_id', materialId);
      }
    } 
    else if (type === 'propeller') {
      const { data: stats } = await supabase.from('propeller_stats').select('hours_flown').eq('material_id', materialId).single();
      if (stats) {
        const newHours = (stats.hours_flown || 0) + amount;
        await supabase.from('propeller_stats').update({ hours_flown: newHours }).eq('material_id', materialId);
      }
    }

    await inventoryService.logAction(materialId, 'usage', details, amount);
  },

  adjustQuantity: async (material: Material, delta: number) => {
    const newQty = Math.max(0, (material.quantity || 0) + delta);
    await inventoryService.updateMaterial(material.id, { quantity: newQty });
    await inventoryService.logAction(material.id, 'adjustment', `Ajuste de estoque: ${delta > 0 ? '+' : ''}${delta}`, delta);
  },

  logAction: async (materialId: string, action: string, details: string, delta?: number) => {
    if (!isConfigured) return;
    await supabase.from('material_logs').insert([{
      material_id: materialId,
      action,
      details,
      delta_value: delta
    }]);
  },

  // --- ALERTAS ---

  calculateHealthStatus: (material: Material): { status: HealthStatus, message: string } => {
    if (material.status === 'retired') return { status: 'OK', message: 'Baixado' };
    if (material.status === 'maintenance') return { status: 'WARNING', message: 'Em Manutenção' };
    
    // Alerta de estoque baixo para consumíveis
    if (['component', 'accessory', 'propeller'].includes(material.type) && material.quantity <= 1) {
       return { status: 'WARNING', message: 'Estoque Baixo' };
    }

    if (material.type === 'battery' && material.battery_stats) {
      const { cycles, max_cycles, health_percent } = material.battery_stats;
      
      if (cycles >= max_cycles) return { status: 'CRITICAL', message: 'Vida útil excedida' };
      if (health_percent < 60) return { status: 'CRITICAL', message: 'Saúde crítica (<60%)' };
      
      if (cycles >= max_cycles * 0.9) return { status: 'WARNING', message: 'Fim da vida útil' };
      if (health_percent < 80) return { status: 'WARNING', message: 'Degradação (>20%)' };
      
      return { status: 'OK', message: 'Saudável' };
    }

    if (material.type === 'propeller' && material.propeller_stats) {
      const { hours_flown, max_hours } = material.propeller_stats;
      
      if (hours_flown >= max_hours) return { status: 'CRITICAL', message: 'Horas excedidas' };
      if (hours_flown >= max_hours * 0.9) return { status: 'WARNING', message: '90% Vida Útil' };
      
      return { status: 'OK', message: 'Operacional' };
    }

    return { status: 'OK', message: 'Disponível' };
  }
};