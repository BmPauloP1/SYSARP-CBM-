import React, { useState, useEffect } from 'react';
import { cautelaService } from '../services/cautelaService';
import { base44 } from '../services/base44Client';
import { TermoCautela, TERMO_LEGAL_BASE } from '../types_cautela';
import { Pilot, Drone, SYSARP_LOGO } from '../types';
import { MaterialType } from '../types_inventory';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { FileText, Plus, ShieldCheck, Download, X, Search, Clock, CheckCircle, AlertTriangle, Printer, Trash2, RefreshCw } from 'lucide-react';

export default function CautelaManagement() {
  const [termos, setTermos] = useState<TermoCautela[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    drone_id: '',
    pilot_id: '',
    unidade_nome: '',
    patrimonio: '',
    data_inicio: new Date().toISOString().split('T')[0],
    tempo_indeterminado: true,
    tempo_dias: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [t, p, d, me] = await Promise.all([
        cautelaService.list(),
        base44.entities.Pilot.list(),
        base44.entities.Drone.list(),
        base44.auth.me()
      ]);
      setTermos(t);
      setPilots(p.filter(p => p.status === 'active'));
      setDrones(d);
      setCurrentUser(me);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await cautelaService.create(formData);
      setIsModalOpen(false);
      setFormData({
        drone_id: '',
        pilot_id: '',
        unidade_nome: '',
        patrimonio: '',
        data_inicio: new Date().toISOString().split('T')[0],
        tempo_indeterminado: true,
        tempo_dias: 0
      });
      loadData();
      alert("Termo de Cautela gerado com sucesso!");
    } catch (e) {
      alert("Erro ao gerar cautela. Verifique se o banco de dados foi atualizado via Scripts SQL.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja EXCLUIR permanentemente este termo de cautela?")) return;
    setLoading(true);
    try {
      await cautelaService.delete(id);
      loadData();
    } catch (e) {
      alert("Erro ao excluir termo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (termo: TermoCautela) => {
    if (!currentUser) return;
    if (!confirm("Ao clicar em OK, você assina eletronicamente este termo, declarando ciência e responsabilidade sobre os equipamentos.")) return;
    
    setLoading(true);
    try {
      await cautelaService.sign(termo.id, currentUser.full_name);
      loadData();
      alert("Termo assinado com sucesso!");
    } catch (e) {
      alert("Erro ao assinar.");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (type: MaterialType) => {
    const labels: Record<string, string> = {
        battery: 'BATERIAS',
        propeller: 'HÉLICES',
        controller: 'CONTROLES / RCS',
        payload: 'CARGAS PAGAS (CÂMERAS)',
        accessory: 'ACESSÓRIOS',
        component: 'COMPONENTES / PEÇAS'
    };
    return labels[type] || type.toUpperCase();
  };

  const handleDownloadPDF = async (termo: TermoCautela) => {
    try {
        const fullTermo = await cautelaService.getById(termo.id);
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // Cabeçalho
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("ESTADO DO PARANÁ", pageWidth/2, 15, { align: "center" });
        doc.text("CORPO DE BOMBEIROS MILITAR", pageWidth/2, 22, { align: "center" });
        doc.text("SOARP - SYSARP", pageWidth/2, 29, { align: "center" });

        doc.line(14, 35, pageWidth - 14, 35);

        // Título
        doc.setFontSize(14);
        doc.text("TERMO DE CAUTELA DE AERONAVE RPA", pageWidth/2, 50, { align: "center" });
        doc.setFontSize(10);
        doc.text(`ID Controle: ${termo.id.split('-')[0].toUpperCase()}`, pageWidth/2, 56, { align: "center" });

        // Identificação
        doc.setFont("helvetica", "bold");
        doc.text("1. IDENTIFICAÇÃO DO CAUTELADO", 14, 70);
        doc.setFont("helvetica", "normal");
        doc.text(`Militar: ${fullTermo.pilot?.full_name || 'N/A'}`, 14, 76);
        doc.text(`Unidade de Destino: ${fullTermo.unidade_nome}`, 14, 82);
        doc.text(`Data de Início: ${new Date(fullTermo.data_inicio).toLocaleDateString()}`, 14, 88);

        doc.setFont("helvetica", "bold");
        doc.text("2. IDENTIFICAÇÃO DA AERONAVE", 14, 100);
        doc.setFont("helvetica", "normal");
        doc.text(`Modelo: ${fullTermo.drone?.brand} ${fullTermo.drone?.model}`, 14, 106);
        doc.text(`Prefixo: ${fullTermo.drone?.prefix}`, 14, 112);
        doc.text(`Nº Série: ${fullTermo.drone?.serial_number}`, 14, 118);
        if (fullTermo.patrimonio) {
            doc.text(`Patrimônio: ${fullTermo.patrimonio}`, 14, 124);
        }

        // Corpo do Termo
        doc.setFont("helvetica", "bold");
        doc.text("3. TERMOS DE RESPONSABILIDADE", 14, 136);
        const splitText = doc.splitTextToSize(TERMO_LEGAL_BASE, pageWidth - 28);
        doc.setFont("helvetica", "normal");
        doc.text(splitText, 14, 142);

        // Assinatura
        let y = 210;
        if (termo.status === 'ASSINADA') {
            doc.setFont("helvetica", "bold");
            doc.text("ASSINADO ELETRONICAMENTE", pageWidth/2, y, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.text(`Por: ${termo.assinatura_eletronica}`, pageWidth/2, y + 6, { align: "center" });
            doc.text(`Em: ${new Date(termo.data_hora_assinatura!).toLocaleString()}`, pageWidth/2, y + 12, { align: "center" });
        } else {
            doc.line(pageWidth/2 - 40, y + 10, pageWidth/2 + 40, y + 10);
            doc.text("Assinatura do Militar", pageWidth/2, y + 16, { align: "center" });
        }

        // Anexo I - Relação por Categoria
        doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.text("ANEXO I - RELAÇÃO DE MATERIAIS E EQUIPAMENTOS", pageWidth/2, 20, { align: "center" });
        
        const grouped = (fullTermo.itens || []).reduce((acc: any, item) => {
            if (!acc[item.type]) acc[item.type] = [];
            acc[item.type].push(item);
            return acc;
        }, {});

        let nextY = 30;
        Object.keys(grouped).forEach(type => {
            const items = grouped[type];
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(getCategoryLabel(type as any), 14, nextY);
            nextY += 2;

            autoTable(doc, {
                startY: nextY,
                head: [['Qtd.', 'Descrição do Item', 'Nº de Série']],
                body: items.map((i: any) => [
                    i.quantity || 1,
                    i.name,
                    i.serial_number || 'N/A'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [41, 51, 61], fontSize: 9 },
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' },
                    2: { cellWidth: 40 }
                }
            });

            nextY = (doc as any).lastAutoTable.finalY + 8;
            if (nextY > 260) {
                doc.addPage();
                nextY = 20;
            }
        });

        doc.save(`Termo_Cautela_${termo.drone?.prefix}.pdf`);
    } catch (e) {
        console.error(e);
        alert("Erro ao gerar PDF.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Termos de Cautela
          </h1>
          <p className="text-sm text-slate-500">Gestão formal de custódia de aeronaves e equipamentos.</p>
        </div>
        {currentUser?.role === 'admin' && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Cautela
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {termos.map(termo => (
          <Card key={termo.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <Badge variant={termo.status === 'ASSINADA' ? 'success' : termo.status === 'ENCERRADA' ? 'default' : 'warning'}>
                {termo.status}
              </Badge>
              <div className="flex gap-1">
                 {currentUser?.role === 'admin' && (
                    <button onClick={() => handleDelete(termo.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors" title="Excluir Termo">
                       <Trash2 className="w-4 h-4" />
                    </button>
                 )}
                 <span className="text-[10px] text-slate-400 font-mono">#{termo.id.split('-')[0]}</span>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
               <h3 className="font-bold text-slate-800">{termo.drone?.prefix} - {termo.drone?.model}</h3>
               {termo.patrimonio && <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">Patrimônio: {termo.patrimonio}</p>}
               <div className="text-xs text-slate-600 space-y-1">
                  <p className="flex items-center gap-2"><Clock className="w-3 h-3" /> Início: {new Date(termo.data_inicio).toLocaleDateString()}</p>
                  <p className="flex items-center gap-2 font-semibold text-blue-700">
                    <FileText className="w-3 h-3" /> Detentor: {termo.pilot?.full_name}
                  </p>
                  <p className="font-medium text-slate-500 uppercase">{termo.unidade_nome}</p>
               </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
               <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDownloadPDF(termo)}>
                  <Printer className="w-3 h-3 mr-1" /> PDF
               </Button>
               
               {termo.status === 'GERADA' && termo.pilot_id === currentUser?.id && (
                  <Button size="sm" className="flex-1 bg-blue-600 text-white" onClick={() => handleSign(termo)}>
                     <ShieldCheck className="w-3 h-3 mr-1" /> Assinar
                  </Button>
               )}

               {currentUser?.role === 'admin' && termo.status !== 'ENCERRADA' && (
                  <div className="flex gap-2">
                     <Button size="sm" variant="outline" className="bg-slate-50 text-slate-600" title="Renovar/Encerrar" onClick={() => cautelaService.close(termo.id).then(loadData)}>
                        <X className="w-4 h-4" />
                     </Button>
                  </div>
               )}
            </div>
          </Card>
        ))}
        {termos.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-200">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma cautela registrada no sistema.</p>
            </div>
        )}
      </div>

      {/* Modal Nova Cautela */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 bg-white animate-fade-in shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Gerar Termo de Cautela</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Select label="Aeronave" required value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})}>
                    <option value="">Selecione...</option>
                    {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} ({d.model})</option>)}
                 </Select>

                 <Input label="Nº de Patrimônio (Opcional)" placeholder="Ex: 123456" value={formData.patrimonio} onChange={e => setFormData({...formData, patrimonio: e.target.value})} />
              </div>

              <Select label="Militar Detentor (Piloto)" required value={formData.pilot_id} onChange={e => setFormData({...formData, pilot_id: e.target.value})}>
                <option value="">Selecione...</option>
                {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>

              <Input label="Unidade de Destino" placeholder="Ex: 1º BBM / FT / GOST" required value={formData.unidade_nome} onChange={e => setFormData({...formData, unidade_nome: e.target.value})} />

              <div className="grid grid-cols-2 gap-4">
                <Input label="Data de Início" type="date" required value={formData.data_inicio} onChange={e => setFormData({...formData, data_inicio: e.target.value})} />
                <div className="flex items-end h-full pb-2">
                   <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={formData.tempo_indeterminado} onChange={e => setFormData({...formData, tempo_indeterminado: e.target.checked})} className="w-4 h-4" />
                      Prazo Indeterminado
                   </label>
                </div>
              </div>

              {!formData.tempo_indeterminado && (
                <Input label="Prazo em Dias" type="number" min="1" value={formData.tempo_dias} onChange={e => setFormData({...formData, tempo_dias: Number(e.target.value)})} />
              )}

              <div className="bg-slate-50 p-3 rounded text-[10px] text-slate-500 italic">
                Nota: O sistema incluirá automaticamente no Anexo I todos os componentes registrados no Almoxarifado vinculados a esta aeronave no momento da geração.
              </div>

              <div className="pt-4 flex gap-3">
                 <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                 <Button type="submit" className="flex-1" disabled={loading}>Gerar Termo</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}