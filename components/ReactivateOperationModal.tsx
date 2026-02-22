import React, { useState, useEffect } from 'react';
import { Modal, Button, Textarea, Select } from './ui_components';
import { SchemaErrorModal } from './SchemaErrorModal';
import { base44 } from '../services/base44Client';
import { pendencyService } from '../services/pendencyService';
import { Pilot, Operation } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  operation: Operation | null;
  currentUser: Pilot | null;
  onSuccess: () => void;
}

export const ReactivateOperationModal: React.FC<Props> = ({ isOpen, onClose, operation, currentUser, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      base44.entities.Pilot.list().then(setPilots);
      // Default to the original pilot if available
      if (operation?.pilot_id) {
        setAssignedToId(operation.pilot_id);
      }
    }
  }, [isOpen, operation]);

  const handleSubmit = async () => {
    if (!operation || !currentUser || !reason || !assignedToId) {
      alert('Por favor, preencha todos os campos.');
      return;
    }
    setIsSubmitting(true);
    try {
      await pendencyService.createPendency(operation.id, currentUser.id, assignedToId, reason);
      alert('Operação reativada e pendência criada com sucesso!');
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.message.includes('relation "public.operation_pendencies" does not exist')) {
        setSchemaError(error.message);
      } else {
        console.error('Erro ao reativar operação:', error);
        alert('Falha ao reativar a operação. Verifique o console para mais detalhes.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <SchemaErrorModal 
        isOpen={!!schemaError}
        onClose={() => setSchemaError(null)}
        error={schemaError || ''}
      />
      <Modal isOpen={isOpen} onClose={onClose} title="Reativar Ocorrência e Lançar Pendência">
      <div className="p-6 space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-700">Ocorrência:</p>
          <p className="text-sm text-slate-600">{operation?.name}</p>
        </div>
        <Textarea
          label="Motivo da Reativação"
          placeholder="Descreva detalhadamente o motivo para reabrir esta ocorrência. Esta informação será enviada ao piloto responsável pela correção."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          required
        />
        <Select
          label="Atribuir Correção Para"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          required
        >
          <option value="">Selecione um piloto...</option>
          {pilots.map(p => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </Select>
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
        <Button onClick={onClose} variant="secondary">Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Confirmar e Notificar Piloto'}
        </Button>
      </div>
      </Modal>
    </>
  );
};
