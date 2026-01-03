
import React, { useState, useEffect } from 'react';
import { base44 } from '../services/base44Client';
import { Card, Button, Badge } from '../components/ui_components';
import { Database, CheckCircle, AlertCircle, Play, History, Search, Filter, Copy, Terminal, ShieldAlert } from 'lucide-react';

interface SchemaMigration {
  id: string;
  applied_at: string;
}

const ALL_UPDATES = [
  {
    id: 'drone_documents_system_v1.0',
    title: 'Módulo de Pasta Digital de Aeronaves',
    description: 'Adiciona suporte ao armazenamento de URLs de documentos (Prefácio, Manuais, Checklists) na tabela de drones via campo JSONB.',
    category: 'ops',
    sql: `
-- 1. ADICIONA COLUNA DE DOCUMENTOS NA TABELA DRONES
ALTER TABLE public.drones ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '{}'::jsonb;

-- 2. GARANTE PERMISSÕES DE ESCRITA PARA PILOTOS AUTENTICADOS (NECESSÁRIO PARA UPLOAD)
-- Se já houver uma política de UPDATE, garanta que ela cubra esta coluna.
-- Exemplo de correção de RLS (se necessário):
-- DROP POLICY IF EXISTS "Permitir atualização de drones" ON public.drones;
-- CREATE POLICY "Permitir atualização de drones" ON public.drones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. RECARREGA O SCHEMA
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'operation_cancellation_v1.0',
    title: 'Suporte a Cancelamento de Ocorrências',
    description: 'Atualiza a tabela de operações para permitir o status "cancelled" e garantir que o campo de horas aceite valores zerados para estas ocorrências.',
    category: 'ops',
    sql: `
-- 1. ATUALIZA A RESTRIÇÃO DE STATUS NA TABELA OPERATIONS
ALTER TABLE public.operations DROP CONSTRAINT IF EXISTS operations_status_check;
ALTER TABLE public.operations ADD CONSTRAINT operations_status_check CHECK (status IN ('active', 'completed', 'cancelled'));

-- 2. GARANTE QUE AS COLUNAS DE TEMPO SUPORTEM FLOATS (CASO AINDA NÃO SUPORTEM)
ALTER TABLE public.operations ALTER COLUMN total_pause_duration TYPE float USING total_pause_duration::float;
ALTER TABLE public.operations ALTER COLUMN flight_hours TYPE float USING flight_hours::float;

-- 3. RECARREGA SCHEMA
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'pilot_validation_system_v1.0',
    title: 'Sistema de Validação de Pilotos',
    description: 'Atualiza a tabela de perfis para suportar o status "pending" (pendente) e define este como o padrão para novos registros via página de login.',
    category: 'auth',
    sql: `
-- 1. ATUALIZA A RESTRIÇÃO DE STATUS NA TABELA PROFILES
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive', 'pending'));

-- 2. DEFINE 'PENDING' COMO VALOR PADRÃO PARA NOVOS REGISTROS
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

-- 3. GARANTE QUE O CAMPO STATUS EXISTA (CASO NÃO EXISTA)
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
EXCEPTION WHEN others THEN NULL; END $$;

-- 4. ATUALIZA O CACHE DO SISTEMA
NOTIFY pgrst, 'reload schema';
`
  }
];

export default function DatabaseUpdates() {
  const [migrations, setMigrations] = useState<SchemaMigration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMigrations();
  }, []);

  const loadMigrations = async () => {
    try {
      const data = await base44.entities.SchemaMigration.list();
      setMigrations(data as any);
    } catch (e) {
      console.warn("Could not fetch migrations table, it might not exist yet.");
    } finally {
      setLoading(false);
    }
  };

  const isApplied = (id: string) => migrations.some(m => m.id === id);

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    alert("Código SQL copiado para a área de transferência!");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 h-full overflow-y-auto pb-20">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="p-3 bg-slate-800 rounded-xl text-white shadow-lg">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Atualizações de Estrutura</h1>
          <p className="text-sm text-slate-500">Mantenha o banco de dados sincronizado com as novas funcionalidades.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {ALL_UPDATES.map(update => {
          const applied = isApplied(update.id);
          return (
            <Card key={update.id} className={`p-6 border-l-4 transition-all ${applied ? 'border-l-green-500' : 'border-l-amber-500 shadow-md ring-1 ring-amber-100'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={applied ? 'success' : 'warning'} className="uppercase font-bold tracking-wider">
                      {applied ? 'Aplicado' : 'Pendente'}
                    </Badge>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">ID: {update.id}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{update.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{update.description}</p>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                   <Button onClick={() => handleCopySql(update.sql)} variant="outline" className="flex-1 md:flex-none h-10">
                      <Copy className="w-4 h-4 mr-2" /> Copiar SQL
                   </Button>
                </div>
              </div>
              
              {!applied && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase">
                    <Terminal className="w-3 h-3" /> Script de Instalação
                  </div>
                  <div className="relative group">
                    <pre className="bg-slate-900 text-green-400 p-5 rounded-xl text-xs overflow-x-auto font-mono border border-slate-800 max-h-80 shadow-inner">
                      {update.sql}
                    </pre>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button size="sm" onClick={() => handleCopySql(update.sql)} className="bg-white/10 text-white hover:bg-white/20 border-white/10">
                         <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                       </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
