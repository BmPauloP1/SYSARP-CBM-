
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
    id: 'multi_point_operations_v1.0',
    title: 'Suporte a Operações Multi-Pontos',
    description: 'Adiciona a coluna necessária para armazenar múltiplas coordenadas, raios e altitudes em uma única missão. Essencial para o novo sistema de compartilhamento.',
    category: 'ops',
    sql: `
-- ADICIONA COLUNA DE MULTI-PONTOS (JSONB) NA TABELA DE OPERAÇÕES
ALTER TABLE public.operations 
ADD COLUMN IF NOT EXISTS takeoff_points jsonb DEFAULT '[]'::jsonb;

-- RECARREGA O SCHEMA PARA O POSTGREST RECONHECER A COLUNA
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'formal_incident_reporting_v1.0',
    title: 'Suporte a Boletim de Ocorrência Formal',
    description: 'Adiciona campos de texto longo para narrativa operacional e ações tomadas, essenciais para a validade jurídica dos relatórios.',
    category: 'ops',
    sql: `
-- 1. ADICIONA OU REFORÇA COLUNAS DE TEXTO LONGO NA TABELA DE OPERAÇÕES
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS actions_taken text;

-- 2. CRIA ÍNDICE DE BUSCA PARA PROTOCOLO E NOME (VELOCIDADE)
CREATE INDEX IF NOT EXISTS idx_operations_protocol ON public.operations(occurrence_number);
CREATE INDEX IF NOT EXISTS idx_operations_name ON public.operations(name);

-- 3. RECARREGA O SCHEMA
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'drone_documents_system_v1.0',
    title: 'Módulo de Pasta Digital de Aeronaves',
    description: 'Adiciona suporte ao armazenamento de URLs de documentos (Prefácio, Manuais, Checklists) na tabela de drones via campo JSONB.',
    category: 'ops',
    sql: `
ALTER TABLE public.drones ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '{}'::jsonb;
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
      console.warn("Could not fetch migrations table.");
    } finally {
      setLoading(false);
    }
  };

  const isApplied = (id: string) => migrations.some(m => m.id === id);

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    alert("Código SQL copiado!");
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
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{update.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{update.description}</p>
                </div>
                <Button onClick={() => handleCopySql(update.sql)} variant="outline" className="h-10">
                   <Copy className="w-4 h-4 mr-2" /> Copiar SQL
                </Button>
              </div>
              {!applied && (
                <div className="mt-6">
                  <div className="relative group">
                    <pre className="bg-slate-900 text-green-400 p-5 rounded-xl text-xs overflow-x-auto font-mono border border-slate-800 max-h-80 shadow-inner">
                      {update.sql}
                    </pre>
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
