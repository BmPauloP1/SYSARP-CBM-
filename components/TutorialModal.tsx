
import React, { useState } from 'react';
import { Card, Button } from './ui_components';
import { 
  X, BookOpen, Crosshair, Plane, 
  FileText, ShieldCheck, Zap, Globe, Camera, 
  ChevronRight, Info, AlertTriangle,
  Share2, Wrench, Box, Activity, Sun, Youtube, ClipboardCheck,
  LayoutGrid, Calendar
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
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Manual Operacional SYSARP</h3>
                <p className="text-sm text-slate-500">Fluxo técnico oficial para pilotos RPA do CBMPR.</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              O <strong>SYSARP</strong> é uma plataforma proprietária desenvolvida pelo Núcleo de Engenharia de Software da corporação. Este guia orienta o emprego correto da ferramenta para conformidade com o DECEA e ANAC.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-red-600 uppercase mb-2">Autenticação</p>
                <p className="text-xs">Uso exclusivo de e-mail institucional <strong>@cbm.pr.gov.br</strong>.</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Segurança</p>
                <p className="text-xs">Dados criptografados e hospedados em infraestrutura de governo.</p>
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
              <p className="text-xs">Acesse <strong>Operações</strong> > <strong>Nova Missão</strong>. Preencha os 10 itens obrigatórios do formulário sequencial. Localize o Ponto Zero (PC) para spawn imediato do vetor no mapa tático.</p>
            </section>
          </div>
        );

      case 'cco':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">CCO Tático (Nível 2)</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-white rounded-lg shadow-sm text-red-600"><LayoutGrid className="w-5 h-5"/></div>
                <div className="text-xs"><strong>Desenho de Perímetros:</strong> Setorize áreas de busca em tempo real com cálculo automático de área ($m^2$/ha).</div>
              </div>
              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600"><Globe className="w-5 h-5"/></div>
                <div className="text-xs"><strong>Camadas Externas:</strong> Importe arquivos .KML/KMZ diretamente do Google Earth para sobreposição tática.</div>
              </div>
            </div>
          </div>
        );

      case 'fleet':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Aeronaves & Ativos</h3>
            <section className="space-y-2">
              <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-green-600"/> Ciclo de Inspeção</h4>
              <p className="text-xs text-slate-500">Realize o checklist semanal para manter o status "Disponível". Aeronaves com inspeção vencida serão marcadas em vermelho.</p>
            </section>
          </div>
        );

      case 'maint':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Manutenção e TBO</h3>
            <p className="text-xs">O sistema rastreia o <strong>TBO (Time Between Overhaul)</strong> de 50 horas de voo, alertando quando a aeronave deve passar por revisão preventiva na oficina da corporação.</p>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Transmissão em Tempo Real</h3>
            <p className="text-xs">Vincule o link RTMP/Live da aeronave no formulário da missão para habilitar o monitoramento na Sala de Situação do CCC.</p>
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-5 animate-fade-in text-slate-700">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Documentação Oficial</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border rounded-xl">
                <FileText className="w-6 h-6 text-red-700 mb-2"/>
                <p className="text-xs font-bold uppercase">Boletim ARP</p>
                <p className="text-[10px] text-slate-500 mt-1">Gera o relatório final da missão com trilha GPS e narrativa.</p>
              </div>
              <div className="p-4 bg-slate-50 border rounded-xl">
                <ShieldCheck className="w-6 h-6 text-blue-700 mb-2"/>
                <p className="text-xs font-bold uppercase">Termo Cautela</p>
                <p className="text-[10px] text-slate-500 mt-1">Formaliza a custódia do equipamento por um militar.</p>
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
        <div className="bg-red-700 p-6 flex justify-between items-center shrink-0 border-b border-red-800 shadow-lg">
          <div className="flex items-center gap-4 text-white">
            <div className="bg-white/20 p-2 rounded-xl">
               <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-black text-2xl tracking-tighter uppercase leading-none">Central de Treinamento</h2>
              <p className="text-[11px] font-bold text-red-100 opacity-80 uppercase tracking-[0.2em] mt-1.5">Plataforma SYSARP CBMPR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all text-white"><X className="w-7 h-7" /></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col p-4 gap-2 shrink-0 overflow-y-auto custom-scrollbar">
            {topics.map(topic => (
              <button
                key={topic.id}
                onClick={() => setActiveTopic(topic.id as TopicId)}
                className={`flex items-center justify-between p-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTopic === topic.id 
                  ? 'bg-white text-red-700 shadow-xl border-l-8 border-red-700 translate-x-2' 
                  : 'text-slate-500 hover:bg-slate-200/50'
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

          <div className="flex-1 p-10 overflow-y-auto bg-white custom-scrollbar">
            {renderContent()}
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4">
          <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Segurança de Dados CBMPR
          </div>
          <Button onClick={onClose} className="h-12 px-10 text-xs bg-slate-900 hover:bg-black text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg">Concluir Tutorial</Button>
        </div>
      </Card>
    </div>
  );
}
