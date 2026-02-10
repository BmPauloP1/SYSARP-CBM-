
import { createClient } from '@supabase/supabase-js';

// Função para limpar variáveis de ambiente e remover aspas indesejadas
const sanitize = (value: any): string => {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/["']/g, '').trim();
};

// Fallback robusto para evitar quebras de inicialização
const getEnvVar = (key: string, fallback: string) => {
  try {
    const value = sanitize((import.meta as any).env?.[key]);
    return value || fallback;
  } catch {
    return fallback;
  }
};

const FALLBACK_URL = "https://hcnlrzzwwcbhkxfcolgw.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjbmxyenp3d2NiaGt4ZmNvbGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjI2MjUsImV4cCI6MjA3OTk5ODYyNX0.bbfDQA8VHebBMizyJGeP1GentnEiEka1nvFdR7fgQwo";

const finalUrl = getEnvVar('VITE_SUPABASE_URL', FALLBACK_URL);
const finalKey = getEnvVar('VITE_SUPABASE_ANON_KEY', FALLBACK_KEY);

export const isConfigured = finalUrl.startsWith('http') && finalKey.length > 20;

// Criação segura do cliente
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  db: {
    schema: 'public'
  }
});
