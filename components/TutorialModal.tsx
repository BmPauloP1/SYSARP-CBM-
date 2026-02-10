import React, { useState } from 'react';
import { Card, Button } from './ui_components';
import { 
  X, BookOpen, MousePointer2, Crosshair, Plane, 
  FileText, ShieldCheck, Zap, Globe, Camera, 
  ChevronRight, HelpCircle, Info, AlertTriangle,
  Share2, Wrench, Search, Database, LayoutGrid,
  Calendar, Youtube, ClipboardCheck, Box, History,
  Activity, Sun
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TopicId = 'overview' | 'ops' | 'cco' | 'fleet' | 'maint' | 'video' | 'reports';

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [activeTopic, setActiveTopic] = useState<TopicId>('overview');

  if (!isOpen) return null;

  const topics = [
    { id: 'overview', label: 'Visão Geral', icon: Info },
    { id: 'ops', label: 'Gestão de Missões', icon: Zap },
    { id: 'cco', label: 'CCO Tático (Mapa)', icon: Crosshair },
    { id: 'fleet', label: 'Aeronaves & Ativos', icon: Plane },
    { id: 'maint', label: 'Manutenção', icon: Wrench },
    { id: 'video', label: 'Transmissão de Vídeo', icon: Youtube },
    { id: 'reports', label: 'Relatórios & PDF', icon: FileText },
  ];

  const renderContent = () => {
    switch (activeTopic) {
      case 'overview':
        return (
          <div className="space-y-4 animate-fade-in text-slate-700">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-2xl text-red-700">
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Manual de Operação SYSARP</h3>
                <p className="text-sm text-slate-500">Documentação técnica para pilotos e administradores.</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              O <strong>SYSARP</strong> é o sistema oficial do CBMPR para controle de aeronaves remotamente pilotadas. Este guia cobre o fluxo de trabalho obrigatório para garantir a conformidade com as normas do DECEA e a precisão estatística da corporação.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-red-600 uppercase mb-2">Padrão de Acesso</p>
                <p className="text-xs">Utilize seu e-mail institucional <strong>@cbm.pr.gov.br</strong> e mantenha sua senha sob sigilo.</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Sincronização</p>
                <p className="text-xs">O sistema possui cache local para operações em áreas sem cobertura de internet.</p>
              </div>
            </div>
          </div>
        );

      case 'ops':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Gestão de Missões Operacionais</h3>
            
            <section className="space-y-2">
              <h4 className="text-sm font-black text-red-700 uppercase flex items-center gap-2"><Zap className="w-4 h-4"/> Como lançar uma ocorrência</h4>
              <p className="text-xs">Acesse <strong>Operações</strong> > <strong>Nova Missão</strong>. O sistema gera automaticamente o <strong>Protocolo ARP</strong> baseado no ano e na sua unidade. Preencha a natureza da missão e localize o Ponto de Comando (PC) no mapa.</p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-black text-blue-700 uppercase flex items-center gap-2"><Calendar className="w-4 h-4"/> Modo Multi-dias</h4>
              <p className="text-xs">Para buscas prolongadas ou grandes eventos, ative o <strong>Modo Multidias</strong>. Isso habilita o <strong>Diário de Bordo</strong>, permitindo registrar equipes, aeronaves e resumos meteorológicos diferentes para cada dia da mesma missão.</p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-black text-green-700 uppercase flex items-center gap-2"><Share2 className="w-4 h-4"/> Compartilhamento</h4>
              <p className="text-xs">No card da missão ativa, utilize o ícone do <strong>WhatsApp</strong>. O sistema gera um link do Google Maps com as coordenadas exatas do PC para facilitar a chegada de apoio ou outras agências.</p>
            </section>
          </div>
        );

      case 'cco':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">CCO Tático (Nível 2)</h3>
            <p className="text-xs mb-4">A interface de mapa de alta precisão para execução em campo.</p>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-white rounded-lg shadow-sm text-red-600"><LayoutGrid className="w-5 h-5"/></div>
                <div className="text-xs"><strong>Desenho em Tela:</strong> Use as ferramentas de topo para setorizar áreas de busca ou traçar rotas de varredura. Clique no elemento desenhado para nomeá-lo (ex: "SETOR ALFA").</div>
              </div>
              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600"><Globe className="w-5 h-5"/></div>
                <div className="text-xs"><strong>Importação KML:</strong> No painel lateral, importe arquivos <strong>.KML</strong> (Google Earth). Você pode importar apenas perímetros, trilhas GPS ou o arquivo completo.</div>
              </div>
              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-white rounded-lg shadow-sm text-orange-600"><Camera className="w-5 h-5"/></div>
                <div className="text-xs"><strong>Snapshots:</strong> O botão "Capturar Snapshot" salva uma imagem de alta resolução do seu mapa tático. Esta imagem é anexada automaticamente ao relatório final.</div>
              </div>
            </div>
          </div>
        );

      case 'fleet':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Aeronaves & Ativos</h3>
            
            <section className="space-y-2">
              <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-green-600"/> Checklist de 7 Dias</h4>
              <p className="text-xs italic">Segurança em primeiro lugar.</p>
              <p className="text-xs text-slate-500">Cada aeronave exige um checklist semanal. Se a barra de progresso estiver em <strong>vermelho</strong>, a aeronave é considerada "Atenção Crítica" e não deve decolar até a nova inspeção ser registrada.</p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600"/> Pasta Digital</h4>
              <p className="text-xs">Clique em <strong>Documentos</strong> em qualquer aeronave. Aqui você armazena PDFs de Manuais, AROs Preventivas e Certificados. O sistema também gera relatórios automáticos de horas de voo e manutenções passadas.</p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><Box className="w-4 h-4 text-orange-600"/> Almoxarifado Integrado</h4>
              <p className="text-xs">Gerencie Baterias, Hélices e Controles. O sistema rastreia <strong>ciclos de bateria</strong> e alerta sobre a vida útil das hélices. Use a ferramenta "Verificar Duplicados" para garantir que nenhum número de série foi cadastrado erroneamente em outro drone.</p>
            </section>
          </div>
        );

      case 'maint':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Gestão de Manutenção</h3>
            
            <div className="space-y-4">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                <h4 className="text-xs font-black text-orange-800 uppercase mb-2">Como solicitar manutenção?</h4>
                <p className="text-xs">Na aba de <strong>Aeronaves</strong>, clique no botão <strong>Manutenção</strong>. Descreva o defeito e o piloto solicitante. A aeronave ficará indisponível (amarela) em todo o sistema imediatamente.</p>
              </div>

              <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <h4 className="text-xs font-black text-green-800 uppercase mb-2">Como encerrar e liberar?</h4>
                <p className="text-xs">No menu <strong>Manutenção</strong>, use o formulário de <strong>Baixa</strong>. Identifique o técnico e o serviço realizado. Ao salvar, a aeronave retorna automaticamente ao status "Disponível".</p>
              </div>

              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-red-600 shrink-0"/>
                 <p className="text-[10px] text-red-800 font-bold uppercase">Incidentes em Voo: Sempre anexe o log de voo (AirData) se a manutenção for decorrente de queda ou pane em operação.</p>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Transmissão de Vídeo</h3>
            
            <section className="space-y-2">
              <h4 className="text-sm font-black text-red-700 uppercase flex items-center gap-2"><Youtube className="w-4 h-4"/> Linkando o Drone</h4>
              <p className="text-xs">Ao criar uma missão, insira o link RTMP/Youtube/Twitch gerado pelo aplicativo de voo (DJI Pilot 2 / Autel Explorer). O sinal será retransmitido em tempo real para a <strong>Sala de Situação</strong>.</p>
            </section>
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Relatórios Técnicos</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border rounded-xl">
                <FileText className="w-6 h-6 text-red-700 mb-2"/>
                <p className="text-xs font-bold uppercase">Boletim ARP</p>
                <p className="text-[10px] text-slate-500 mt-1">Gera o documento final da missão com narrativa, horas de voo e mapa tático.</p>
              </div>
              <div className="p-4 bg-slate-50 border rounded-xl">
                <ShieldCheck className="w-6 h-6 text-blue-700 mb-2"/>
                <p className="text-xs font-bold uppercase">Termo de Cautela</p>
                <p className="text-[10px] text-slate-500 mt-1">Formaliza a custódia da aeronave para um militar específico, anexando lista de materiais.</p>
              </div>
              <div className="p-4 bg-slate-50 border rounded-xl">
                <Sun className="w-6 h-6 text-orange-500 mb-2"/>
                <p className="text-xs font-bold uppercase">Operação Verão</p>
                <p className="text-[10px] text-slate-500 mt-1">Estatísticas consolidadas de produtividade no litoral paranaense.</p>
              </div>
              <div className="p-4 bg-slate-50 border rounded-xl">
                <History className="w-6 h-6 text-slate-700 mb-2"/>
                <p className="text-xs font-bold uppercase">Auditoria</p>
                <p className="text-[10px] text-slate-500 mt-1">Rastreabilidade completa de quem alterou registros no sistema.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl h-[85vh] flex flex-col bg-white overflow-hidden shadow-2xl rounded-3xl border border-white/20">
        {/* Header */}
        <div className="bg-red-700 p-6 flex justify-between items-center shrink-0 border-b border-red-800 shadow-lg">
          <div className="flex items-center gap-4 text-white">
            <div className="bg-white/20 p-2 rounded-xl">
               <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-black text-2xl tracking-tighter uppercase leading-none">Central de Conhecimento</h2>
              <p className="text-[11px] font-bold text-red-100 opacity-80 uppercase tracking-[0.2em] mt-1.5">Ecossistema Operacional SYSARP v2.0</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white/10 rounded-full transition-all text-white hover:scale-110 active:scale-95"
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col p-4 gap-2 shrink-0 overflow-y-auto custom-scrollbar">
            {topics.map(topic => (
              <button
                key={topic.id}
                onClick={() => setActiveTopic(topic.id as TopicId)}
                className={`flex items-center justify-between p-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTopic === topic.id 
                  ? 'bg-white text-red-700 shadow-xl border-l-8 border-red-700 translate-x-2' 
                  : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <topic.icon className={`w-5 h-5 ${activeTopic === topic.id ? 'text-red-700' : 'text-slate-400'}`} />
                  {topic.label}
                </div>
                <ChevronRight className={`w-4 h-4 transition-all ${activeTopic === topic.id ? 'opacity-100 translate-x-1' : 'opacity-0'}`} />
              </button>
            ))}
          </div>

          {/* Content Pane */}
          <div className="flex-1 p-10 overflow-y-auto bg-white custom-scrollbar">
            {renderContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4">
          <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Em conformidade com a política de segurança soarp / ccb
          </div>
          <Button 
            onClick={onClose} 
            className="h-12 px-10 text-xs bg-slate-900 hover:bg-black text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-transform active:scale-95"
          >
            Concluir Leitura
          </Button>
        </div>
      </Card>
    </div>
  );
}
