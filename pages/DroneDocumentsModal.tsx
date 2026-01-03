
import React, { useState } from 'react';
import { base44 } from '../services/base44Client';
import { Drone, DroneDocument, SYSARP_LOGO } from '../types';
import { Card, Button } from '../components/ui_components';
import { X, FileText, Upload, Eye, Loader2, CheckCircle, AlertTriangle, Printer, Activity, Wrench, Box, Book, ShieldCheck, Trash2, Calendar } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';

interface DroneDocumentsModalProps {
  drone: Drone;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DroneDocumentsModal({ drone, onClose, onUpdate }: DroneDocumentsModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);

  // Função auxiliar para garantir que os dados sejam sempre um array de DroneDocument
  const ensureArray = (data: any): DroneDocument[] => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string' && data.startsWith('http')) {
      // Converte dado legado (string única) para o novo formato de array
      return [{
        name: 'Arquivo Migrado',
        url: data,
        uploaded_at: new Date().toISOString()
      }];
    }
    return [];
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, section: keyof NonNullable<Drone['documents']>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
        alert("Apenas arquivos PDF são permitidos.");
        return;
    }

    setUploadingSection(section);
    try {
        const { url } = await base44.integrations.Core.UploadFile({ file });
        
        const newDoc: DroneDocument = {
            name: file.name,
            url: url,
            uploaded_at: new Date().toISOString()
        };

        const currentDocs = drone.documents || {};
        // Usa ensureArray para garantir que estamos dando push em um array real
        const existingArray = ensureArray(currentDocs[section]);
        const updatedDocs = { ...currentDocs, [section]: [...existingArray, newDoc] };
        
        await base44.entities.Drone.update(drone.id, { documents: updatedDocs });
        onUpdate(); 
    } catch (err) {
        console.error(err);
        alert("Falha no upload.");
    } finally {
        setUploadingSection(null);
        if (e.target) e.target.value = ''; 
    }
  };

  const handleDeleteFile = async (section: keyof NonNullable<Drone['documents']>, fileUrl: string) => {
      if (!confirm("Deseja remover este arquivo permanentemente?")) return;

      try {
          const currentDocs = drone.documents || {};
          const existingArray = ensureArray(currentDocs[section]);
          const updatedArray = existingArray.filter(doc => doc.url !== fileUrl);
          const updatedDocs = { ...currentDocs, [section]: updatedArray };

          await base44.entities.Drone.update(drone.id, { documents: updatedDocs });
          onUpdate();
      } catch (e) {
          alert("Erro ao excluir arquivo.");
      }
  };

  // --- AUTOMATIC REPORTS LOGIC ---

  const handleGenerateFlightLogReport = async () => {
    setLoading(true);
    try {
        const logs = await base44.entities.FlightLog.filter({ drone_id: drone.id });
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        
        doc.text(`REGISTRO DE VOOS - ${drone.prefix}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Aeronave: ${drone.brand} ${drone.model} | Serial: ${drone.serial_number}`, 14, 22);

        const tableBody = logs.sort((a,b) => new Date(b.flight_date).getTime() - new Date(a.flight_date).getTime()).map(log => [
            new Date(log.flight_date).toLocaleDateString(),
            log.mission_type,
            `${log.flight_hours.toFixed(1)}h`,
            log.description || '-'
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Data', 'Natureza', 'Tempo', 'Observações']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] }
        });

        doc.save(`Registro_Voos_${drone.prefix.replace(/\s/g, '_')}.pdf`);
    } catch (e) {
        alert("Erro ao gerar relatório de voos.");
    } finally {
        setLoading(false);
    }
  };

  const handleGenerateMaintReport = async () => {
    setLoading(true);
    try {
        const maints = await base44.entities.Maintenance.filter({ drone_id: drone.id });
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();

        doc.text(`REGISTRO DE MANUTENÇÕES - ${drone.prefix}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Horas Totais: ${drone.total_flight_hours.toFixed(1)}h`, 14, 22);

        const tableBody = maints.sort((a,b) => new Date(b.maintenance_date).getTime() - new Date(a.maintenance_date).getTime()).map(m => [
            new Date(m.maintenance_date).toLocaleDateString(),
            m.maintenance_type.toUpperCase(),
            m.technician,
            m.description
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Data', 'Tipo', 'Responsável', 'Serviço Executado']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 51, 61] }
        });

        doc.save(`Registro_Manutencoes_${drone.prefix.replace(/\s/g, '_')}.pdf`);
    } catch (e) {
        alert("Erro ao gerar relatório de manutenção.");
    } finally {
        setLoading(false);
    }
  };

  const handleGenerateMaterialsReport = async () => {
      setLoading(true);
      try {
          const items = await inventoryService.getMaterialsByDrone(drone.id);
          const { default: jsPDF } = await import('jspdf');
          const { default: autoTable } = await import('jspdf-autotable');
          const doc = new jsPDF();

          doc.text(`CHECKLIST DE MATERIAIS - ${drone.prefix}`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Relação completa de ativos vinculados ao almoxarifado técnico.`, 14, 22);

          const tableBody = items.map(i => [
              i.name,
              i.quantity,
              i.serial_number || '-',
              i.status.toUpperCase()
          ]);

          autoTable(doc, {
              startY: 30,
              head: [['Item / Descrição', 'Qtd', 'Nº Série', 'Estado']],
              body: tableBody,
              theme: 'grid'
          });

          doc.save(`Checklist_Materiais_${drone.prefix.replace(/\s/g, '_')}.pdf`);
      } catch (e) {
          alert("Erro ao gerar checklist de materiais.");
      } finally {
          setLoading(false);
      }
  };

  const docSections = [
    { id: 'prefacio', label: 'Prefácio (A e B)', icon: FileText, files: ensureArray(drone.documents?.prefacio), manual: true },
    { id: 'checklist', label: 'Check List (C, D e E)', icon: CheckCircle, files: ensureArray(drone.documents?.checklist), manual: true },
    { id: 'importantes', label: 'Importantes (F, G e H)', icon: AlertTriangle, files: ensureArray(drone.documents?.importantes), manual: true },
    { id: 'aro', label: 'I - A.R.O. (Avaliação de Risco)', icon: ShieldCheck, auto: true, action: () => alert("Consulte os AROs nas operações vinculadas.") },
    { id: 'manual', label: 'J - Manual da Aeronave', icon: Book, files: ensureArray(drone.documents?.manual), manual: true },
    { id: 'voos', label: 'K - Registro de Voos', icon: Activity, auto: true, action: handleGenerateFlightLogReport },
    { id: 'manutencao', label: 'L - Registro de Manutenções', icon: Wrench, auto: true, action: handleGenerateMaintReport },
    { id: 'materiais', label: 'M - Checklist de Materiais', icon: Box, auto: true, action: handleGenerateMaterialsReport },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-[3000] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-red-600 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
             </div>
             <div>
                <h2 className="font-bold text-lg leading-tight">Pasta Digital da Aeronave</h2>
                <p className="text-xs text-slate-400">{drone.prefix} | {drone.brand} {drone.model}</p>
             </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded transition-colors"><X className="w-6 h-6"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
           {docSections.map((sec) => (
              <div key={sec.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                       <div className="p-2 rounded-lg bg-red-50 text-red-600">
                          <sec.icon className="w-5 h-5" />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-800 text-sm">{sec.label}</h4>
                          <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
                             {sec.auto ? 'SISTEMA' : `${sec.files?.length || 0} arquivo(s)`}
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center gap-2">
                       {sec.manual && (
                         <label className="cursor-pointer">
                            <input 
                               type="file" 
                               className="hidden" 
                               accept=".pdf" 
                               onChange={(e) => handleUpload(e, sec.id as any)} 
                               disabled={uploadingSection === sec.id}
                            />
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors" title="Fazer Upload">
                               {uploadingSection === sec.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                               <span>{uploadingSection === sec.id ? 'Subindo...' : 'Novo'}</span>
                            </div>
                         </label>
                       )}

                       {sec.auto && (
                         <button onClick={sec.action} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Gerar Relatório PDF">
                            <Printer className="w-4 h-4"/>
                         </button>
                       )}
                    </div>
                 </div>

                 {sec.manual && sec.files && sec.files.length > 0 && (
                    <div className="divide-y divide-slate-100">
                       {sec.files.map((file, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between p-3 pl-14 hover:bg-slate-50 transition-colors group">
                             <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate" title={file.name}>{file.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <Calendar className="w-2.5 h-2.5 text-slate-400"/>
                                   <span className="text-[9px] text-slate-400">{new Date(file.uploaded_at).toLocaleString()}</span>
                                </div>
                             </div>
                             <div className="flex items-center gap-1">
                                <a href={file.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                                   <Eye className="w-4 h-4"/>
                                </a>
                                <button onClick={() => handleDeleteFile(sec.id as any, file.url)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                   <Trash2 className="w-4 h-4"/>
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}

                 {sec.manual && (!sec.files || sec.files.length === 0) && (
                    <div className="p-4 text-center">
                       <p className="text-[11px] text-slate-400 italic">Nenhum arquivo carregado nesta seção.</p>
                    </div>
                 )}
              </div>
           ))}
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
           <p className="text-[10px] text-slate-400 italic mr-auto self-center">* Todos os arquivos são armazenados com segurança na nuvem SYSARP.</p>
           <Button onClick={onClose}>Fechar Pasta</Button>
        </div>
      </Card>
    </div>
  );
}
