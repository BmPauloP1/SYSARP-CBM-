import React from 'react';
import { Modal, Button } from './ui_components';

const SQL_CODE = `
CREATE TABLE operation_pendencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  reopened_by_id UUID REFERENCES profiles(id),
  assigned_to_id UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' or 'resolved'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

ALTER TABLE operation_pendencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to admins" 
ON operation_pendencies FOR ALL 
TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Allow assigned user to view" 
ON operation_pendencies FOR SELECT 
TO authenticated 
USING ( assigned_to_id = auth.uid() );
`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  error: string;
}

export const SchemaErrorModal: React.FC<Props> = ({ isOpen, onClose, error }) => {
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_CODE);
    alert('Código SQL copiado para a área de transferência!');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Erro de Configuração do Banco de Dados">
      <div className="p-6 space-y-4">
        <p className="text-sm text-red-700"><b>Erro:</b> {error}</p>
        <p className="text-sm text-slate-600">
          Parece que a tabela <code>operation_pendencies</code> não existe em seu banco de dados. Para corrigir isso, execute o seguinte script SQL no seu editor de SQL do Supabase.
        </p>
        <pre className="bg-slate-100 p-3 rounded-lg text-xs overflow-x-auto"><code>{SQL_CODE}</code></pre>
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
        <Button onClick={handleCopy} variant="secondary">Copiar SQL</Button>
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  );
};
