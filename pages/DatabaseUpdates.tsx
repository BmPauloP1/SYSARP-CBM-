import React, { useState, useEffect } from 'react';
import { base44 } from '../services/base44Client';
import { Card, Button, Badge } from '../components/ui_components';
import { Database, CheckCircle, AlertCircle, Play, History, Search, Filter, Copy, Terminal } from 'lucide-react';

interface SchemaMigration {
  id: string;
  applied_at: string;
}

const ALL_UPDATES = [
  {
    id: 'cautela_system_v1.1',
    title: 'Módulo de Termos de Cautela (v1.1)',
    description: 'Cria as tabelas termos_cautela e termo_cautela_itens com suporte a número de patrimônio.',
    category: 'system',
    sql: `
-- CRIAÇÃO DA TABELA DE TERMOS DE CAUTELA
CREATE TABLE IF NOT EXISTS public.termos_cautela (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    drone_id uuid REFERENCES public.drones(id) ON DELETE CASCADE,
    pilot_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    unidade_nome text NOT NULL,
    patrimonio text,
    data_inicio date NOT NULL,
    tempo_dias integer,
    tempo_indeterminado boolean DEFAULT true,
    assinatura_eletronica text,
    data_hora_assinatura timestamp with time zone,
    status text DEFAULT 'GERADA' CHECK (status IN ('GERADA', 'ASSINADA', 'ENCERRADA')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ADICIONAR COLUNA CASO JÁ EXISTA A TABELA
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='termos_cautela' AND column_name='patrimonio') THEN
        ALTER TABLE public.termos_cautela ADD COLUMN patrimonio text;
    END IF;
END $$;

-- CRIAÇÃO DA TABELA DE ITENS VINCULADOS AO TERMO
CREATE TABLE IF NOT EXISTS public.termo_cautela_itens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    termo_cautela_id uuid REFERENCES public.termos_cautela(id) ON DELETE CASCADE,
    item_almoxarifado_id uuid REFERENCES public.materials(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now()
);

-- HABILITAR RLS E CONFIGURAR PERMISSÕES
ALTER TABLE public.termos_cautela ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termo_cautela_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura total de cautelas" ON public.termos_cautela;
CREATE POLICY "Permitir leitura total de cautelas" ON public.termos_cautela FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins podem tudo em cautelas" ON public.termos_cautela;
CREATE POLICY "Admins podem tudo em cautelas" ON public.termos_cautela FOR ALL TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Pilotos podem assinar suas cautelas" ON public.termos_cautela;
CREATE POLICY "Pilotos podem assinar suas cautelas" ON public.termos_cautela FOR UPDATE TO authenticated 
USING (pilot_id = auth.uid());

DROP POLICY IF EXISTS "Leitura total de itens da cautela" ON public.termo_cautela_itens;
CREATE POLICY "Leitura total de itens da cautela" ON public.termo_cautela_itens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins gerenciam itens da cautela" ON public.termo_cautela_itens;
CREATE POLICY "Admins gerenciam itens da cautela" ON public.termo_cautela_itens FOR ALL TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

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
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                     <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                     <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Instrução:</strong> Copie o código acima e execute no <strong>SQL Editor</strong> do painel administrativo do Supabase. 
                        Após executar, atualize a página do SYSARP para ativar as novas funções.
                     </p>
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