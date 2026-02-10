
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
    id: 'critical_pause_system_v1.0',
    title: 'Correção Crítica: Sistema de Pausa e Notas',
    description: 'Adiciona as colunas "is_paused" e "notes" na tabela de operações. Sem esta atualização, o botão de pausar missão e o encerramento de logs falharão.',
    category: 'critical',
    sql: `
-- ADICIONA COLUNAS PARA O SISTEMA DE PAUSA E HISTÓRICO DE NOTAS
ALTER TABLE public.operations 
ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- RECARREGA O SCHEMA
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'multi_point_operations_v1.0',
    title: 'Suporte a Operações Multi-Pontos',
    description: 'Adiciona a coluna necessária para armazenar múltiplas coordenadas, raios e altitudes em uma única missão.',
    category: 'ops',
    sql: `
ALTER TABLE public.operations 
ADD COLUMN IF NOT EXISTS takeoff_points jsonb DEFAULT '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'drone_documents_system_v1.0',
    title: 'Módulo de Pasta Digital de Aeronaves',
    description: 'Adiciona suporte ao armazenamento de documentos na tabela de drones via campo JSONB.',
    category: 'ops',
    sql: `
ALTER TABLE public.drones ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '{}'::jsonb;
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'formal_incident_reporting_v1.0',
    title: 'Suporte a Boletim de Ocorrência Formal',
    description: 'Adiciona campos de texto longo para narrativa operacional e ações tomadas.',
    category: 'ops',
    sql: `
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS actions_taken text;
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
    alert("Código SQL copiado! Cole-o no Editor SQL do seu Supabase.");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 h-full overflow-y-auto pb-20 bg-slate-50">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="p-3 bg-red-700 rounded-xl text-white shadow-lg">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estrutura do Banco de Dados</h1>
          <p className="text-sm text-slate-500">Sincronize seu banco de dados com as últimas correções do sistema.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {ALL_UPDATES.map(update => {
          const applied = isApplied(update.id);
          return (
            <Card key={update.id} className={`p-6 border-l-4 transition-all ${applied ? 'border-l-green-500' : 'border-l-red-600 shadow-md ring-1 ring-red-50'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={applied ? 'success' : 'danger'} className="uppercase font-black tracking-wider text-[10px]">
                      {applied ? 'Aplicado' : 'Ação Necessária'}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{update.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{update.description}</p>
                </div>
                <Button onClick={() => handleCopySql(update.sql)} variant="outline" className="h-10 border-slate-300 font-bold uppercase text-[10px]">
                   <Copy className="w-4 h-4 mr-2" /> Copiar SQL
                </Button>
              </div>
              <div className="mt-6">
                <div className="relative group">
                  <pre className="bg-slate-900 text-green-400 p-5 rounded-xl text-xs overflow-x-auto font-mono border border-slate-800 max-h-80 shadow-inner">
                    {update.sql}
                  </pre>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
