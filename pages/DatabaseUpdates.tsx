import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge } from '../components/ui_components';
import { Database, Copy, CheckCircle, AlertTriangle, ChevronDown, History } from 'lucide-react';

// Define the structure for each SQL update script
interface SqlUpdate {
  id: string;
  title: string;
  description: string;
  sql: string;
  category: 'profiles' | 'operations' | 'drones' | 'auth' | 'maintenances';
}

// Array of all SQL updates needed for the application
const ALL_UPDATES: SqlUpdate[] = [
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
    description: 'Adiciona a coluna `operation_id` à tabela `op_summer_flights` e cria uma chave estrangeira para a tabela `operations`. Isso garante a integridade dos dados e permite buscar coordenadas exatas para o mapa de calor.',
    category: 'operations',
    sql: `
-- VINCULA OCORRÊNCIAS DE VERÃO À OPERAÇÃO PRINCIPAL
ALTER TABLE public.op_summer_flights ADD COLUMN IF NOT EXISTS operation_id uuid;

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

const STORAGE_KEY = 'sysarp_sql_updates_applied';

// FIX: Refactored component props into a named interface to resolve a TypeScript error where the `key` prop was being incorrectly type-checked.
interface UpdateCardProps {
  update: SqlUpdate;
  applied: boolean;
  onMark: (id: string) => void;
  onCopy: (sql: string) => void;
}

// @FIX: Converted to a const arrow function component with React.FC.
// This is a robust method for typing functional components that correctly handles
// React's special props like `key`, preventing them from being checked against UpdateCardProps.
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
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setApplied(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error("Failed to load applied status from localStorage", e);
    }
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

  const markAsApplied = (id: string) => {
    const newApplied = new Set(applied);
    newApplied.add(id);
    setApplied(newApplied);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newApplied)));
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