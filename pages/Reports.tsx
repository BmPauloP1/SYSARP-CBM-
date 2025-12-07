
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "../services/base44Client";
import { Operation, Pilot, Drone, MISSION_LABELS, MISSION_HIERARCHY, SYSARP_LOGO, AroAssessment } from "../types";
import { Card, Input, Select, Button, Badge } from "../components/ui_components";
import { Filter, FileText, Download, CheckSquare, Search, Map as MapIcon, PieChart as PieIcon, Navigation } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import L from "leaflet";

// Extended Operation type to include joined data for filtering
type ExtendedOperation = Operation & {
  pilot?: Pilot;
  drone?: Drone;
}

// Colors for Map and Charts
const MISSION_COLORS: Record<string, string> = {
  fire: "#ef4444",             // Red (Incêndios)
  sar: "#3b82f6",              // Blue (SAR)
  aph: "#f43f5e",              // Rose (APH)
  traffic_accident: "#f97316", // Orange (Trânsito)
  hazmat: "#eab308",           // Yellow/Lime (Hazmat)
  natural_disaster: "#64748b", // Slate (Desastres)
  public_security: "#1e3a8a",  // Dark Blue (Segurança Pública)
  inspection: "#14b8a6",       // Teal (Inspeção)
  air_support: "#0ea5e9",      // Sky Blue (Apoio Aéreo)
  maritime: "#06b6d4",         // Cyan (Marítimo)
  environmental: "#22c55e",    // Green (Ambiental)
  training: "#8b5cf6",         // Violet (Treinamento)
  admin_support: "#94a3b8",    // Gray (Admin)
  diverse: "#71717a"           // Zinc (Diversos)
};

const ORGANIZATION_CHART_KEYS = [
  "1º CRBM - Curitiba (Leste/Litoral)",
  "2º CRBM - Londrina (Norte)",
  "3º CRBM - Cascavel (Oeste)",
  "4º CRBM - Maringá (Noroeste)",
  "5º CRBM - Ponta Grossa (Campos Gerais)"
];

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
    const [opsData, pilotsData, dronesData] = await Promise.all([
      base44.entities.Operation.list('-start_time'),
      base44.entities.Pilot.list(),
      base44.entities.Drone.list()
    ]);

    const extended: ExtendedOperation[] = opsData.map(op => ({
      ...op,
      pilot: pilotsData.find(p => p.id === op.pilot_id),
      drone: dronesData.find(d => d.id === op.drone_id)
    }));

    setOperations(extended);
    setFilteredOps(extended);
    setDrones(dronesData);
    setLoading(false);
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

      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const generationDate = new Date().toLocaleString('pt-BR');
      const selectedOpsList = filteredOps.filter(op => selectedIds.has(op.id));
      
      const logoData = await getImageData(SYSARP_LOGO);

      const drawHeader = (data: any) => {
         doc.setFillColor(153, 27, 27);
         doc.rect(0, 0, pageWidth, 25, 'F');
         
         try {
            doc.addImage(logoData, "PNG", 10, 2, 20, 20);
         } catch (e) { console.warn("Logo error", e); }

         doc.setTextColor(255, 255, 255);
         doc.setFontSize(14);
         doc.setFont("helvetica", "bold");
         doc.text("CORPO DE BOMBEIROS MILITAR DO PARANÁ", pageWidth / 2, 10, { align: "center" });
         doc.setFontSize(10);
         doc.text("RELATÓRIO DE OCORRÊNCIAS COM DRONES", pageWidth / 2, 18, { align: "center" });
         
         doc.setFontSize(8);
         doc.text(`Gerado em: ${generationDate}`, pageWidth - 10, 22, { align: "right" });
      };

      const tableBody = selectedOpsList.map(op => {
         const nature = MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type;
         const subNature = op.sub_mission_type || '';
         const pilot = op.pilot?.full_name || 'N/A';
         const drone = op.drone?.prefix || 'N/A';
         const status = op.status === 'active' ? 'Ativa' : 'Encerrada';
         const aro = op.aro ? 'SIM' : 'NÃO';
         const plan = op.flight_plan_data ? 'SIM' : 'NÃO';
         const coords = `${op.latitude.toFixed(4)}, ${op.longitude.toFixed(4)}`;
         
         return [
            op.occurrence_number,
            `${new Date(op.start_time).toLocaleDateString()}\n${new Date(op.start_time).toLocaleTimeString().slice(0,5)}`,
            `${nature}\n${subNature}`,
            `${pilot}\n${drone}`,
            `${coords}`,
            `${op.flight_hours || 0}h\n${status}`,
            `ARO: ${aro}\nPlan: ${plan}`,
            `${op.name}\n${op.description || ''}`
         ];
      });

      autoTable(doc, {
         startY: 30,
         head: [['Ocorrência', 'Data/Hora', 'Natureza', 'Piloto/Aeronave', 'Local (Lat/Lon)', 'Tempo/Status', 'Docs (Feito?)', 'Descrição']],
         body: tableBody,
         theme: 'grid',
         headStyles: { 
            fillColor: [60, 60, 60], 
            textColor: 255, 
            fontSize: 9, 
            fontStyle: 'bold',
            halign: 'center'
         },
         styles: { 
            fontSize: 8, 
            cellPadding: 3, 
            overflow: 'linebreak', 
            valign: 'middle' 
         },
         columnStyles: {
            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 35 },
            3: { cellWidth: 35 },
            4: { cellWidth: 30, fontStyle: 'italic', halign: 'center' },
            5: { cellWidth: 20, halign: 'center' },
            6: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
            7: { cellWidth: 'auto' }
         },
         didDrawPage: drawHeader,
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: "center" });
      }

      doc.save(`SYSARP_Relatorio_Geral_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadFlightPlan = async (op: ExtendedOperation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!op.flight_plan_data) return;

    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      
      const formData = JSON.parse(op.flight_plan_data);
      const doc = new jsPDF();
      
      const pilotName = op.pilot?.full_name || formData.pilot_id;
      const droneName = op.drone?.prefix || formData.drone_id;

      doc.setFillColor(200, 200, 200);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("PLANO DE VOO / NOTIFICAÇÃO", 105, 12, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      let y = 30;
      const lineHeight = 7;

      doc.setFont("helvetica", "bold");
      doc.text("1. IDENTIFICAÇÃO", 14, y);
      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text(`Identificação (Callsign/SISANT): ${formData.callsign || droneName}`, 14, y);
      
      if (formData.operation_mode) {
         doc.text(`Modo de Operação: ${formData.operation_mode}`, 110, y);
      } else {
         doc.text(`Regras de Voo: ${formData.flight_rules || 'VFR'}`, 110, y);
      }
      
      y += lineHeight;
      doc.text(`Tipo de Aeronave: ${formData.aircraft_type || "RPA"}`, 14, y);
      
      y += lineHeight * 2;

      doc.setFont("helvetica", "bold");
      doc.text("2. DADOS DO VOO", 14, y);
      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text(`Aeródromo de Partida: ${formData.departure_aerodrome}`, 14, y);
      doc.text(`Hora (EOBT): ${formData.departure_time || "0000"}`, 110, y);
      y += lineHeight;
      doc.text(`Velocidade de Cruzeiro: ${formData.cruising_speed}`, 14, y);
      
      if (formData.max_altitude_agl) {
          doc.text(`Alt. Máxima AGL: ${formData.max_altitude_agl}m`, 110, y);
          y += lineHeight;
          doc.text(`Alt. Mínima AGL: ${formData.min_altitude_agl}m`, 110, y);
      } else {
          doc.text(`Nível: ${formData.level || "-"}`, 110, y);
      }

      doc.text(`Rota: ${formData.route}`, 14, y);
      y += lineHeight;
      doc.text(`Aeródromo de Destino: ${formData.destination_aerodrome}`, 14, y);
      doc.text(`EET Total: ${formData.total_eet || "0030"}`, 110, y);
      y += lineHeight;
      doc.text(`Alt. Aeródromo: ${formData.altn_aerodrome || "NIL"}`, 14, y);

      y += lineHeight * 2;

      doc.setFont("helvetica", "bold");
      doc.text("3. OUTRAS INFORMAÇÕES (RMK)", 14, y);
      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text(`${formData.remarks}`, 14, y);
      y += lineHeight;
      
      const enduranceLabel = formData.max_altitude_agl ? "Autonomia Útil (min)" : "Autonomia";
      doc.text(`${enduranceLabel}: ${formData.endurance || "0"}`, 14, y);
      
      doc.text(`Pessoas a Bordo: ${formData.persons_on_board}`, 110, y);

      y += lineHeight * 2;

      doc.setFont("helvetica", "bold");
      doc.text("4. PILOTO EM COMANDO", 14, y);
      y += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.text(`Nome: ${pilotName}`, 14, y);
      
      y = 280;
      doc.setFontSize(8);
      doc.text("Cópia de Arquivo SYSARP.", 105, y, { align: "center" });

      doc.save(`PlanoVoo_${op.occurrence_number}.pdf`);

    } catch (err) {
      console.error("PDF regen error", err);
      alert("Erro ao regenerar PDF.");
    }
  };

  const handleDownloadAro = async (op: ExtendedOperation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!op.aro) return;

    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      const logoData = await getImageData(SYSARP_LOGO);
      
      try {
        doc.addImage(logoData, "PNG", 14, 10, 20, 20); 
      } catch(e) { console.warn("Logo add error", e); }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SECRETARIA DE ESTADO DA SEGURANÇA PÚBLICA", 40, 15);
      doc.text("CORPO DE BOMBEIROS MILITAR DO PARANÁ", 40, 20);
      doc.text("ARP CÂMARA TÉCNICA", 40, 25);
      
      doc.setFontSize(16);
      doc.text("AVALIAÇÃO DE RISCO OPERACIONAL", pageWidth/2, 45, {align: "center"});

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Data de Emissão: ${new Date(op.aro.created_at).toLocaleString()}`, pageWidth / 2, 52, {align: "center"});

      doc.setFont("helvetica", "bold");
      const droneInfo = `Aeronave: ${op.drone?.prefix || 'N/A'} - SISANT: ${op.drone?.sisant || 'N/A'} - Modelo: ${op.drone?.model || 'N/A'}`;
      doc.text(droneInfo, 14, 65);
      doc.text(`Ocorrência: ${op.occurrence_number}`, 14, 71);
      doc.text(`Piloto: ${op.pilot?.full_name || 'N/A'}`, 14, 77);

      autoTable(doc, {
        startY: 85,
        head: [['Situação', 'Prob.', 'Sev.', 'Risco', 'Aut. Nível', 'Mitigação']],
        body: op.aro.items.map(item => [
          item.description,
          item.scenario_id === 8 ? '-' : item.probability,
          item.scenario_id === 8 ? '-' : item.severity,
          item.scenario_id === 8 ? 'PROIBIDO' : item.risk_code,
          item.authorization_level || '-',
          item.mitigation || '-'
        ]),
        headStyles: { fillColor: [153, 27, 27] },
        theme: 'grid',
        styles: { fontSize: 8 }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(9);
      doc.text("Declaro para os devidos fins que conheço e cumpro as legislações e regulamentações aplicáveis, em especial as listadas neste documento, assim como conheço as consequências do seu descumprimento.", 14, currentY, { maxWidth: pageWidth - 28 });
      
      currentY += 20;
      doc.text("________________________________________________", 14, currentY);
      doc.text(`Rúbrica: ${op.aro.rubric}`, 14, currentY + 5);

      doc.save(`ARO_${op.occurrence_number}.pdf`);

    } catch (e) {
      console.error(e);
      alert("Erro ao gerar ARO");
    }
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
                    <Button variant="outline" className="h-8 text-xs bg-white" onClick={toggleAll}>
                       {selectedIds.size === filteredOps.length && filteredOps.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </Button>
                    <Button onClick={handleExport} disabled={generating || selectedIds.size === 0} className="h-8 text-xs bg-red-700 text-white hover:bg-red-800">
                       <Download className="w-3 h-3 mr-2" />
                       {generating ? 'Gerando...' : 'Exportar PDF'}
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
