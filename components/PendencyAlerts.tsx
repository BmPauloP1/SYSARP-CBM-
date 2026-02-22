import React, { useState, useEffect } from 'react';
import { base44 } from '../services/base44Client';
import { pendencyService } from '../services/pendencyService';
import { Operation, OperationPendency, Pilot } from '../types';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SchemaErrorModal } from './SchemaErrorModal';

interface Props {
  currentUser: Pilot | null;
}

export const PendencyAlerts: React.FC<Props> = ({ currentUser }) => {
  const [pendencies, setPendencies] = useState<OperationPendency[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const navigate = useNavigate();
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      pendencyService.listMyPendencies(currentUser.id)
        .then(setPendencies)
        .catch(error => {
          if (error.message.includes('relation "public.operation_pendencies" does not exist')) {
            setSchemaError(error.message);
          } else {
            console.error("Erro ao buscar pendências:", error);
          }
        });
      base44.entities.Operation.list().then(setOperations);
    }
  }, [currentUser]);

  if (schemaError) {
    return <SchemaErrorModal isOpen={true} onClose={() => setSchemaError(null)} error={schemaError} />;
  }

  if (!pendencies || pendencies.length === 0) {
    return null;
  }

  const handleNavigate = (opId: string) => {
    navigate(`/operations/${opId}/gerenciar`);
  };

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 my-4 mx-4 shadow-md">
      <div className="flex items-center">
        <AlertTriangle className="w-6 h-6 text-amber-600 mr-3" />
        <div>
          <h3 className="text-sm font-black text-amber-800 uppercase">Pendências de Ocorrência</h3>
          <p className="text-xs text-amber-700">Você tem {pendencies.length} ocorrência(s) que necessita(m) de sua atenção e correção.</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {pendencies.map(p => {
          const operation = operations.find(o => o.id === p.operation_id);
          return (
            <li 
              key={p.id} 
              onClick={() => handleNavigate(p.operation_id)}
              className="bg-white p-3 rounded-lg shadow-sm border border-amber-200 hover:bg-amber-50 cursor-pointer transition-colors flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-xs text-slate-800">{operation?.name || 'Ocorrência não encontrada'}</p>
                <p className="text-[10px] text-slate-500 italic mt-1">Motivo: {p.reason}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </li>
          );
        })}
      </ul>
    </div>
  );
};
