-- Cria a tabela para armazenar as pendências de operação
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

-- Ativa a Segurança em Nível de Linha (RLS) para a nova tabela
ALTER TABLE operation_pendencies ENABLE ROW LEVEL SECURITY;

-- Política de Acesso: Permite acesso total para administradores
CREATE POLICY "Allow all access to admins" 
ON operation_pendencies FOR ALL 
TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Política de Acesso: Permite que o usuário designado visualize suas próprias pendências
CREATE POLICY "Allow assigned user to view" 
ON operation_pendencies FOR SELECT 
TO authenticated 
USING ( assigned_to_id = auth.uid() );
