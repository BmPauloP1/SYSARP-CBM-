import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "../services/base44Client";
// FIX: Import MISSION_COLORS from the central types file.
import { Operation, Pilot, Drone, MISSION_LABELS, MISSION_HIERARCHY, SYSARP_LOGO, AroAssessment, ORGANIZATION_CHART, MISSION_COLORS } from "../types";
import { Card, Input, Select, Button, Badge } from "../components/ui_components";
import { Filter, FileText, Download, CheckSquare, Search, Map as MapIcon, PieChart as PieIcon, Navigation, Trash2, AlertTriangle } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import L from "leaflet";

// Extended Operation type to include joined data for filtering
type ExtendedOperation = Operation & {
  pilot?: Pilot;
  drone?: Drone;
}

// FIX: Removed local MISSION_COLORS constant. It is now imported from types.ts.

// Gera chaves dinamicamente a partir do organograma atualizado
const ORGANIZATION_CHART_KEYS = Object.keys(ORGANIZATION_CHART);

// Helper para carregar imagem para o PDF
const getImageData = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (url.startsWith('data:')) {
      resolve(url);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error("Canvas context error"));
      }
    };
    img.onerror = (e) => {
      console.warn("Image load error fallback", e);
      resolve("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
    };
    img.src = url;
  });
};

// Componente auxiliar para corrigir renderização do mapa
const MapController = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map && map.getContainer()) {
        map.invalidateSize();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

export default function Reports() {
  const [operations, setOperations] = useState<ExtendedOperation[]>([]);
  const [filteredOps, setFilteredOps] = useState<ExtendedOperation[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]); // Added pilots state
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [missionType, setMissionType] = useState<string>("all");
  const [selectedCRBM, setSelectedCRBM] = useState<string>("all");
  const [selectedBBM, setSelectedBBM] = useState<string>(""); 
  const [selectedDroneId, setSelectedDroneId] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsData, pilotsData, dronesData, me] = await Promise.all([
        base44.entities.Operation.list('-start_time'),
        base44.entities.Pilot.list(),
        base44.entities.Drone.list(),
        base44.auth.me()
      ]);

      const extended: ExtendedOperation[] = opsData.map(op => ({
        ...op,
        pilot: pilotsData.find(p => p.id === op.pilot_id),
        drone: dronesData.find(d => d.id === op.drone_id)
      }));

      setOperations(extended);
      setFilteredOps(extended);
      setDrones(dronesData);
      setPilots(pilotsData); // Set pilots state
      setCurrentUser(me);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    let result = operations;

    if (dateStart) {
      result = result.filter(op => new Date(op.start_time) >= new Date(dateStart));
    }
    if (dateEnd) {
      const endDate = new Date(dateEnd);
      endDate.setDate(endDate.getDate() + 1);
      result = result.filter(op => new Date(op.start_time) < endDate);
    }

    if (missionType !== "all") {
      result = result.filter(op => op.mission_type === missionType);
    }

    if (selectedDroneId !== "all") {
      result = result.filter(op => op.drone_id === selectedDroneId);
    }

    if (selectedCRBM !== "all") {
      result = result.filter(op => op.pilot?.crbm === selectedCRBM);
    }

    if (selectedBBM.trim()) {
      const term = selectedBBM.toLowerCase();
      result = result.filter(op => op.pilot?.unit.toLowerCase().includes(term));
    }

    setFilteredOps(result);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredOps.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredOps.map(op => op.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    if (currentUser?.role !== 'admin') {
        alert("Apenas administradores podem excluir registros.");
        return;
    }

    if (!window.confirm(`ATENÇÃO: Tem certeza que deseja excluir ${selectedIds.size} operação(ões)?\n\nIsso apagará o histórico do Dashboard e dos Relatórios. Esta ação não pode ser desfeita.`)) {
        return;
    }

    setLoading(true);
    try {
        const idsArray = Array.from(selectedIds);
        await Promise.all(idsArray.map((id: string) => base44.entities.Operation.delete(id)));
        
        alert("Operações excluídas com sucesso.");
        setSelectedIds(new Set());
        loadData();
    } catch (e: any) {
        console.error("Delete error:", e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        alert(`Erro ao excluir: ${errorMsg}`);
    } finally {
        setLoading(false);
    }
  };

  const getMissionStats = () => {
    const stats: Record<string, number> = {};
    filteredOps.forEach(op => {
      stats[op.mission_type] = (stats[op.mission_type] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({
      name: MISSION_LABELS[name as keyof typeof MISSION_LABELS] || name,
      value,
      color: MISSION_COLORS[name] || "#ccc"
    }));
  };

  const getTotalHours = () => {
    return filteredOps.reduce((acc, op) => acc + (op.flight_hours || 0), 0).toFixed(1);
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      alert("Selecione pelo menos uma ocorrência para gerar o relatório.");
      return;
    }
    setGenerating(true);
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;

      // Usar modo retrato (portrait) para ficha técnica
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const logoData = await getImageData(SYSARP_LOGO);
      const selectedOpsList = filteredOps.filter(op => selectedIds.has(op.id));

      // Fetch details for multi-day operations (agora incluindo pilotos)
      const multiDayDetails: Record<string, { days: any[], assets: any[], pilots: any[] }> = {};
      
      await Promise.all(selectedOpsList.map(async (op) => {
          if (op.is_multi_day) {
              const days = await base44.entities.OperationDay.filter({ operation_id: op.id });
              days.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
              
              const dayAssetsMap: any[] = [];
              const dayPilotsMap: any[] = [];

              for(const d of days) {
                  const assets = await base44.entities.OperationDayAsset.filter({ operation_day_id: d.id });
                  dayAssetsMap.push({ dayId: d.id, assets });

                  const team = await base44.entities.OperationDayPilot.filter({ operation_day_id: d.id });
                  dayPilotsMap.push({ dayId: d.id, team });
              }
              multiDayDetails[op.id] = { days, assets: dayAssetsMap, pilots: dayPilotsMap };
          }
      }));

      for (let i = 0; i < selectedOpsList.length; i++) {
         if (i > 0) doc.addPage();
         
         const op = selectedOpsList[i];
         const pilot = op.pilot;
         const drone = op.drone;
         
         // --- HEADER (CABEÇALHO) ---
         doc.setFillColor(153, 27, 27); // Vermelho CBMPR
         doc.rect(0, 0, pageWidth, 25, 'F');
         try { doc.addImage(logoData, "PNG", 10, 2, 20, 20); } catch (e) {}
         doc.setTextColor(255, 255, 255);
         doc.setFont("helvetica", "bold");
         doc.setFontSize(14);
         doc.text("CORPO DE BOMBEIROS MILITAR DO PARANÁ", pageWidth / 2, 10, { align: "center" });
         doc.setFontSize(12);
         doc.text(`RELATÓRIO TÉCNICO OPERACIONAL - RPA`, pageWidth / 2, 18, { align: "center" });
         
         doc.setFontSize(9);
         doc.text(`Protocolo: ${op.occurrence_number}`, pageWidth - 10, 22, { align: "right" });

         let currentY = 35;

         // --- ESCOPO 1: RECURSOS (PILOTO E AERONAVE) ---
         doc.setTextColor(0, 0, 0);
         doc.setFontSize(11);
         doc.setFont("helvetica", "bold");
         doc.text("1. RECURSOS EMPREGADOS", 14, currentY);
         currentY += 5;

         autoTable(doc, {
            startY: currentY,
            head: [['Piloto em Comando', 'Código SARPAS', 'Aeronave (Modelo/Prefixo)']],
            body: [[
                pilot?.full_name || 'N/A',
                pilot?.sarpas_code || 'N/A',
                drone ? `${drone.model} (${drone.prefix})` : 'N/A'
            ]],
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3 }
         });
         currentY = (doc as any).lastAutoTable.finalY + 10;

         // --- ESCOPO 2: DADOS DA OCORRÊNCIA ---
         doc.setFont("helvetica", "bold");
         doc.text("2. DADOS DA OCORRÊNCIA", 14, currentY);
         currentY += 5;

         const nature = MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type;
         const subNature = op.sub_mission_type || 'Não especificado';
         
         autoTable(doc, {
            startY: currentY,
            head: [['Acionamento', 'Localização (Lat / Lon)', 'Natureza / Sub-Natureza', 'Raio (m)', 'Altura (m)']],
            body: [[
                `${new Date(op.start_time).toLocaleDateString()} ${new Date(op.start_time).toLocaleTimeString()}`,
                `${op.latitude.toFixed(5)}, ${op.longitude.toFixed(5)}`,
                `${nature}\n${subNature}`,
                op.radius?.toString() || '-',
                op.flight_altitude?.toString() || '-'
            ]],
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3, valign: 'middle' },
            columnStyles: { 2: { cellWidth: 60 } }
         });
         currentY = (doc as any).lastAutoTable.finalY + 10;

         // --- SEPARAÇÃO DE DESCRIÇÃO E CONCLUSÃO ---
         const fullDesc = op.description || '';
         const parts = fullDesc.split('[CONCLUSÃO]:');
         const mainDescription = parts[0].trim();
         const conclusion = parts.length > 1 ? parts[1].trim() : (op.status === 'completed' ? 'Operação encerrada sem notas adicionais.' : 'Operação em andamento.');

         // --- ESCOPO 3: DESCRITIVO DA OCORRÊNCIA ---
         doc.setFont("helvetica", "bold");
         doc.text("3. DESCRITIVO DA OCORRÊNCIA", 14, currentY);
         currentY += 5;

         const splitDesc = doc.splitTextToSize(mainDescription || "Sem descrição registrada.", pageWidth - 28);
         doc.setFont("helvetica", "normal");
         doc.setFontSize(10);
         doc.text(splitDesc, 14, currentY);
         currentY += (splitDesc.length * 5) + 10;

         // Check page break
         if (currentY > pageHeight - 40) { doc.addPage(); currentY = 20; }

         // --- ESCOPO 4: HISTÓRICO MULTI-DIAS (SE HOUVER) ---
         if (op.is_multi_day && multiDayDetails[op.id]) {
             doc.setFont("helvetica", "bold");
             doc.setFontSize(11);
             doc.text("4. HISTÓRICO OPERACIONAL (MULTI-DIAS)", 14, currentY);
             currentY += 5;

             const details = multiDayDetails[op.id];
             const dayRows = details.days.map((day: any) => {
                 // Assets
                 const dayAssets = details.assets.find((x: any) => x.dayId === day.id)?.assets || [];
                 const assetNames = dayAssets.map((a: any) => {
                     const d = drones.find(drone => drone.id === a.drone_id);
                     return d ? d.prefix : 'Drone';
                 }).join(', ');

                 // Team
                 const dayTeam = details.pilots.find((x: any) => x.dayId === day.id)?.team || [];
                 const teamNames = dayTeam.map((t: any) => {
                     const p = pilots.find(pi => pi.id === t.pilot_id);
                     return p ? p.full_name : 'N/A';
                 }).join(', ');

                 // Date format fix
                 const displayDate = new Date(day.date + 'T12:00:00').toLocaleDateString();

                 return [
                     displayDate,
                     day.progress_notes || '-',
                     assetNames || '-',
                     teamNames || '-'
                 ];
             });

             if (dayRows.length > 0) {
                 autoTable(doc, {
                    startY: currentY,
                    head: [['Data', 'Ações Realizadas', 'Aeronaves', 'Equipe']],
                    body: dayRows,
                    theme: 'grid',
                    headStyles: { fillColor: [220, 220, 220], textColor: 0 },
                    styles: { fontSize: 9, cellPadding: 2 },
                    columnStyles: { 
                        0: { cellWidth: 25 },
                        1: { cellWidth: 'auto' }, 
                        2: { cellWidth: 30 },
                        3: { cellWidth: 40 }
                    }
                 });
                 currentY = (doc as any).lastAutoTable.finalY + 10;
             } else {
                 doc.setFont("helvetica", "italic");
                 doc.setFontSize(9);
                 doc.text("Nenhum registro diário encontrado.", 14, currentY + 5);
                 currentY += 15;
             }
         }

         // Check page break again
         if (currentY > pageHeight - 40) { doc.addPage(); currentY = 20; }

         // --- ESCOPO 5: CONCLUSÃO / AÇÕES FINAIS ---
         doc.setFont("helvetica", "bold");
         doc.setFontSize(11);
         doc.text("5. AÇÕES DE ENCERRAMENTO E CONCLUSÃO", 14, currentY);
         currentY += 5;

         doc.setDrawColor(0);
         doc.setFillColor(245, 245, 245);
         doc.rect(14, currentY, pageWidth - 28, 25, 'F');
         doc.rect(14, currentY, pageWidth - 28, 25, 'S'); // Border

         const splitConclusion = doc.splitTextToSize(conclusion, pageWidth - 32);
         doc.setFont("helvetica", "normal");
         doc.setFontSize(10);
         doc.text(splitConclusion, 16, currentY + 6);
         
         // Footer
         doc.setFontSize(8);
         doc.setTextColor(150);
         const now = new Date().toLocaleString();
         doc.text(`Relatório gerado pelo SYSARP em ${now} - Página ${i + 1} de ${selectedOpsList.length}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      doc.save(`Ficha_Operacional_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadFlightPlan = async (op: ExtendedOperation, e: React.MouseEvent) => {
    // ... existing implementation
  };

  const handleDownloadAro = async (op: ExtendedOperation, e: React.MouseEvent) => {
    // ... existing implementation
  };

  const mapMarkers = useMemo(() => {
    const displayOps = filteredOps.slice(0, 1000);

    return displayOps.map(op => {
      const lat = Number(op.latitude);
      const lng = Number(op.longitude);
      if (isNaN(lat) || isNaN(lng)) return null;
      
      return (
        <CircleMarker 
          key={op.id}
          center={[lat, lng]}
          pathOptions={{ 
              color: MISSION_COLORS[op.mission_type] || 'gray',
              fillColor: MISSION_COLORS[op.mission_type] || 'gray',
              fillOpacity: 0.6,
              weight: 1
          }}
          radius={12}
        >
          <Popup>
              <div className="text-xs">
                <strong>{op.name}</strong><br/>
                {MISSION_HIERARCHY[op.mission_type]?.label}<br/>
                {op.sub_mission_type && <i>{op.sub_mission_type}<br/></i>}
                {new Date(op.start_time).toLocaleDateString()}
              </div>
          </Popup>
        </CircleMarker>
      );
    });
  }, [filteredOps]);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <FileText className="w-8 h-8 text-red-700" />
             Relatórios e Estatísticas
           </h1>
           <p className="text-slate-500 text-sm">Análise tática e geração de documentos operacionais.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: ANALYTICS & FILTERS */}
        <div className="lg:col-span-1 space-y-6">
           
           {/* STATS CARDS */}
           <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 bg-slate-800 text-white border-none">
                 <p className="text-xs text-slate-300 uppercase font-bold">Total Ocorrências</p>
                 <p className="text-2xl font-bold">{filteredOps.length}</p>
              </Card>
              <Card className="p-4 bg-red-900 text-white border-none">
                 <p className="text-xs text-red-200 uppercase font-bold">Horas de Voo</p>
                 <p className="text-2xl font-bold">{getTotalHours()}h</p>
              </Card>
           </div>

           {/* CHARTS */}
           <Card className="p-4 h-64 flex flex-col"> 
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2 shrink-0"> 
                 <PieIcon className="w-4 h-4" /> Distribuição por Missão
              </h3>
              <div className="flex-1 min-h-0"> 
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie
                         data={getMissionStats()}
                         cx="50%"
                         cy="50%"
                         innerRadius={40}
                         outerRadius={60}
                         paddingAngle={5}
                         dataKey="value"
                      >
                         {getMissionStats().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                   </PieChart>
                </ResponsiveContainer>
              </div>
           </Card>

           {/* FILTERS */}
           <Card className="p-4 border-t-4 border-t-red-600">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <Filter className="w-4 h-4" /> Filtros Avançados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-3">
                 <div className="col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1 grid grid-cols-2 gap-2">
                    <Input label="De" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="text-xs" />
                    <Input label="Até" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="text-xs" />
                 </div>
                 <Select label="CRBM (Regional)" value={selectedCRBM} onChange={e => setSelectedCRBM(e.target.value)} className="text-xs">
                    <option value="all">Todos os Comandos</option>
                    {ORGANIZATION_CHART_KEYS.map(crbm => <option key={crbm} value={crbm}>{crbm.split(' - ')[0]}</option>)}
                 </Select>
                 <Input 
                    label="Unidade / BBM" 
                    placeholder="Ex: 2º GB ou Umuarama" 
                    value={selectedBBM} 
                    onChange={e => setSelectedBBM(e.target.value)} 
                    className="text-xs"
                 />
                 <Select label="Tipo de Missão" value={missionType} onChange={e => setMissionType(e.target.value)} className="text-xs">
                    <option value="all">Todas</option>
                    {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                 </Select>
                 <Select label="Aeronave" value={selectedDroneId} onChange={e => setSelectedDroneId(e.target.value)} className="text-xs">
                    <option value="all">Todas as Aeronaves</option>
                    {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                 </Select>
                 <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-1 pt-2">
                    <Button onClick={handleSearch} className="w-full bg-slate-900 hover:bg-black h-9 text-xs">
                        <Search className="w-3.5 h-3.5 mr-2" /> Pesquisar
                    </Button>
                 </div>
              </div>
           </Card>
        </div>

        {/* RIGHT COLUMN: LIST & MAP */}
        <div className="lg:col-span-3 space-y-6">
           
           {/* TABLE CARD */}
           <Card className="overflow-hidden border-0 shadow-md">
              <div className="bg-slate-100 p-3 flex justify-between items-center border-b">
                 <div className="flex gap-2 items-center">
                    {selectedIds.size > 0 && (
                       <Badge variant="danger">{selectedIds.size} Selecionados</Badge>
                    )}
                    <span className="text-sm font-bold text-slate-700">Ocorrências Listadas</span>
                 </div>
                 <div className="flex gap-2">
                    {currentUser?.role === 'admin' && selectedIds.size > 0 && (
                        <Button 
                            onClick={handleDeleteSelected} 
                            disabled={loading}
                            className="h-8 text-xs bg-red-600 text-white hover:bg-red-700 border-red-700"
                        >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Excluir ({selectedIds.size})
                        </Button>
                    )}
                    <Button variant="outline" className="h-8 text-xs bg-white" onClick={toggleAll}>
                       {selectedIds.size === filteredOps.length && filteredOps.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </Button>
                    <Button onClick={handleExport} disabled={generating || selectedIds.size === 0} className="h-8 text-xs bg-slate-800 text-white hover:bg-slate-900">
                       <Download className="w-3 h-3 mr-2" />
                       {generating ? 'Gerando...' : 'Exportar Ficha Técnica'}
                    </Button>
                 </div>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                       <tr>
                          <th className="px-4 py-3 w-10 text-center"><CheckSquare className="w-4 h-4 text-slate-400 mx-auto" /></th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Ocorrência</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Local / Piloto</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Data</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Docs</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                       {filteredOps.map(op => (
                          <tr key={op.id} className={`hover:bg-red-50 cursor-pointer ${selectedIds.has(op.id) ? 'bg-red-50' : ''}`} onClick={() => toggleSelection(op.id)}>
                             <td className="px-4 py-3 text-center">
                                <div className={`w-4 h-4 rounded border mx-auto flex items-center justify-center ${selectedIds.has(op.id) ? 'bg-red-600 border-red-600 text-white' : 'border-slate-300'}`}>
                                   {selectedIds.has(op.id) && <CheckSquare className="w-3 h-3" />}
                                </div>
                             </td>
                             <td className="px-4 py-3">
                                <div className="font-bold text-slate-800 text-sm">{op.name}</div>
                                <div className="text-xs text-slate-500 font-mono">#{op.occurrence_number}</div>
                                <Badge variant="default" className="mt-1 text-[10px]">{MISSION_LABELS[op.mission_type]}</Badge>
                                {op.sub_mission_type && <span className="block text-[9px] text-slate-400 mt-0.5 ml-1">- {op.sub_mission_type}</span>}
                             </td>
                             <td className="px-4 py-3 text-xs text-slate-600">
                                <div className="font-semibold">{op.pilot?.unit || 'N/A'}</div>
                                <div className="text-slate-400">{op.pilot?.full_name}</div>
                             </td>
                             <td className="px-4 py-3 text-xs text-slate-600">
                                <div>{new Date(op.start_time).toLocaleDateString()}</div>
                                <div className="text-slate-400">{new Date(op.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                             </td>
                             <td className="px-4 py-3">
                                <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${op.status === 'active' ? 'text-green-700 bg-green-100' : 'text-slate-600 bg-slate-100'}`}>
                                   {op.status === 'active' ? 'Ativa' : 'Fim'}
                                </span>
                             </td>
                             <td className="px-4 py-3 text-xs">
                                <div className="flex items-center gap-2">
                                   {op.aro ? 
                                      <Badge className="bg-green-100 text-green-700">ARO OK</Badge> : 
                                      <Badge className="bg-amber-100 text-amber-700">ARO Pend.</Badge>
                                   }
                                   
                                   {op.flight_plan_data ? 
                                      <Badge className="bg-blue-100 text-blue-700">Plan OK</Badge> : 
                                      <span className="text-[10px] text-slate-400">Sem Plano</span>
                                   }

                                   <div className="flex gap-1 ml-1">
                                      {op.aro && (
                                          <Button 
                                            variant="outline" 
                                            className="h-6 w-6 p-0 border-slate-200" 
                                            title="Baixar A.R.O. (Documento Completo)"
                                            onClick={(e) => handleDownloadAro(op, e)}
                                          >
                                            <FileText className="w-3 h-3 text-green-600" />
                                          </Button>
                                      )}
                                      {op.flight_plan_data && (
                                          <Button 
                                            variant="outline" 
                                            className="h-6 w-6 p-0 border-slate-200" 
                                            title="Baixar Plano de Voo (Documento Completo)"
                                            onClick={(e) => handleDownloadFlightPlan(op, e)}
                                          >
                                            <Navigation className="w-3 h-3 text-blue-600" />
                                          </Button>
                                      )}
                                   </div>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </Card>

           {/* HEATMAP CARD */}
           <Card className="overflow-hidden border-0 shadow-md">
              <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                 <h3 className="font-bold text-sm flex items-center gap-2">
                    <MapIcon className="w-4 h-4" /> Mapa de Calor Operacional
                 </h3>
                 <span className="text-xs text-slate-400">Visualização Georreferenciada</span>
              </div>
              <div className="h-[500px] w-full relative z-0">
                 <MapContainer 
                    center={[-24.8, -51.5]} 
                    zoom={7} 
                    style={{ height: '100%', width: '100%' }}
                 >
                    <MapController />
                    <TileLayer
                       attribution='&copy; OpenStreetMap'
                       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {mapMarkers}
                 </MapContainer>
                 
                 {/* Map Legend */}
                 <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-2 rounded shadow-lg z-[400] text-[10px] grid grid-cols-2 gap-2">
                    {Object.entries(MISSION_LABELS).map(([key, label]) => (
                       <div key={key} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MISSION_COLORS[key] }}></div>
                          <span>{label}</span>
                       </div>
                    ))}
                 </div>
              </div>
           </Card>

        </div>
      </div>
    </div>
  );
}
