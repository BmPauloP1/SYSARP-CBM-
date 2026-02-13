import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { tacticalService } from "../services/tacticalService";
import { Operation, MISSION_HIERARCHY, Pilot, Drone, MISSION_COLORS, MISSION_LABELS, ORGANIZATION_CHART, SYSARP_LOGO, MissionType } from "../types";
import { Card, Button, Input, Select, Badge } from "../components/ui_components";
import { 
  FileText, Search, Calendar, Clock, Printer, RefreshCcw, 
  BarChart3, PieChart as PieIcon, Map as MapIcon, 
  Filter, ChevronDown, ChevronUp, Users, Plane, LayoutDashboard, 
  CheckSquare, Square, TrendingUp, Activity, MousePointer2, Crosshair,
  MapPin, Download, Table, LayoutGrid, CheckCircle2, Camera, Trash2
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';

const CHART_COLORS = ['#1e293b', '#b91c1c', '#334155', '#ef4444', '#475569', '#991b1b', '#64748b', '#cbd5e1'];

type ReportTab = 'stats' | 'heatmap' | 'specific' | 'mgmt';

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const formatArea = (m2: number) => {
    if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
    if (m2 > 0) return `${Math.round(m2).toLocaleString('pt-BR')} m²`;
    return "0 m²";
};

const formatFlightHours = (decimalHours: number = 0) => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}H VOADAS`;
};

const getImageData = (url: string): Promise<{data: string, ratio: number}> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) { 
        ctx.drawImage(img, 0, 0); 
        resolve({
          data: canvas.toDataURL('image/png'),
          ratio: img.width / img.height
        }); 
      }
      else resolve({data: "", ratio: 1});
    };
    img.onerror = () => resolve({data: "", ratio: 1});
    img.src = url;
  });
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('stats');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOpIds, setSelectedOpIds] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [filterCrbm, setFilterCrbm] = useState("all");
  const [filterNature, setFilterNature] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ops, pils, drns, me] = await Promise.all([
          base44.entities.Operation.list('-start_time'), 
          base44.entities.Pilot.list(), 
          base44.entities.Drone.list(),
          base44.auth.me()
      ]);
      setOperations(ops); setPilots(pils); setDrones(drns); setCurrentUser(me);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filteredOps = useMemo(() => {
    return operations.filter(op => {
      const matchCrbm = filterCrbm === "all" || op.op_crbm === filterCrbm;
      const matchNature = filterNature === "all" || op.mission_type === filterNature;
      let matchDate = true;
      if (dateStart) matchDate = matchDate && new Date(op.start_time) >= new Date(dateStart);
      if (dateEnd) matchDate = matchDate && new Date(op.start_time) <= new Date(dateEnd);
      return matchCrbm && matchNature && matchDate;
    });
  }, [operations, filterCrbm, filterNature, dateStart, dateEnd]);

  const statsData = useMemo(() => {
    const totalHours = filteredOps.reduce((acc, op) => acc + (op.flight_hours || 0), 0);
    const natureMap: Record<string, number> = {};
    filteredOps.forEach(op => {
      const label = MISSION_LABELS[op.mission_type] || op.mission_type;
      natureMap[label] = (natureMap[label] || 0) + 1;
    });
    const regionalMap: Record<string, number> = {};
    filteredOps.forEach(op => {
      if (op.op_crbm) {
        const shortLabel = op.op_crbm.split(' - ')[0];
        regionalMap[shortLabel] = (regionalMap[shortLabel] || 0) + (op.flight_hours || 0);
      }
    });
    const pilotMap: Record<string, number> = {};
    filteredOps.forEach(op => {
      const p = pilots.find(x => x.id === op.pilot_id);
      /* Fix: Convert name to uppercase here at the data level because textTransform is not a valid property for SVG ticks in Recharts */
      if (p) {
        const name = p.full_name.toUpperCase();
        pilotMap[name] = (pilotMap[name] || 0) + (op.flight_hours || 0);
      }
    });
    const fleetMap: Record<string, number> = {};
    filteredOps.forEach(op => {
      const d = drones.find(x => x.id === op.drone_id);
      /* Fix: Convert prefix to uppercase here for consistent labeling in charts */
      if (d) {
        const prefix = d.prefix.toUpperCase();
        fleetMap[prefix] = (fleetMap[prefix] || 0) + (op.flight_hours || 0);
      }
    });
    return { 
        totalHours, 
        natureData: Object.entries(natureMap).map(([name, value]) => ({ name, value })),
        regionalData: Object.entries(regionalMap).map(([name, value]) => ({ name, value })),
        pilotData: Object.entries(pilotMap).map(([name, value]) => ({ name, value: Number(value.toFixed(1)) })).sort((a,b) => b.value - a.value).slice(0, 10),
        fleetData: Object.entries(fleetMap).map(([name, value]) => ({ name, value: Number(value.toFixed(1)) })).sort((a,b) => b.value - a.value)
    };
  }, [filteredOps, pilots, drones]);

  const handleToggleSelect = (id: string) => {
      const newSet = new Set(selectedOpIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedOpIds(newSet);
  };

  /**
   * Added to fix 'Cannot find name handleDeleteOperations' error.
   * Handles batch deletion of selected operations.
   */
  const handleDeleteOperations = async () => {
    if (selectedOpIds.size === 0 || !currentUser || currentUser.role !== 'admin') return;

    if (window.confirm(`ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente ${selectedOpIds.size} registro(s)?\n\nEsta ação não pode ser desfeita.`)) {
      setLoading(true);
      try {
        /* Fix: Explicitly typed id as string to resolve TS unknown error on line 166 */
        const promises = Array.from(selectedOpIds).map((id: string) => base44.entities.Operation.delete(id));
        await Promise.all(promises);
        
        setSelectedOpIds(new Set());
        await loadData();
        alert("Registros excluídos com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir operações:", error);
        alert("Erro ao realizar a exclusão.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportBoletim = async () => {
    if (selectedOpIds.size === 0) return;
    setGeneratingPdf(true);
    try {
        // Fix for TypeScript error on line 166: using typed dynamic imports
        const jsPDFModule: any = await import('jspdf');
        const jsPDF = jsPDFModule.default || jsPDFModule;
        const autoTableModule: any = await import('jspdf-autotable');
        const autoTable = autoTableModule.default || autoTableModule;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const selectedOps = operations.filter(o => selectedOpIds.has(o.id));
        const logo = await getImageData(SYSARP_LOGO);

        for (let index = 0; index < selectedOps.length; index++) {
            const op = selectedOps[index];
            if (index > 0) doc.addPage();
            
            if (logo.data) {
                const logoWidth = 22; const logoHeight = logoWidth / logo.ratio;
                doc.addImage(logo.data, 'PNG', 14, 8, logoWidth, logoHeight);
            }

            doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
            doc.text("ESTADO DO PARANÁ", pageWidth / 2 + 10, 13, { align: "center" });
            doc.text("CORPO DE BOMBEIROS MILITAR", pageWidth / 2 + 10, 18, { align: "center" });
            doc.text("SOARP - SYSARP", pageWidth / 2 + 10, 23, { align: "center" });
            doc.setDrawColor(185, 28, 28); doc.setLineWidth(0.6); doc.line(14, 30, pageWidth - 14, 30);
            doc.setFontSize(14); doc.text("BOLETIM DE OCORRÊNCIA OPERACIONAL - RPA", pageWidth / 2, 42, { align: "center" });
            doc.setFontSize(9); doc.setFont("helvetica", "normal");
            doc.text(`Protocolo de Controle: ${op.occurrence_number}`, pageWidth / 2, 48, { align: "center" });

            doc.setFont("helvetica", "bold"); doc.text("1. IDENTIFICAÇÃO DA OCORRÊNCIA", 14, 62);
            autoTable(doc, {
                startY: 65,
                body: [["Título:", op.name.toUpperCase()], ["Natureza:", MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type], ["Data/Hora Início:", new Date(op.start_time).toLocaleString('pt-BR')], ["Coordenadas (PC):", `${op.latitude.toFixed(6)}, ${op.longitude.toFixed(6)}`], ["Unidade/Regional:", `${op.op_unit || 'N/A'} / ${op.op_crbm || 'N/A'}`]],
                theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
            });

            const pilot = pilots.find(p => p.id === op.pilot_id);
            const drone = drones.find(d => d.id === op.drone_id);
            let yAfter = Number((doc as any).lastAutoTable?.finalY || 120) + 10;
            
            doc.setFont("helvetica", "bold"); doc.text("2. EQUIPE E EQUIPAMENTO (VETOR)", 14, yAfter);
            autoTable(doc, {
                startY: yAfter + 3,
                body: [["Piloto em Comando (PIC):", pilot?.full_name || 'N/A'], ["Aeronave (Prefixo):", `${drone?.prefix || 'N/A'} (${drone?.model || 'N/A'})`], ["Tempo de Voo Realizado:", formatFlightHours(op.flight_hours || 0).replace('H VOADAS', ' horas')]],
                theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
            });

            yAfter = Number((doc as any).lastAutoTable?.finalY || yAfter + 40) + 10;

            if (op.is_multi_day) {
                const opDays = await base44.entities.OperationDay.filter({ operation_id: op.id });
                if (opDays.length > 0) {
                    doc.setFont("helvetica", "bold"); doc.text("HISTÓRICO MULTIDIAS", 14, yAfter);
                    const daysTable = [];
                    for (const day of opDays.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
                        const dayAssets = await base44.entities.OperationDayAsset.filter({ operation_day_id: day.id });
                        const assetPrefixes = dayAssets.map(a => drones.find(d => d.id === a.drone_id)?.prefix).filter(Boolean).join(', ');
                        daysTable.push([new Date(day.date + 'T12:00:00').toLocaleDateString(), assetPrefixes, day.weather_summary, day.progress_notes.substring(0, 100) + '...']);
                    }
                    autoTable(doc, {
                        startY: yAfter + 3,
                        head: [['Data', 'Drones Empregados', 'Clima', 'Resumo']],
                        body: daysTable, theme: 'grid', styles: { fontSize: 7 }
                    });
                    yAfter = (doc as any).lastAutoTable.finalY + 10;
                }
            }

            // Fix: Directly retrieve snapshot URL from operation data as getMapSnapshot is not implemented
            const snapshotUrl = op.shapes?.snapshot_url;
            if (snapshotUrl && yAfter + 100 < pageHeight) {
                const snapshotData = await getImageData(snapshotUrl);
                if (snapshotData.data) {
                    doc.setFont("helvetica", "bold"); doc.text("3. GEOPROCESSAMENTO TÁTICO", 14, yAfter);
                    doc.addImage(snapshotData.data, 'JPEG', 14, yAfter + 4, 182, 90); 
                    yAfter += 100;
                }
            }

            if (yAfter > pageHeight - 40) doc.addPage();
            doc.setFont("helvetica", "bold"); doc.text("4. RELATO OPERACIONAL", 14, yAfter || 20);
            const relato = `NARRATIVA:\n${op.description || 'Sem descrição.'}\n\nAÇÕES TOMADAS:\n${op.actions_taken || 'Nenhuma ação detalhada.'}`;
            const splitNarrative = doc.splitTextToSize(relato, pageWidth - 28);
            doc.setFont("helvetica", "normal"); doc.setFontSize(9);
            doc.text(splitNarrative, 14, (yAfter || 20) + 7);
            
            const footerY = pageHeight - 35;
            doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(14, footerY, pageWidth - 14, footerY);
            doc.setFontSize(8); doc.setTextColor(20, 80, 20); doc.text("DOCUMENTO ASSINADO ELETRONICAMENTE", pageWidth / 2, footerY + 8, { align: "center" });
            doc.setFontSize(7); doc.setTextColor(100, 100, 100); doc.text(`Emissor: ${currentUser?.full_name || 'SISARP'} em ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 13, { align: "center" });
        }
        doc.save(`BO_SYSARP_${new Date().getTime()}.pdf`);
    } catch (e) { console.error(e); alert("Erro ao exportar boletim."); } finally { setGeneratingPdf(false); }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden font-sans">
      <div className="bg-[#1e293b] px-4 pt-4 flex items-center justify-between shrink-0 shadow-lg border-b border-slate-700">
        <div className="flex gap-0.5">
            {[
                { id: 'stats', label: 'Estatístico', icon: BarChart3 },
                { id: 'heatmap', label: 'Mapa de Calor', icon: Activity },
                { id: 'specific', label: 'Específicos', icon: FileText },
                { id: 'mgmt', label: 'Gerenciais', icon: TrendingUp }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ReportTab)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-t-md text-xs font-bold uppercase tracking-wide transition-all ${
                        activeTab === tab.id 
                        ? 'bg-red-700 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      <div className="bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full px-6 py-2.5 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
          >
             <div className="flex items-center gap-3">
                <Filter className="w-3.5 h-3.5 text-red-700" />
                FILTROS ATIVOS
             </div>
             {isFilterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {isFilterOpen && (
              <div className="px-6 pb-6 pt-2 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in bg-slate-50 border-t border-slate-100">
                  <Select label="Regional" value={filterCrbm} onChange={e => setFilterCrbm(e.target.value)}>
                      <option value="all">Todas as Regionais</option>
                      {Object.keys(ORGANIZATION_CHART).map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select label="Natureza" value={filterNature} onChange={e => setFilterNature(e.target.value)}>
                      <option value="all">Todas as Naturezas</option>
                      {Object.entries(MISSION_HIERARCHY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                  <Input label="Data Inicial" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                  <Input label="Data Final" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
          )}
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
        {activeTab === 'stats' && (
            <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="p-6 border-l-[6px] border-l-slate-800 shadow-sm bg-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OPERAÇÕES</p>
                        <h3 className="text-3xl font-black text-slate-800 mt-1">{filteredOps.length}</h3>
                    </Card>
                    <Card className="p-6 border-l-[6px] border-l-blue-600 shadow-sm bg-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HORAS VOADAS</p>
                        <h3 className="text-3xl font-black text-slate-800 mt-1">{statsData.totalHours.toFixed(1)}h</h3>
                    </Card>
                    <Card className="p-6 border-l-[6px] border-l-slate-800 shadow-sm bg-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AERONAVES</p>
                        <h3 className="text-3xl font-black text-slate-800 mt-1">{drones.length}</h3>
                    </Card>
                    <Card className="p-6 border-l-[6px] border-l-green-600 shadow-sm bg-white">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EFETIVO</p>
                        <h3 className="text-3xl font-black text-slate-800 mt-1">{pilots.filter(p => p.status === 'active').length}</h3>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6 shadow-md bg-white border border-slate-200">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <LayoutGrid className="w-4 h-4 text-red-600"/> NATUREZA DAS MISSÕES
                        </h4>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={statsData.natureData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={5} stroke="none">
                                        {statsData.natureData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '9px', fontWeight: 700, textTransform: 'uppercase'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card className="p-6 shadow-md bg-white border border-slate-200">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <MapIcon className="w-4 h-4 text-red-600"/> EMPENHO POR REGIONAL
                        </h4>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statsData.regionalData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" hide />
                                    <YAxis tick={{fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#b91c1c" radius={[4, 4, 0, 0]} barSize={45} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        )}

        {activeTab === 'heatmap' && (
            <div className="h-full relative animate-fade-in">
                <MapContainer center={[-24.8, -51.5]} zoom={7} style={{ height: '100%', width: '100%' }}>
                    <MapResizer />
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    {filteredOps.map(op => (
                        <CircleMarker key={op.id} center={[op.latitude, op.longitude]} radius={8} pathOptions={{ color: MISSION_COLORS[op.mission_type] || '#ef4444', fillColor: MISSION_COLORS[op.mission_type] || '#ef4444', fillOpacity: 0.6 }}>
                            <Popup><div className="p-1 min-w-[200px] text-center"><p className="font-black text-slate-800 text-xs uppercase leading-tight">{op.name}</p><p className="text-[9px] text-slate-400 font-mono mt-1">#{op.occurrence_number}</p><p className="text-[9px] text-slate-500 font-bold mt-1 uppercase">{new Date(op.start_time).toLocaleDateString()}</p></div></Popup>
                        </CircleMarker>
                    ))}
                </MapContainer>
                <div className="absolute bottom-10 left-6 bg-white/95 backdrop-blur-md p-5 rounded-xl shadow-2xl z-[1000] border border-slate-200">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase mb-4 border-b pb-2 flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-red-600"/> LEGENDA DO CALOR</h5>
                    <div className="space-y-2.5">
                        {Object.entries(MISSION_LABELS).slice(0, 8).map(([key, label]) => (
                            <div key={key} className="flex items-center gap-3"><div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: MISSION_COLORS[key] }}></div><span className="text-[10px] font-bold text-slate-700 uppercase">{label.split('. ')[1] || label}</span></div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'specific' && (
            <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
                <div className="bg-slate-900 px-6 py-4 rounded-xl flex justify-between items-center text-white shadow-xl">
                   <div className="flex items-center gap-4"><button onClick={() => selectedOpIds.size === filteredOps.length ? setSelectedOpIds(new Set()) : setSelectedOpIds(new Set(filteredOps.map(o => o.id)))} className="flex items-center gap-2 hover:opacity-80 transition-opacity">{selectedOpIds.size === filteredOps.length && filteredOps.length > 0 ? <CheckSquare className="w-5 h-5 text-red-500"/> : <Square className="w-5 h-5 text-slate-400"/>}<span className="text-xs font-black uppercase tracking-widest">RESULTADOS FILTRADOS ({filteredOps.length})</span></button></div>
                   
                   <div className="flex items-center gap-4">
                       <Badge className="bg-red-900/50 text-red-200 border-red-800 font-black text-[9px] h-6 px-3">{selectedOpIds.size} SELECIONADOS</Badge>
                       {selectedOpIds.size > 0 && (
                           <div className="flex items-center gap-2">
                               {currentUser?.role === 'admin' && (
                                   <Button onClick={handleDeleteOperations} disabled={loading} className="bg-red-900 hover:bg-black text-white h-9 px-4 text-[10px] font-black uppercase tracking-widest shadow-lg">
                                       <Trash2 className="w-3.5 h-3.5 mr-2"/> EXCLUIR
                                   </Button>
                               )}
                               <Button onClick={handleExportBoletim} disabled={generatingPdf} className="bg-red-700 hover:bg-red-800 text-white h-9 px-6 text-[10px] font-black uppercase tracking-widest shadow-lg">
                                   <Printer className="w-3.5 h-3.5 mr-2"/> {generatingPdf ? 'PROCESSANDO...' : 'GERAR BOLETINS'}
                               </Button>
                           </div>
                       )}
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOps.map(op => (
                        <Card key={op.id} onClick={() => handleToggleSelect(op.id)} className={`p-4 border-2 transition-all cursor-pointer relative hover:shadow-lg ${selectedOpIds.has(op.id) ? 'border-blue-500 bg-blue-50/20' : 'border-white bg-white shadow-sm'}`}>
                            <div className="absolute top-4 right-4">{selectedOpIds.has(op.id) ? <CheckSquare className="w-5 h-5 text-blue-600"/> : <Square className="w-5 h-5 text-slate-200"/>}</div>
                            <div className="pr-8 mb-4"><h4 className="font-black text-slate-800 text-sm uppercase leading-tight truncate">{op.name}</h4><p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">#{op.occurrence_number}</p></div>
                            <div className="flex gap-2 mb-6"><Badge className="bg-slate-100 text-slate-600 text-[9px] font-black border-none uppercase">{MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type}</Badge><Badge variant={op.status === 'completed' ? 'success' : 'warning'} className="text-[9px] font-black uppercase">{op.status === 'active' ? 'ACTIVE' : op.status.toUpperCase()}</Badge></div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-slate-400"><div className="flex items-center gap-1.5 font-bold text-[10px]"><Calendar className="w-3.5 h-3.5"/> {new Date(op.start_time).toLocaleDateString('pt-BR')}</div><div className="flex items-center gap-1.5 font-mono text-[10px] font-black text-slate-500"><Clock className="w-3.5 h-3.5"/> {formatFlightHours(op.flight_hours || 0)}</div></div>
                        </Card>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'mgmt' && (
            <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="p-8 shadow-md bg-white border border-slate-100">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-10 flex items-center gap-3"><Users className="w-5 h-5 text-red-700"/> PRODUTIVIDADE: HORAS POR PILOTO (TOP 10)</h4>
                        <div className="h-[500px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={statsData.pilotData} layout="vertical" margin={{ left: 60, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" /><XAxis type="number" tick={{fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} /><YAxis dataKey="name" type="category" width={140} tick={{fontSize: 9, fontWeight: 700, fill: '#475569'}} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#1e293b" radius={[0, 8, 8, 0]} barSize={24} /></BarChart></ResponsiveContainer></div>
                    </Card>
                    <Card className="p-8 shadow-md bg-white border border-slate-100">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-10 flex items-center gap-3"><Plane className="w-5 h-5 text-red-700"/> EMPREGO DA FROTA: HORAS POR RPA</h4>
                        <div className="h-[500px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={statsData.fleetData} margin={{ bottom: 30 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} /><YAxis tick={{fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#b91c1c" radius={[6, 6, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div>
                    </Card>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
