
export type MaterialType = 'battery' | 'propeller' | 'component' | 'payload' | 'accessory' | 'controller';
export type MaterialStatus = 'new' | 'active' | 'maintenance' | 'retired';
export type HealthStatus = 'OK' | 'WARNING' | 'CRITICAL';

export interface BatteryStats {
  material_id: string;
  cycles: number;
  max_cycles: number;
  capacity_mah?: number;
  voltage_v?: number;
  health_percent: number;
}

export interface PropellerStats {
  material_id: string;
  hours_flown: number;
  max_hours: number;
  size_inch?: string;
  pitch?: string;
  position?: string;
}

export interface Material {
  id: string;
  drone_id: string;
  type: MaterialType;
  name: string;
  quantity: number; // Novo campo para controle de estoque
  serial_number?: string;
  status: MaterialStatus;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  
  // Joins opcionais
  battery_stats?: BatteryStats;
  propeller_stats?: PropellerStats;
}

export interface MaterialLog {
  id: string;
  material_id: string;
  action: string;
  details: string;
  delta_value?: number;
  created_at: string;
}
