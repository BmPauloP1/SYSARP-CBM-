import React, { useState, useEffect, useMemo } from 'react';
import { orgUnitService, OrgUnit } from '../services/orgUnitService';
import { Select, Input, Button } from './ui_components';
import { Plus, X, Check } from 'lucide-react';
import { ORGANIZATION_CHART } from '../types';

interface OrgUnitSelectorProps {
  crbm: string;
  unit: string;
  cia: string;
  onChange: (data: { crbm: string; unit: string; cia: string }) => void;
  labelClassName?: string;
}

export const OrgUnitSelector: React.FC<OrgUnitSelectorProps> = ({ crbm, unit, cia, onChange, labelClassName }) => {
  const [allUnits, setAllUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingCia, setIsAddingCia] = useState(false);
  const [newCia, setNewCia] = useState("");

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      await orgUnitService.seed();
      const data = await orgUnitService.list();
      setAllUnits(data);
    } catch (e) {
      console.error("Erro ao carregar unidades organizacionais", e);
    } finally {
      setLoading(false);
    }
  };

  const crbms = useMemo(() => {
    if (allUnits.length > 0) return allUnits.filter(u => u.type === 'crbm');
    // Fallback to ORGANIZATION_CHART
    return Object.keys(ORGANIZATION_CHART).map(name => ({ id: name, name, type: 'crbm' as const }));
  }, [allUnits]);
  
  const units = useMemo(() => {
    if (allUnits.length > 0) {
      const selectedCrbm = crbms.find(c => c.name === crbm);
      if (!selectedCrbm) return [];
      return allUnits.filter(u => u.type === 'unit' && u.parent_id === selectedCrbm.id);
    }
    // Fallback to ORGANIZATION_CHART
    const list = ORGANIZATION_CHART[crbm] || [];
    return list.map(name => ({ id: name, name, type: 'unit' as const }));
  }, [allUnits, crbm, crbms]);

  const cias = useMemo(() => {
    const selectedUnit = units.find(u => u.name === unit);
    if (!selectedUnit) return [];
    return allUnits.filter(u => u.type === 'cia' && u.parent_id === selectedUnit.id);
  }, [allUnits, unit, units]);

  const handleAddCia = async () => {
    if (!newCia.trim() || !unit) return;
    const parent = units.find(u => u.name === unit);
    if (!parent) return;
    try {
      const created = await orgUnitService.create({ type: 'cia', name: newCia.trim().toUpperCase(), parent_id: parent.id });
      setAllUnits(prev => [...prev.filter(u => !(u.type === 'cia' && u.name === created.name && u.parent_id === parent.id)), created]);
      onChange({ crbm, unit, cia: created.name });
      setIsAddingCia(false);
      setNewCia("");
    } catch (e) {
      alert("Erro ao adicionar CIA/PELOTÃO");
    }
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CRBM */}
        <div className="space-y-1">
          <label className={`text-sm font-bold uppercase tracking-wider ${labelClassName || 'text-slate-600'}`}>Comando Regional</label>
          <Select 
            value={crbm} 
            onChange={e => onChange({ crbm: e.target.value, unit: '', cia: '' })}
            className="w-full"
          >
            <option value="">Selecione...</option>
            {crbms.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </Select>
        </div>

        {/* Unidade */}
        <div className="space-y-1">
          <label className={`text-sm font-bold uppercase tracking-wider ${labelClassName || 'text-slate-600'}`}>Unidade (BBM/GBM)</label>
          <Select 
            value={unit} 
            onChange={e => onChange({ crbm, unit: e.target.value, cia: '' })}
            disabled={!crbm}
            className="w-full"
          >
            <option value="">Selecione...</option>
            {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </Select>
        </div>

        {/* CIA/PELOTÃO */}
        <div className="space-y-1">
          <label className={`text-sm font-bold uppercase tracking-wider ${labelClassName || 'text-slate-600'}`}>CIA / PELOTÃO</label>
          {!isAddingCia ? (
            <div className="flex gap-2">
              <Select 
                value={cia} 
                onChange={e => onChange({ crbm, unit, cia: e.target.value })}
                disabled={!unit}
                className="flex-1"
              >
                <option value="">Selecione...</option>
                {cias.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </Select>
              <Button type="button" variant="outline" className="px-2" onClick={() => setIsAddingCia(true)} disabled={!unit} title="Adicionar Novo">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input 
                value={newCia} 
                onChange={e => setNewCia(e.target.value)} 
                placeholder="Nova CIA..." 
                className="flex-1"
              />
              <Button type="button" className="bg-green-600 text-white px-2" onClick={handleAddCia}>
                <Check className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" className="px-2" onClick={() => setIsAddingCia(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
