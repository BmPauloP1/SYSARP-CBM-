import { supabase } from './supabase';
import { ORGANIZATION_CHART } from '../types';

export interface OrgUnit {
  id: string;
  type: 'crbm' | 'unit' | 'cia';
  name: string;
  parent_id?: string;
}

export const orgUnitService = {
  async list(): Promise<OrgUnit[]> {
    try {
      const { data, error } = await supabase
        .from('organizational_units')
        .select('*')
        .order('name');
      
      if (error) {
        console.warn("Table organizational_units might not exist yet:", error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error("Error listing org units:", e);
      return [];
    }
  },

  async seed(): Promise<void> {
    try {
      const existing = await this.list();
      if (existing.length > 0) return;

      for (const [crbmName, units] of Object.entries(ORGANIZATION_CHART)) {
        const crbm = await this.create({ type: 'crbm', name: crbmName });
        for (const unitName of units) {
          await this.create({ type: 'unit', name: unitName, parent_id: crbm.id });
        }
      }
    } catch (e) {
      console.warn("Failed to seed organizational units. This is expected if the table doesn't exist yet.", e);
    }
  },

  async create(unit: Omit<OrgUnit, 'id'>): Promise<OrgUnit> {
    try {
      // If parent_id is provided but it's not a UUID (it's a name from fallback), 
      // we need to find or create the parent first
      if (unit.parent_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unit.parent_id)) {
        const parentName = unit.parent_id;
        const parentType = unit.type === 'unit' ? 'crbm' : 'unit';
        const parent = await this.create({ type: parentType, name: parentName });
        unit.parent_id = parent.id;
      }

      // Check for duplicates
      const { data: existing } = await supabase
        .from('organizational_units')
        .select('*')
        .eq('type', unit.type)
        .eq('name', unit.name)
        .eq('parent_id', unit.parent_id || null)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('organizational_units')
        .insert(unit)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Error creating org unit:", e);
      throw e;
    }
  }
};
