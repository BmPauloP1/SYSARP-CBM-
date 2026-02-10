import React from 'react';
import { Card, Button } from './ui_components';
import { X, Users, Award, Book, Shield, ExternalLink, Code2, Globe2, Scale } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[6000] flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white overflow-hidden shadow-2xl rounded-3xl border border-slate-200">
        {/* Header Estilizado */}
        <div className="bg-[#1e293b] p-8 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Shield className="w-40 h-40 text-white" />
          </div>
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-20 h-20 bg-red-700 rounded-2xl flex items-center justify-center shadow-2xl border border-red-500/30">
               <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696c235cd3c7dd9b211e6fa5/ef1f7eb49_9d6d0ab9-baa7-46f6-ad3c-0def22bac6e8.png" className="w-14 h-14 object-contain" alt="Logo" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">SYSARP v2.0</h2>
              <p className="text-blue-400 font-bold text-xs uppercase tracking-[0.3em] mt-2">Sistema de Gestão RPA - CBMPR</p>
            </div>
          </div>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* Equipe de Desenvolvimento */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <Code2 className="w-5 h-5 text-red-700" />
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Equipe de Desenvolvimento</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 group hover:border-red-200 transition-colors">
                <p className="text-red-700 font-black text-sm uppercase mb-3">Coordenador e Desenvolvedor</p>
                <h4 className="font-bold text-slate-900 text-lg leading-tight">Cap. QOBM Jackson Alexandre Machado</h4>
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-blue-600" /> 
                    Bacharel em Ciência da Computação (2019 - 2024)
                  </p>
                  <p className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-blue-600" /> 
                    Téc. em Análise e Desenvolvimento de Sistemas (2019 - 2022)
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 group hover:border-red-200 transition-colors">
                <p className="text-red-700 font-black text-sm uppercase mb-3">Desenvolvedor Full-Stack</p>
                <h4 className="font-bold text-slate-900 text-lg leading-tight">Cb. QPBM Paulo Roberto Pinheiro Faria</h4>
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-blue-600" /> 
                    Bacharel em Sistemas de Informação (2020 - 2024)
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Colaboração */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <Users className="w-5 h-5 text-red-700" />
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Colaboração e Apoio Tático</h3>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs font-bold text-slate-600 uppercase">
                <li className="flex items-center gap-2 italic">• Seção de Operações Aéreas (SOARP - CCB)</li>
                <li className="flex items-center gap-2 italic">• SOARP - EQUIPE DOCENTE</li>
                <li className="flex items-center gap-2 italic">• Grupo de Resgate Aéreo (GRAER)</li>
                <li className="flex items-center gap-2 italic">• Centro de Comando e Controle (CCC)</li>
                <li className="flex items-center gap-2 italic">• Comandos Regionais de Bombeiro Militar (CRBM)</li>
              </ul>
            </div>
          </section>

          {/* Referências Normativas */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <Scale className="w-5 h-5 text-red-700" />
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Referências e Normativas Aplicadas</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: "ICA 100-40 (DECEA)", desc: "Aeronaves não Tripuladas e o Acesso ao Espaço Aéreo Brasileiro." },
                { title: "RBAC-E nº 94 (ANAC)", desc: "Requisitos Gerais para Aeronaves Não Tripuladas de uso Civil." },
                { title: "MCA 100-11 (DECEA)", desc: "Gerenciamento do Risco de Segurança Operacional." },
                { title: "MCA 56-5 (DECEA)", desc: "Instruções e Normas sobre Aeronaves Não Tripuladas de Uso Público." },
                { title: "Portaria nº 2.451/GC3", desc: "Regras para emprego de RPAs em missões de Defesa e Segurança." },
                { title: "Diretrizes CBMPR", desc: "Procedimentos Operacionais Padrão para Emprego de RPAs." },
                { title: "ISO/IEC 27001", desc: "Padrões de Segurança da Informação adotados no desenvolvimento." }
              ].map((ref, i) => (
                <div key={i} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                  <Book className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase">{ref.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{ref.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4">
          <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Globe2 className="w-4 h-4 text-blue-500" />
            Desenvolvido integralmente no cbmpr para a sociedade paranaense
          </div>
          <Button 
            onClick={onClose} 
            className="h-11 px-10 bg-slate-900 hover:bg-black text-white font-black uppercase text-xs tracking-widest rounded-xl"
          >
            Fechar
          </Button>
        </div>
      </Card>
    </div>
  );
}
