
import React, { useState } from 'react';
import { Modal, Button } from './ui_components';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DRONE_CHECKLIST_TEMPLATE } from '../types';

interface PreFlightChecklistProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (checklistData: any) => void;
  droneName: string;
}

export const PreFlightChecklist: React.FC<PreFlightChecklistProps> = ({ isOpen, onClose, onComplete, droneName }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleItem = (item: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const allCategories = Object.keys(DRONE_CHECKLIST_TEMPLATE);
  const totalItems = Object.values(DRONE_CHECKLIST_TEMPLATE).flat().length;
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const isComplete = checkedCount === totalItems;

  const handleComplete = () => {
    if (isComplete) {
      onComplete(checkedItems);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Checklist Pré-Voo: ${droneName}`}>
      <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
        <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-blue-900 uppercase">Segurança em Primeiro Lugar</h4>
            <p className="text-xs text-blue-700 mt-1">Verifique todos os itens abaixo antes de iniciar a operação. A segurança da equipe e do equipamento depende da sua atenção.</p>
          </div>
        </div>

        <div className="space-y-8">
          {Object.entries(DRONE_CHECKLIST_TEMPLATE).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {category}
              </h5>
              <div className="grid gap-2">
                {items.map((item) => (
                  <label 
                    key={item} 
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      checkedItems[item] 
                        ? 'bg-green-50 border-green-200 text-green-900' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      checked={!!checkedItems[item]}
                      onChange={() => toggleItem(item)}
                    />
                    <span className="text-xs font-medium leading-tight">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
        <div className="flex justify-between items-center px-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Progresso</span>
          <span className={`text-xs font-black ${isComplete ? 'text-green-600' : 'text-slate-600'}`}>
            {checkedCount} / {totalItems} ({Math.round((checkedCount / totalItems) * 100)}%)
          </span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${(checkedCount / totalItems) * 100}%` }}
          ></div>
        </div>
        
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button 
            variant="primary" 
            onClick={handleComplete} 
            disabled={!isComplete}
            className="flex-1"
          >
            {isComplete ? (
              <><CheckCircle2 className="w-4 h-4" /> Autorizar Voo</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Pendências</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
