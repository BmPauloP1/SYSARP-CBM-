
export type MissionType = 
  | 'fire' 
  | 'sar' 
  | 'aph' 
  | 'traffic_accident' 
  | 'hazmat' 
  | 'natural_disaster' 
  | 'public_security' 
  | 'inspection' 
  | 'air_support' 
  | 'maritime' 
  | 'environmental' 
  | 'training' 
  | 'admin_support' 
  | 'diverse';

export type OperationStatus = 'active' | 'completed' | 'cancelled';
export type PilotRole = 'admin' | 'operator';
export type PilotStatus = 'active' | 'inactive';
export type DroneStatus = 'available' | 'in_operation' | 'maintenance';
export type MaintenanceType = 'preventive' | 'corrective' | 'inspection' | 'calibration' | 'battery' | 'propeller' | 'camera' | 'general';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed';

// Logo Oficial do CBMPR (Local)
export const SYSARP_LOGO = "/img/logosoarp.png";

export interface Pilot {
  id: string;
  full_name: string;
  sarpas_code: string;
  phone: string;
  crbm: string;
  unit: string;
  license: string;
  course_type: 'internal' | 'external';
  course_name: string;
  course_year: number;
  course_hours: number;
  role: PilotRole;
  status: PilotStatus;
  email: string;
  password?: string;
  change_password_required?: boolean;
  terms_accepted?: boolean;
  terms_accepted_at?: string;
}

export interface Drone {
  id: string;
  prefix: string;
  brand: string;
  model: string;
  serial_number: string;
  sisant: string;
  sisant_expiry_date: string;
  payloads: string[];
  max_flight_time: number;
  max_range: number;
  max_altitude: number;
  weight: number;
  status: DroneStatus;
  total_flight_hours: number;
  last_30day_check?: string;
  crbm?: string;
  unit?: string;
}

export interface SystemAuditLog {
  id: string;
  user_id: string;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT';
  entity: string;
  entity_id?: string;
  details: string;
  timestamp: string;
  ip_address?: string;
}

export interface ChecklistItemState {
  category: string;
  name: string;
  checked: boolean;
}

export interface DroneChecklist {
  id: string;
  drone_id: string;
  pilot_id: string;
  date: string;
  items: ChecklistItemState[];
  status: 'approved' | 'rejected';
  notes?: string;
}

export const DRONE_CHECKLIST_TEMPLATE = {
  "Documentação": [
    "Checklist (PREFLIGHT, STARTING, TAKEOFF, LANDING, J11 and J12)",
    "Contatos Regionais, ATS e DTCEA",
    "Dtz POP CBMPR",
    "Certificado ANAC",
    "Homologação ANATEL",
    "A.R.O. - Avaliação de Risco Operacional",
    "Manual da Aeronave",
    "Registro de Voos",
    "Registro de Defeitos e MNT (Leitura de pendências)",
    "Checklist de Materiais e Equipamentos"
  ],
  "Equipamento": [
    "Verificar integridade física da RPA",
    "Verificar integridade física do CONTROLE",
    "Verificar integridade física das BATERIAS",
    "Verificar integridade física das HÉLICES",
    "Baterias totalmente carregadas da RPA",
    "Bateria totalmente carregada do Controle"
  ],
  "Voo de Checagem": [
    "Fixação correta das hélices",
    "Remover tampa da lente/trava do gimbal",
    "Colocar a Bateria na RPA",
    "Ligar Controle",
    "Ligar RPA e mantê-la em local plano e imóvel",
    "Verificar posição das antenas do controle",
    "Verificar se o brilho e volume da Tela estão no máximo",
    "Abrir aplicativo de voo",
    "Ajustar Altura Máxima de Voo e RTH em 120 m",
    "Rc Signal Lost (deve estar na opção Return-to-home)",
    "Formatar cartão de memória",
    "Verificar chave do modo de Voo no Controle em 'P'",
    "Verificar se o Smart Return da Bateria está ativado",
    "Verificar Status Principal em Cor Verde no SmartController",
    "Verificar quantidade mínima de 10 satélites",
    "Área de decolagem livre de pessoas ou objetos",
    "Realizar decolagem subindo até 3m de altura",
    "Verificar respostas dos comandos de Voo e Gimbal",
    "Pousar a aeronave",
    "Desligar RPA",
    "Remover Bateria e colocá-la em local adequado",
    "Remover as Hélices",
    "Enviar o Registro de Vôos para Nuvem",
    "Desligar Controle",
    "Recarregar Todas as Baterias e Controle antes de Armazenar"
  ],
  "Prontidão": [
    "Acondicionar o material em local adequado"
  ]
};

export type RiskProbability = 1 | 2 | 3 | 4 | 5;
export type RiskSeverity = 'A' | 'B' | 'C' | 'D' | 'E';
export type RiskLevel = 'EXTREME' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AroItem {
  scenario_id: number;
  description: string;
  probability: RiskProbability;
  severity: RiskSeverity;
  risk_code: string;
  mitigation: string;
  authorization_level?: string;
}

export interface AroAssessment {
  items: AroItem[];
  declaration_accepted: boolean;
  rubric: string;
  created_at: string;
}

export const ARO_SCENARIOS = [
  "Situação 1: Perda de Link C2",
  "Situação 2: Existência de tráfego aéreo local",
  "Situação 3: Presença de pessoas não anuentes",
  "Situação 4: Vento acima do recomendado pelo fabricante",
  "Situação 5: Ultrapassar os limites previstos na LEGISLAÇÃO",
  "Situação 6: Voo noturno",
  "Situação 7: Voo sob chuva moderada",
  "Situação 8: Voo acima de 120m AGL (exceto ENTORNO DE ESTRUTURA)"
];

export interface Operation {
  id: string;
  name: string;
  occurrence_number: string;
  latitude: number;
  longitude: number;
  drone_id: string;
  pilot_id: string;
  pilot_name?: string;
  second_pilot_id?: string;
  second_pilot_name?: string;
  observer_id?: string;
  observer_name?: string;
  radius: number;
  flight_altitude?: number;
  mission_type: MissionType;
  sub_mission_type?: string;
  status: OperationStatus;
  start_time: string;
  end_time?: string;
  flight_hours?: number;
  photos: string[];
  gpx_file?: string;
  stream_url?: string;
  notes?: string;
  created_at: string;
  kmz_file?: string;
  description?: string;
  actions_taken?: string;
  sarpas_protocol?: string;
  is_summer_op?: boolean; 
  aro?: AroAssessment;
  flight_plan_data?: string;
  shapes?: any;
  is_paused?: boolean;
  last_pause_start?: string | null;
  total_pause_duration?: number;
  pause_logs?: { start: string; end?: string; reason: string; duration?: number }[];
}

export interface Maintenance {
  id: string;
  drone_id: string;
  pilot_id?: string;
  maintenance_type: MaintenanceType;
  description: string;
  technician: string;
  maintenance_date: string;
  maintenance_time: string;
  next_maintenance_date: string;
  cost: number;
  status: MaintenanceStatus;
  in_flight_incident: boolean;
  log_file_url?: string;
}

export interface ConflictNotification {
  id: string;
  target_pilot_id: string;
  new_op_name: string;
  new_pilot_name: string;
  new_pilot_phone?: string;
  new_op_altitude: number;
  new_op_radius: number;
  created_at: string;
  acknowledged: boolean;
}

export interface FlightLog {
  id: string;
  operation_id: string;
  pilot_id: string;
  drone_id: string;
  flight_date: string;
  flight_hours: number;
  mission_type: string;
}

export const MISSION_HIERARCHY: Record<MissionType, { label: string; subtypes: string[] }> = {
  fire: {
    label: "1. Incêndios",
    subtypes: [
      "Incêndio Urbano",
      "Incêndio em Vegetação",
      "Incêndio Florestal",
      "Incêndio Industrial",
      "Incêndio Comercial",
      "Incêndio em Residência",
      "Incêndio em Veículo",
      "Incêndio em Subsolo",
      "Foco de Calor / Hotspot detectado",
      "Risco de Incêndio (monitoramento)"
    ]
  },
  sar: {
    label: "2. Busca e Salvamento (SAR)",
    subtypes: [
      "Pessoa Desaparecida em Área Urbana",
      "Pessoa Desaparecida em Área de Mata",
      "Busca Aquática",
      "Busca em Área de Risco",
      "Localização de Vítima",
      "Acompanhamento de Equipes de Solo",
      "Resgate em Altura (visão aérea)",
      "Monitoramento de Área Colapsada",
      "Mapeamento para Planejamento SAR"
    ]
  },
  aph: {
    label: "3. Atendimento Pré-Hospitalar (APH)",
    subtypes: [
      "Acompanhamento de Ocorrência com Múltiplas Vítimas",
      "Suporte a Acidente de Trânsito",
      "Entrega de Equipamento Médico (DEA, torniquete, etc.)",
      "Abertura de Rotas para Equipe",
      "Avaliação Inicial da Cena"
    ]
  },
  traffic_accident: {
    label: "4. Acidente de Trânsito",
    subtypes: [
      "Colisão Veicular",
      "Capotamento",
      "Atropelamento",
      "Engavetamento",
      "Acidente com Caminhão / Carga Perigosa",
      "Monitoramento de Fluxo",
      "Abertura de Acesso para Resgate",
      "Avaliação de Derramamento"
    ]
  },
  hazmat: {
    label: "5. Produtos Perigosos (HazMat)",
    subtypes: [
      "Vazamento de Produto Químico",
      "Vazamento de Gás",
      "Vazamento de Combustível",
      "Identificação de Placas de Risco",
      "Monitoramento do Nuvem Tóxica",
      "Análise Térmica à Distância"
    ]
  },
  natural_disaster: {
    label: "6. Desastres Naturais",
    subtypes: [
      "Enchente / Alagamento",
      "Deslizamento",
      "Rompimento de Barragem",
      "Vendaval / Tempestade",
      "Enxurrada",
      "Avaliação de Dano Estrutural",
      "Mapeamento de Área Afetada",
      "Identificação de Rotas Acessíveis",
      "Localização de Vítimas em Telhados"
    ]
  },
  public_security: {
    label: "7. Operações de Segurança Pública",
    subtypes: [
      "Monitoramento de Área de Risco",
      "Apoio a Operações Integradas",
      "Acompanhamento de Distúrbio Urbano",
      "Vigilância Aérea",
      "Reconhecimento de Área Suspeita",
      "Perseguição / Acompanhamento Veicular (apoio)"
    ]
  },
  inspection: {
    label: "8. Monitoramento e Inspeção",
    subtypes: [
      "Inspeção de Estruturas",
      "Inspeção de Fachadas / Telhados",
      "Inspeção de Torres e Antenas",
      "Monitoramento de Eventos / Grandes Multidões",
      "Monitoramento de Áreas de Preservação",
      "Mapeamento de Terreno",
      "Termografia"
    ]
  },
  air_support: {
    label: "9. Apoio a Operações Aéreas",
    subtypes: [
      "Reconhecimento de Área para Pouso de Helicóptero",
      "Acompanhamento de Manobras",
      "Segurança de Heliponto",
      "Avaliação de Obstáculos Aéreos"
    ]
  },
  maritime: {
    label: "10. Operações Marítimas / Fluviais",
    subtypes: [
      "Busca em Represa / Rio",
      "Monitoramento de Embarcações",
      "Identificação de Correnteza",
      "Localização de Náufragos",
      "Avaliação de Risco de Afogamento"
    ]
  },
  environmental: {
    label: "11. Ocorrências Ambientais",
    subtypes: [
      "Desmatamento",
      "Queimada Ilegal",
      "Poluição em Rios/Lagos",
      "Monitoramento de Fauna",
      "Identificação de Animais Perigosos",
      "Monitoramento de Rejeitos"
    ]
  },
  training: {
    label: "12. Operações de Treinamento",
    subtypes: [
      "Simulado de Incêndio",
      "Simulado de SAR",
      "Treinamento de Pilotos",
      "Teste de Equipamentos",
      "Avaliação Pós-Missão"
    ]
  },
  admin_support: {
    label: "13. Apoio Administrativo",
    subtypes: [
      "Filmagem Institucional",
      "Cobertura de Eventos Oficiais",
      "Registro de Obras e Reformas",
      "Inspeção de Unidades"
    ]
  },
  diverse: {
    label: "14. Ocorrências Diversas",
    subtypes: [
      "Apoio à Defesa Civil",
      "Avaliação de Área de Risco",
      "Reconhecimento de Rotas Evacuadas",
      "Monitoramento de Comunidades Isoladas",
      "Documentação para Relatórios Técnicos"
    ]
  }
};

export const MISSION_LABELS: Record<MissionType, string> = {
  fire: MISSION_HIERARCHY.fire.label,
  sar: MISSION_HIERARCHY.sar.label,
  aph: MISSION_HIERARCHY.aph.label,
  traffic_accident: MISSION_HIERARCHY.traffic_accident.label,
  hazmat: MISSION_HIERARCHY.hazmat.label,
  natural_disaster: MISSION_HIERARCHY.natural_disaster.label,
  public_security: MISSION_HIERARCHY.public_security.label,
  inspection: MISSION_HIERARCHY.inspection.label,
  air_support: MISSION_HIERARCHY.air_support.label,
  maritime: MISSION_HIERARCHY.maritime.label,
  environmental: MISSION_HIERARCHY.environmental.label,
  training: MISSION_HIERARCHY.training.label,
  admin_support: MISSION_HIERARCHY.admin_support.label,
  diverse: MISSION_HIERARCHY.diverse.label
};

// Estrutura Organizacional do CBM-PR (Mapeamento CRBM -> Unidades)
export const ORGANIZATION_CHART: Record<string, string[]> = {
  "Comando Geral e Especializadas (Curitiba)": [
    "CCB (QCGBM) - Quartel do Comando Geral",
    "GOST - Grupo de Operações de Socorro Tático",
    "FORÇA TAREFA (FT) - Resposta a Desastres"
  ],
  "1º CRBM - Curitiba (Leste/Litoral)": [
    "Sede Administrativa - 1º CRBM",
    "1º BBM - Curitiba",
    "6º BBM - São José dos Pinhais",
    "7º BBM - Colombo",
    "8º BBM - Paranaguá",
    "BOA - Batalhão de Operações Aéreas"
  ],
  "2º CRBM - Londrina (Norte)": [
    "Sede Administrativa - 2º CRBM",
    "3º BBM - Londrina",
    "11º BBM - Apucarana",
    "1ª CIBM - Ivaiporã",
    "3ª CIBM - Santo Antônio da Platina"
  ],
  "3º CRBM - Cascavel (Oeste)": [
    "Sede Administrativa - 3º CRBM",
    "4º BBM - Cascavel",
    "9º BBM - Foz do Iguaçu",
    "10º BBM - Francisco Beltrão",
    "13º BBM - Pato Branco"
  ],
  "4º CRBM - Maringá (Noroeste)": [
    "Sede Administrativa - 4º CRBM",
    "5º BBM - Maringá",
    "2ª CIBM - Umuarama",
    "4ª CIBM - Cianorte",
    "5ª CIBM - Paranavaí"
  ],
  "5º CRBM - Ponta Grossa (Campos Gerais)": [
    "Sede Administrativa - 5º CRBM",
    "2º BBM - Ponta Grossa",
    "12º BBM - Guarapuava",
    "6ª CIBM - Irati"
  ],
  "Defesa Civil": [
    "COMPEDEC",
    "NAR"
  ]
};

// LGPD - Texto Legal
export const LGPD_TERMS = `
POLÍTICA DE PRIVACIDADE E TERMOS DE USO DE DADOS - SYSARP CBMPR

1. FINALIDADE DO TRATAMENTO
O Sistema de Aeronaves Remotamente Pilotadas (SYSARP) do Corpo de Bombeiros Militar do Paraná coleta e processa dados pessoais para fins exclusivos de:
- Gestão operacional de missões aéreas de segurança pública e defesa civil.
- Registro de horas de voo para controle de manutenção e habilitação de pilotos.
- Integração com sistemas de controle do espaço aéreo (DECEA/SARPAS) para solicitação de voos.
- Auditoria e compliance conforme regulamentação da ANAC (RBAC-E94) e DECEA (ICA 100-40).

2. DADOS COLETADOS
Serão coletados e armazenados:
- Nome Completo e Posto/Graduação.
- Dados de contato (E-mail Institucional, Telefone).
- Dados operacionais (Código SARPAS, Licença ANAC, Lotação).
- Geolocalização durante o uso do sistema para monitoramento de operações.

3. COMPARTILHAMENTO DE DADOS
Os dados poderão ser compartilhados automaticamente via API com o Departamento de Controle do Espaço Aéreo (DECEA) para fins de autorização de voo, conforme exigência legal. Não haverá uso comercial dos dados.

4. SEGURANÇA
Adotamos medidas técnicas para proteger seus dados, incluindo criptografia em trânsito e repouso. O acesso é restrito a pessoal autorizado.

5. DIREITOS DO TITULAR
Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a confirmar a existência de tratamento, acessar seus dados e corrigir dados incompletos. Para exercer esses direitos, contate a administração do sistema.

Ao prosseguir, você declara estar ciente e de acordo com estes termos.
`;