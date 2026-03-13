
import React, { useState, useEffect } from 'react';
import { base44 } from '../services/base44Client';
import { supabase } from '../services/supabase';
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
  },
  {
    id: 'org_units_and_battery_pairing_v1.0',
    title: 'Estrutura Organizacional e Pareamento de Baterias',
    description: 'Cria a tabela de unidades organizacionais (CRBM, Unidade, CIA) e adiciona suporte ao pareamento de baterias.',
    category: 'critical',
    sql: `
-- 1. Tabela para Unidades Organizacionais (CRBM, Unidade, CIA/PELOTÃO)
CREATE TABLE IF NOT EXISTS organizational_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'crbm', 'unit', 'cia'
    name TEXT NOT NULL,
    parent_id UUID REFERENCES organizational_units(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(type, name, parent_id)
);

-- 2. Adicionar cia_pelotao às tabelas existentes
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cia_pelotao') THEN
        ALTER TABLE public.profiles ADD COLUMN cia_pelotao TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drones' AND column_name = 'cia_pelotao') THEN
        ALTER TABLE public.drones ADD COLUMN cia_pelotao TEXT;
    END IF;
END $$;

-- 3. Adicionar pair_name para facilitar a identificação (PAR 1, PAR 2, etc)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'pair_name') THEN
        ALTER TABLE materials ADD COLUMN pair_name TEXT;
    END IF;
END $$;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_org_units_type ON organizational_units(type);
CREATE INDEX IF NOT EXISTS idx_profiles_cia_pelotao ON profiles(cia_pelotao);
CREATE INDEX IF NOT EXISTS idx_drones_cia_pelotao ON drones(cia_pelotao);

-- 5. RLS para organizational_units
ALTER TABLE organizational_units ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read for all' AND tablename = 'organizational_units') THEN
        CREATE POLICY "Allow read for all" ON organizational_units FOR SELECT TO public USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert for all' AND tablename = 'organizational_units') THEN
        CREATE POLICY "Allow insert for all" ON organizational_units FOR INSERT TO public WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow update for all' AND tablename = 'organizational_units') THEN
        CREATE POLICY "Allow update for all" ON organizational_units FOR UPDATE TO public USING (true);
    END IF;
END $$;

-- 6. CORREÇÃO RLS PROFILES (PILOTOS)
-- Esta correção permite que o sistema liste os pilotos mesmo antes do login completo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas que podem conflitar (opcional, mas seguro para este fix)
DROP POLICY IF EXISTS "Permitir leitura pública de perfis" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;

-- Cria uma política específica para leitura (SELECT) permitindo tanto anon quanto authenticated
CREATE POLICY "profiles_select_public" ON public.profiles
FOR SELECT TO anon, authenticated
USING (true);

-- Garante as permissões de acesso ao schema
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
`
  }
];

export default function DatabaseUpdates() {
  const [migrations, setMigrations] = useState<SchemaMigration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ check: string, status: string }[]>([]);

  useEffect(() => {
    loadMigrations();
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const status = await base44.system.diagnose();
      setDbStatus(status);
      
      // Try a real query to verify table existence
      const { count, error, status: httpStatus } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      if (error) {
        setDbStatus(prev => [...prev, { check: 'Tabela Profiles', status: `ERRO: ${error.message || error.code}` }]);
        
        // Try 'pilots' as alternative
        const { count: pCount, error: pError } = await supabase.from('pilots').select('*', { count: 'exact', head: true });
        if (!pError) {
          setDbStatus(prev => [...prev, { check: 'Tabela Pilots', status: `OK (${pCount} registros) - Sugestão: Alterar mapeamento` }]);
        }
      } else {
        setDbStatus(prev => [...prev, { check: 'Tabela Profiles', status: `OK (${count} registros)` }]);
      }

      // Check Drones
      const { count: dCount, error: dError } = await supabase.from('drones').select('*', { count: 'exact', head: true });
      if (dError) {
        setDbStatus(prev => [...prev, { check: 'Tabela Drones', status: `ERRO: ${dError.message}` }]);
      } else {
        setDbStatus(prev => [...prev, { check: 'Tabela Drones', status: `OK (${dCount} registros)` }]);
      }

      // Check for RLS issues
      if (count === 0 && !error) {
        setDbStatus(prev => [...prev, { 
          check: 'Aviso RLS', 
          status: 'Tabela Profiles retornou 0 registros. Verifique se o RLS (Row Level Security) está habilitado no Supabase e se existe uma política de leitura (SELECT) para a role "anon".' 
        }]);
      }
    } catch (e: any) {
      setDbStatus([{ check: 'Conexão', status: `ERRO: ${e.message || 'Desconhecido'}` }]);
    } finally {
      setLoading(false);
    }
  };

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

      {/* Connection Status Panel */}
      <Card className="p-4 bg-slate-900 text-white border-none shadow-xl flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${dbStatus.some(s => s.status === 'ONLINE') ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Status da Conexão</h3>
              <p className="text-sm font-bold">{dbStatus.some(s => s.status === 'ONLINE') ? 'Banco de Dados Conectado' : 'Modo Offline / LocalStorage'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={checkConnection} disabled={loading} size="sm" variant="outline" className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800 text-[10px] font-black uppercase">
              <Terminal className="w-3 h-3 mr-2" /> {loading ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
          {dbStatus.map((s, i) => (
            <div key={i} className="bg-slate-800/50 p-2 rounded border border-slate-700 flex justify-between items-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold">{s.check}</span>
              <span className={`text-[10px] font-bold ${s.status.includes('ERRO') || s.status.includes('NÃO') ? 'text-red-400' : 'text-green-400'}`}>{s.status}</span>
            </div>
          ))}
        </div>
      </Card>

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
