import { Drone, Pilot } from './types';
import { Material } from './types_inventory';

export type CautelaStatus = 'GERADA' | 'ASSINADA' | 'ENCERRADA';

export interface TermoCautela {
  id: string;
  drone_id: string;
  pilot_id: string;
  unidade_nome: string;
  patrimonio?: string; // Novo campo opcional
  data_inicio: string;
  tempo_dias?: number;
  tempo_indeterminado: boolean;
  assinatura_eletronica?: string;
  data_hora_assinatura?: string;
  status: CautelaStatus;
  created_at: string;
  updated_at: string;
  
  // Joins
  drone?: Drone;
  pilot?: Pilot;
  itens?: Material[];
}

export const TERMO_LEGAL_BASE = `Pelo presente instrumento, o militar abaixo identificado, declara receber nesta data, a título de CAUTELA OPERACIONAL, a aeronave remotamente pilotada (RPA) e seus respectivos acessórios relacionados no ANEXO I deste termo.

O cautelado assume total responsabilidade pela guarda, conservação e emprego do equipamento, comprometendo-se a:
1. Utilizar o equipamento exclusivamente em missões oficiais ou treinamentos autorizados;
2. Observar rigorosamente as normas vigentes (RBAC-E94 ANAC, ICA 100-40 DECEA e Diretrizes do CBMPR);
3. Comunicar imediatamente à SOARP qualquer avaria, incidente ou acidente;
4. Zelar pela integridade física dos componentes e baterias, seguindo as recomendações do fabricante.

A falta de zelo ou o uso indevido do equipamento sujeitará o detentor às sanções administrativas e disciplinares previstas no Código de Ética e Disciplina dos Militares Estaduais.`;