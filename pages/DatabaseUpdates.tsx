import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge } from '../components/ui_components';
import { Database, Copy, CheckCircle, AlertTriangle, ChevronDown, History } from 'lucide-react';
import { base44 } from '../services/base44Client';

// Define the structure for each SQL update script
interface SqlUpdate {
  id: string;
  title: string;
  description: string;
  sql: string;
  category: 'profiles' | 'operations' | 'drones' | 'auth' | 'maintenances' | 'system';
}

// Array of all SQL updates needed for the application
const ALL_UPDATES: SqlUpdate[] = [
  {
    id: 'auth_fix_user_creation_flow',
    title: 'Corrigir Fluxo de Criação de Usuário (Master)',
    description: 'Implementa a criação automática de perfis de usuário via gatilho (trigger) no banco de dados. Este script cria o perfil SOMENTE APÓS a confirmação do e-mail, resolve o erro "violates foreign key constraint" de forma definitiva e corrige usuários existentes que não possuem perfil.',
    category: 'auth',
    sql: `
-- =============================================================================
-- SCRIPT DE CORREÇÃO DEFINITIVO PARA CRIAÇÃO DE PERFIS DE USUÁRIO
-- OBJETIVO: Garantir que um perfil em \`public.profiles\` seja criado
-- atomicamente e de forma segura SOMENTE APÓS o e-mail do usuário
-- ser confirmado em \`auth.users\`.
-- =============================================================================

-- PASSO 1: BACKFILL DE PERFIS FALTANTES (Idempotente)
-- Esta seção corrige dados de usuários existentes que foram confirmados
-- mas não tiveram seu perfil criado devido a falhas no processo anterior.
-- A cláusula \`ON CONFLICT DO NOTHING\` garante que a execução é segura e
-- não tentará criar perfis que já existem.
INSERT INTO public.profiles (id, email, full_name, role, status, terms_accepted)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', 'Nome Pendente'),
  COALESCE(u.raw_user_meta_data ->> 'role', 'operator'),
  'active',
  COALESCE((u.raw_user_meta_data ->> 'terms_accepted')::boolean, false)
FROM auth.users u
WHERE
  u.email_confirmed_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;


-- PASSO 2: CRIAÇÃO DA FUNÇÃO DO GATILHO
-- Esta função será executada pelo gatilho. Ela é responsável por inserir os
-- dados do novo usuário na tabela \`public.profiles\`.
-- \`SECURITY DEFINER\` é crucial para que a função tenha permissão de
-- inserir na tabela \`profiles\`, contornando a RLS do usuário que a invocou.
CREATE OR REPLACE FUNCTION public.handle_new_user_after_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, sarpas_code, crbm, unit, license, role, status, terms_accepted, change_password_required)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'sarpas_code',
    NEW.raw_user_meta_data ->> 'crbm',
    NEW.raw_user_meta_data ->> 'unit',
    NEW.raw_user_meta_data ->> 'license',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'operator'),
    'active',
    COALESCE((NEW.raw_user_meta_data ->> 'terms_accepted')::boolean, false),
    COALESCE((NEW.raw_user_meta_data ->> 'change_password_required')::boolean, true)
  )
  -- Garante idempotência: se um perfil já existir por algum motivo, não faz nada.
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- PASSO 3: CRIAÇÃO DO GATILHO (TRIGGER)
-- Este é o ponto central da solução. O gatilho é disparado \`AFTER UPDATE\` na
-- tabela \`auth.users\`. A cláusula \`WHEN\` garante que ele SÓ execute quando
-- a coluna \`email_confirmed_at\` muda de NULL para um valor não-NULL, ou seja,
-- no exato momento da confirmação do e-mail.
-- Gatilhos antigos são removidos para evitar duplicidade.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; -- Limpa gatilho antigo de INSERT
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users; -- Garante idempotência
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE PROCEDURE public.handle_new_user_after_confirmation();


-- PASSO 4: CONFIGURAÇÃO DE SEGURANÇA (RLS)
-- Garante que a segurança a nível de linha está ativa e define as políticas
-- corretas. A política de INSERT para usuários não é mais necessária, pois
-- o gatilho (\`SECURITY DEFINER\`) cuida disso de forma segura no backend.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Cria as políticas de segurança corretas
-- Permite que todos os usuários autenticados vejam os perfis.
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
-- Permite que um usuário atualize APENAS o seu próprio perfil.
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- PASSO 5: NOTIFICAR O POSTGREST
-- Informa ao Supabase para recarregar o schema e aplicar as novas regras
-- de trigger e RLS imediatamente.
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'operations_align_created_at_with_start_time',
    title: 'Alinhar Data de Criação com Data de Início da Missão',
    description: 'Atualiza a data de criação (`created_at`) de todas as operações para ser igual à data de início (`start_time`), garantindo consistência nos relatórios e históricos, mesmo para missões cadastradas antecipadamente.',
    category: 'operations',
    sql: `
-- Alinha a data de criação ('created_at') com a data de início ('start_time')
-- para todas as operações existentes. Isso corrige inconsistências em relatórios
-- onde uma operação era cadastrada em um dia para iniciar em outro.
UPDATE public.operations
SET created_at = start_time
WHERE DATE(created_at) != DATE(start_time);
`
  },
  {
    id: 'system_create_migrations_table',
    title: 'Habilitar Controle de Versão do Banco',
    description: 'Cria a tabela `schema_migrations` para rastrear quais atualizações SQL já foram aplicadas. Este é o script mais importante e deve ser o primeiro a ser executado para habilitar o novo sistema de controle.',
    category: 'system',
    sql: `
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir Acesso Total a Migrations" ON public.schema_migrations;

CREATE POLICY "Permitir Acesso Total a Migrations"
    ON public.schema_migrations
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'auth_admin_reset_password',
    title: 'Habilitar Reset de Senha pelo Admin',
    description: 'Cria a função RPC `admin_reset_user_password` que permite a um administrador resetar a senha de qualquer usuário e forçar a troca no próximo login.',
    category: 'auth',
    sql: `
CREATE OR REPLACE FUNCTION admin_reset_user_password(user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualiza a senha do usuário na tabela 'users' do schema 'auth'
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = user_id;

  -- Também marca que o usuário precisa mudar a senha no próximo login
  UPDATE public.profiles
  SET change_password_required = true
  WHERE id = user_id;
END;
$$;

-- Garante que a função pode ser chamada pelo app
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;
`
  },
  {
    id: 'auth_auto_confirm_email',
    title: 'Desativar Confirmação de E-mail',
    description: 'Confirma todos os usuários pendentes e cria um gatilho para confirmar automaticamente novos cadastros. Útil quando o SMTP não está configurado.',
    category: 'auth',
    sql: `
-- 1. Confirma automaticamente todos os usuários pendentes atuais
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

-- 2. Cria função para confirmar automaticamente novos cadastros
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger AS $$
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Aplica o gatilho
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_email();
`
  },
  {
    id: 'profiles_rls_update',
    title: 'Permissões de Edição de Pilotos (RLS)',
    description: 'Define as políticas de segurança (RLS) para a tabela de perfis, permitindo que usuários editem seus próprios dados e que administradores editem qualquer perfil.',
    category: 'profiles',
    sql: `
DROP POLICY IF EXISTS "Edição de perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem editar" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1) = 'admin' );
`
  },
  {
    id: 'profiles_unlock_registration',
    title: 'Desbloquear Cadastro de Pilotos',
    description: 'Remove o gatilho `handle_new_user` que pode causar conflitos e garante que a tabela `profiles` tenha todas as colunas necessárias para o cadastro via app.',
    category: 'profiles',
    sql: `
-- 1. REMOVE O GATILHO DE BANCO DE DADOS (Causa do erro "Database error saving new user")
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. GARANTE QUE A TABELA DE PERFIS ACEITE DADOS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS sarpas_code text,
ADD COLUMN IF NOT EXISTS crbm text,
ADD COLUMN IF NOT EXISTS unit text,
ADD COLUMN IF NOT EXISTS license text,
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;

-- 3. PERMISSÕES PARA O APP CRIAR O PERFIL DIRETAMENTE
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 4. ATUALIZA SCHEMA
NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'summer_op_link',
    title: 'Vincular Op. Verão à Operação Principal',
    description: 'Adiciona a coluna `operation_id` e uma chave estrangeira na tabela `op_summer_flights` para vincular à `operations`. O script agora remove a constraint se ela já existir, tornando a atualização re-executável.',
    category: 'operations',
    sql: `
-- VINCULA OCORRÊNCIAS DE VERÃO À OPERAÇÃO PRINCIPAL
ALTER TABLE public.op_summer_flights ADD COLUMN IF NOT EXISTS operation_id uuid;

-- Garante que o script possa ser re-executado removendo a constraint se ela já existir
ALTER TABLE public.op_summer_flights
DROP CONSTRAINT IF EXISTS op_summer_flights_operation_id_fkey;

ALTER TABLE public.op_summer_flights
ADD CONSTRAINT op_summer_flights_operation_id_fkey
FOREIGN KEY (operation_id)
REFERENCES public.operations(id)
ON DELETE SET NULL; -- Mantém o log de verão mesmo se a operação principal for deletada

NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'operations_add_takeoff_points',
    title: 'Habilitar Múltiplos Pontos de Decolagem',
    description: 'Adiciona a coluna `takeoff_points` (do tipo JSONB) à tabela de operações. Isso permite salvar múltiplos pontos geolocalizados, cada um com sua própria altitude, para uma única missão.',
    category: 'operations',
    sql: `
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS takeoff_points jsonb;

NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'operations_add_fields_1',
    title: 'Adicionar Campos de Operação (v1)',
    description: 'Adiciona as colunas `op_crbm` e `op_unit` à tabela de operações para permitir o registro da área da ocorrência, independente da lotação do piloto.',
    category: 'operations',
    sql: `
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS op_crbm text;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS op_unit text;

NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'operations_add_fields_2',
    title: 'Adicionar Campos de Operação (v2)',
    description: 'Adiciona as colunas `is_multi_day`, `is_summer_op`, e `sarpas_protocol` para habilitar as funcionalidades de Operação Verão e Multidias.',
    category: 'operations',
    sql: `
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS is_multi_day boolean DEFAULT false;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS is_summer_op boolean DEFAULT false;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS sarpas_protocol text;

NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'operations_add_pause_fields',
    title: 'Habilitar Pausa em Operações',
    description: 'Adiciona as colunas necessárias para a funcionalidade de pausar e retomar operações, incluindo `is_paused`, `last_pause_start`, `total_pause_duration`, e `pause_logs`.',
    category: 'operations',
    sql: `
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS last_pause_start timestamp with time zone;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS total_pause_duration float DEFAULT 0;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS pause_logs jsonb DEFAULT '[]';

NOTIFY pgrst, 'reload schema';
`
  },
  {
    id: 'operations_fix_float_types',
    title: 'Corrigir Tipos de Colunas Numéricas',
    description: 'Altera as colunas `total_pause_duration` e `flight_hours` de inteiro para float, permitindo o registro de valores decimais (ex: 1.5 horas).',
    category: 'operations',
    sql: `
ALTER TABLE public.operations ALTER COLUMN total_pause_duration TYPE float USING total_pause_duration::float;
ALTER TABLE public.operations ALTER COLUMN flight_hours TYPE float USING flight_hours::float;
`
  },
  {
    id: 'drones_add_location_fields',
    title: 'Adicionar Localização a Aeronaves',
    description: 'Adiciona as colunas `crbm` e `unit` à tabela de drones para registrar a lotação fixa de cada aeronave.',
    category: 'drones',
    sql: `
ALTER TABLE public.drones ADD COLUMN IF NOT EXISTS crbm text;
ALTER TABLE public.drones ADD COLUMN IF NOT EXISTS unit text;
`
  },
  {
    id: 'drones_rls_update_status',
    title: 'Permitir Atualização de Status de Drone',
    description: 'Cria uma política de segurança (RLS) que permite a qualquer usuário autenticado atualizar o status de uma aeronave (ex: para "Em Operação" ou "Disponível").',
    category: 'drones',
    sql: `
DROP POLICY IF EXISTS "Enable update for users based on email" ON "public"."drones";
CREATE POLICY "Enable update for users"
ON "public"."drones"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
`
  },
  {
    id: 'maintenances_create_table',
    title: 'Criar Tabela de Manutenções',
    description: 'Cria a tabela `maintenances` completa com todas as colunas e permissões RLS necessárias para o funcionamento do módulo de manutenção.',
    category: 'maintenances',
    sql: `
CREATE TABLE IF NOT EXISTS public.maintenances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    drone_id uuid REFERENCES public.drones(id) ON DELETE CASCADE,
    pilot_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    maintenance_type text NOT NULL,
    description text,
    technician text,
    maintenance_date date,
    maintenance_time time,
    next_maintenance_date date,
    cost float DEFAULT 0,
    status text DEFAULT 'scheduled',
    in_flight_incident boolean DEFAULT false,
    log_file_url text
);

-- PERMISSÕES
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir Acesso Total" ON public.maintenances;
CREATE POLICY "Permitir Acesso Total" ON public.maintenances FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
`
  }
];

interface UpdateCardProps {
  update: SqlUpdate;
  applied: boolean;
  onMark: (id: string) => void;
  onCopy: (sql: string) => void;
}

const UpdateCard: React.FC<UpdateCardProps> = ({ update, applied, onMark, onCopy }) => {
  return (
    <Card className="p-0 overflow-hidden">
      <div className={`p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 ${applied ? 'bg-green-50' : 'bg-slate-50'}`}>
        <div>
          <Badge className="mb-2 text-xs">{update.category.toUpperCase()}</Badge>
          <h3 className="font-bold text-slate-800">{update.title}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">{update.description}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {applied ? (
            <Badge variant="success" className="flex-1 justify-center sm:flex-initial">
              <CheckCircle className="w-3 h-3 mr-1" />
              Aplicado
            </Badge>
          ) : (
            <Button onClick={() => onMark(update.id)} variant="outline" size="sm" className="bg-white flex-1 sm:flex-initial">
              Marcar como Aplicado
            </Button>
          )}
        </div>
      </div>
      <div className="relative bg-slate-900 text-green-400 p-4 font-mono text-xs overflow-x-auto">
        <pre>{update.sql.trim()}</pre>
        <button 
          onClick={() => onCopy(update.sql.trim())}
          className="absolute top-2 right-2 p-2 bg-white/10 text-white rounded-md hover:bg-white/20 transition-colors"
          title="Copiar SQL"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

export default function DatabaseUpdates() {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const loadAppliedStatus = async () => {
      try {
        const appliedMigrations = await base44.entities.SchemaMigration.list();
        const appliedIds = new Set(appliedMigrations.map(m => m.id));
        setApplied(appliedIds);
      } catch (e) {
        console.error("Falha ao carregar status de atualizações do banco. Verifique se a tabela 'schema_migrations' existe.", e);
      }
    };
    loadAppliedStatus();
  }, []);

  const reversedUpdates = useMemo(() => [...ALL_UPDATES].reverse(), []);

  const pendingUpdates = useMemo(() => 
    reversedUpdates.filter(update => !applied.has(update.id)),
    [reversedUpdates, applied]
  );

  const completedUpdates = useMemo(() =>
    reversedUpdates.filter(update => applied.has(update.id)),
    [reversedUpdates, applied]
  );

  const copyToClipboard = (sql: string) => {
    navigator.clipboard.writeText(sql)
      .then(() => alert('Código SQL copiado para a área de transferência!'))
      .catch(() => alert('Falha ao copiar.'));
  };

  const markAsApplied = async (id: string) => {
    try {
      await base44.entities.SchemaMigration.create({ id } as any);
      const newApplied = new Set(applied);
      newApplied.add(id);
      setApplied(newApplied);
    } catch (error) {
      alert(`Erro ao marcar script como aplicado: ${error}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 h-full overflow-y-auto pb-12">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="p-3 bg-slate-800 rounded-lg text-white shadow-lg">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Atualizações de Banco de Dados</h1>
          <p className="text-sm text-slate-500">Scripts SQL para atualização manual do esquema do Supabase.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-900 flex items-start gap-3">
         <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
         <div>
            <strong className="block">Atenção:</strong> 
            Execute estes scripts no "SQL Editor" do seu projeto Supabase. Marque como "Aplicado" após a execução para manter o controle.
         </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 border-b pb-2">
          Atualizações Pendentes ({pendingUpdates.length})
        </h2>
        
        {pendingUpdates.length === 0 ? (
          <div className="bg-green-50 border border-green-200 p-6 rounded-xl text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-bold text-green-800">Seu sistema está atualizado!</h3>
            <p className="text-sm text-green-700">Nenhum script pendente de execução.</p>
          </div>
        ) : (
          pendingUpdates.map(update => (
            <UpdateCard 
              key={update.id}
              update={update} 
              applied={false}
              onMark={markAsApplied}
              onCopy={copyToClipboard}
            />
          ))
        )}
      </div>

      <div className="pt-6 border-t border-slate-200">
         <button 
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex justify-between items-center p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
         >
            <div className="flex items-center gap-2 font-bold text-slate-600">
               <History className="w-5 h-5" />
               Histórico de Atualizações Aplicadas ({completedUpdates.length})
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
         </button>
         
         {showCompleted && (
            <div className="mt-4 space-y-4 animate-fade-in">
               {completedUpdates.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-4">Nenhuma atualização foi aplicada ainda.</p>
               ) : (
                 completedUpdates.map(update => (
                    <UpdateCard 
                      key={update.id}
                      update={update} 
                      applied={true}
                      onMark={markAsApplied}
                      onCopy={copyToClipboard}
                    />
                 ))
               )}
            </div>
         )}
      </div>
    </div>
  );
}