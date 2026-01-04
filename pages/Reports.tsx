
import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { Operation, MISSION_HIERARCHY, MISSION_COLORS, MissionType, ORGANIZATION_CHART, Pilot, Drone, SYSARP_LOGO } from "../types";
import { Card, Button, Input, Select, Badge } from "../components/ui_components";
import { 
  FileText, Download, Filter, Search, Calendar, Map as MapIcon, 
  RefreshCcw, BarChart3, PieChart as PieChartIcon, LayoutGrid, 
  TrendingUp, Users, Plane, ClipboardList, ChevronDown, Activity,
  CheckSquare, Square, FileSignature, Printer, Info, Shield, Clock, Flame
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';

const CHART_COLORS = ['#b91c1c', '#1e293b', '#475569', '#94a3b8', '#dc2626', '#f87171'];

const isValidCoord = (lat: any, lng: any) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
};

// Função para dispersar pontos sobrepostos (Cria o efeito de mancha/calor)
const jitter = (coord: number) => coord + (Math.random() - 0.5) * 0.012;

// Componente para forçar o mapa a atualizar o tamanho quando a aba muda
const MapController = ({ activeTab }: { activeTab: string }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map) {
        map.invalidateSize({ animate: true });
      }
    }, 400); 
    return () => clearTimeout(timer);
  }, [map, activeTab]);
  return null;
};

type ReportTab = 'statistical' | 'heatmap' | 'specific' | 'managerial';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('statistical');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  
  // State para seleção múltipla
  const [selectedOpIds, setSelectedOpIds] = useState<Set<string>>(new Set());

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMission, setFilterMission] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ops, pils, drns] = await Promise.all([
        base44.entities.Operation.list("-created_at"),
        base44.entities.Pilot.list(),
        base44.entities.Drone.list()
      ]);
      setOperations(ops);
      setPilots(pils);
      setDrones(drns);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredOps = useMemo(() => {
    return operations.filter(op => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = op.name.toLowerCase().includes(searchLower) || 
                           op.occurrence_number.toLowerCase().includes(searchLower);
      const matchesMission = filterMission === "all" || op.mission_type === filterMission;
      const matchesStatus = filterStatus === "all" || op.status === filterStatus;
      
      let matchesDate = true;
      if (dateStart) matchesDate = matchesDate && new Date(op.start_time) >= new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setDate(end.getDate() + 1);
        matchesDate = matchesDate && new Date(op.start_time) < end;
      }
      return matchesSearch && matchesMission && matchesStatus && matchesDate;
    });
  }, [operations, searchTerm, filterMission, filterStatus, dateStart, dateEnd]);

  const missionsInView = useMemo(() => {
    return Array.from(new Set(filteredOps.map(op => op.mission_type)));
  }, [filteredOps]);

  const toggleSelectOp = (id: string) => {
    const newSelection = new Set(selectedOpIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedOpIds(newSelection);
  };

  const selectAllFiltered = () => {
    if (selectedOpIds.size === filteredOps.length && filteredOps.length > 0) {
        setSelectedOpIds(new Set());
    } else {
        setSelectedOpIds(new Set(filteredOps.map(o => o.id)));
    }
  };

  // Agregações Estatísticas
  const statsData = useMemo(() => {
    const missionCounts: Record<string, number> = {};
    const regionalCounts: Record<string, number> = {};
    let totalHours = 0;

    filteredOps.forEach(op => {
        const label = MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type;
        missionCounts[label] = (missionCounts[label] || 0) + 1;
        const regional = op.op_crbm || "Não Informado";
        regionalCounts[regional] = (regionalCounts[regional] || 0) + 1;
        totalHours += (op.flight_hours || 0);
    });

    const missionChart = Object.entries(missionCounts).map(([name, value]) => ({ name, value }));
    const regionalChart = Object.entries(regionalCounts).map(([name, value]) => ({ name, value }));

    return { missionChart, regionalChart, totalHours };
  }, [filteredOps]);

  const managerialData = useMemo(() => {
    const pilotHours: Record<string, number> = {};
    const droneHours: Record<string, number> = {};
    filteredOps.forEach(op => {
        if (op.pilot_id) {
            const p = pilots.find(x => x.id === op.pilot_id);
            const name = p?.full_name || "Desconhecido";
            pilotHours[name] = (pilotHours[name] || 0) + (op.flight_hours || 0);
        }
        if (op.drone_id) {
            const d = drones.find(x => x.id === op.drone_id);
            const prefix = d?.prefix || "N/A";
            droneHours[prefix] = (droneHours[prefix] || 0) + (op.flight_hours || 0);
        }
    });
    const pilotRanking = Object.entries(pilotHours).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours).slice(0, 10);
    const droneUsage = Object.entries(droneHours).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours);
    return { pilotRanking, droneUsage };
  }, [filteredOps, pilots, drones]);

  // --- GERAÇÃO DE BOLETIM DE OCORRÊNCIA FORMAL ---
  const handleExportBoletim = async () => {
    if (selectedOpIds.size === 0) return;
    setGeneratingPdf(true);
    try {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        const selectedOps = operations.filter(o => selectedOpIds.has(o.id));

        selectedOps.forEach((op, index) => {
            if (index > 0) doc.addPage();
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("ESTADO DO PARANÁ", pageWidth / 2, 15, { align: "center" });
            doc.text("CORPO DE BOMBEIROS MILITAR", pageWidth / 2, 20, { align: "center" });
            doc.text("SOARP - SISTEMA DE GESTÃO DE RPA (SYSARP)", pageWidth / 2, 25, { align: "center" });
            doc.line(14, 28, pageWidth - 14, 28);
            doc.setFontSize(14);
            doc.text("BOLETIM DE OCORRÊNCIA OPERACIONAL - RPA", pageWidth / 2, 40, { align: "center" });
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Protocolo: ${op.occurrence_number}`, pageWidth / 2, 46, { align: "center" });
            doc.setFont("helvetica", "bold");
            doc.text("1. IDENTIFICAÇÃO DA OCORRÊNCIA", 14, 60);
            autoTable(doc, {
                startY: 63,
                body: [
                    ["Título:", op.name.toUpperCase()],
                    ["Natureza:", MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type],
                    ["Data/Hora Início:", new Date(op.start_time).toLocaleString()],
                    ["Coordenadas:", `${op.latitude}, ${op.longitude}`],
                    ["Unidade/Regional:", `${op.op_unit || 'N/A'} / ${op.op_crbm || 'N/A'}`]
                ],
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
            });
            const pilot = pilots.find(p => p.id === op.pilot_id);
            const drone = drones.find(d => d.id === op.drone_id);
            const yAfterId = (doc as any).lastAutoTable.finalY + 10;
            doc.setFont("helvetica", "bold");
            doc.text("2. EQUIPE E EQUIPAMENTO", 14, yAfterId);
            autoTable(doc, {
                startY: yAfterId + 3,
                body: [
                    ["Piloto em Comando:", pilot?.full_name || 'N/A'],
                    ["Código SARPAS:", pilot?.sarpas_code || 'N/A'],
                    ["Aeronave (Prefixo/Modelo):", `${drone?.prefix || 'N/A'} - ${drone?.model || 'N/A'}`],
                    ["Número de Série / SISANT:", `${drone?.serial_number || 'N/A'} / ${drone?.sisant || 'N/A'}`],
                    ["Tempo de Voo Estimado:", `${(op.flight_hours || 0).toFixed(1)} h`]
                ],
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
            });
            const yAfterEquipe = (doc as any).lastAutoTable.finalY + 10;
            doc.setFont("helvetica", "bold");
            doc.text("3. RELATO OPERACIONAL E AÇÕES REALIZADAS", 14, yAfterEquipe);
            const relatoCompleto = `DESCRIÇÃO DA MISSÃO:\n${op.description || 'Sem descrição.'}\n\nAÇÕES REALIZADAS / DESFECHO:\n${op.actions_taken || 'Nenhuma ação detalhada registrada.'}`;
            const splitNarrative = doc.splitTextToSize(relatoCompleto, pageWidth - 28);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(splitNarrative, 14, yAfterEquipe + 7);
            const footerY = doc.internal.pageSize.height - 30;
            doc.line(pageWidth / 2 - 40, footerY, pageWidth / 2 + 40, footerY);
            doc.setFontSize(8);
            doc.text("Assinatura do Piloto em Comando / Responsável", pageWidth / 2, footerY + 5, { align: "center" });
            doc.text(`Documento gerado eletronicamente via SYSARP em ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);
        });
        doc.save(`Boletim_RPA_Formal_${new Date().getTime()}.pdf`);
    } catch (e) {
        alert("Erro ao exportar boletim.");
    } finally {
        setGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden font-sans">
      
      {/* MENU HORIZONTAL */}
      <nav className="bg-[#1e293b] text-white shrink-0 border-b border-slate-700 shadow-lg z-30">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between px-4">
            <div className="flex flex-row overflow-x-auto no-scrollbar py-2 gap-1 md:gap-2">
                <button onClick={() => setActiveTab('statistical')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'statistical' ? 'bg-red-700 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                    <BarChart3 className="w-4 h-4" /> Estatístico
                </button>
                <button onClick={() => setActiveTab('heatmap')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'heatmap' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                    <Flame className="w-4 h-4" /> Mapa de Calor
                </button>
                <button onClick={() => setActiveTab('specific')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'specific' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                    <ClipboardList className="w-4 h-4" /> Específicos
                </button>
                <button onClick={() => setActiveTab('managerial')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'managerial' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                    <TrendingUp className="w-4 h-4" /> Gerenciais
                </button>
            </div>

            <div className="py-2 md:py-0 flex gap-2">
                {activeTab === 'specific' && selectedOpIds.size > 0 && (
                    <Button onClick={handleExportBoletim} disabled={generatingPdf} className="bg-blue-600 hover:bg-blue-700 text-xs h-9 px-4 font-bold shadow-md">
                        <FileSignature className="w-3.5 h-3.5 mr-2" /> {generatingPdf ? 'Gerando...' : `Gerar Boletim (${selectedOpIds.size})`}
                    </Button>
                )}
                <Button onClick={loadData} variant="outline" className="bg-white/10 text-white border-white/20 text-xs h-9 px-3">
                    <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>
        </div>
      </nav>

      {/* FILTROS RECOLHÍVEIS */}
      <div className="bg-white border-b shadow-sm shrink-0 z-20">
        <div className="max-w-[1800px] mx-auto">
            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="w-full flex justify-between items-center p-4 text-left hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <Filter className="w-3 h-3 text-red-700" /> Filtros Ativos
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            {isFilterOpen && (
                <div className="p-4 md:p-6 border-t border-slate-100 animate-fade-in bg-slate-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <Input placeholder="Protocolo ou título..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 text-sm bg-white" />
                        </div>
                        <Select value={filterMission} onChange={e => setFilterMission(e.target.value)} className="h-10 text-sm bg-white">
                            <option value="all">Todas Naturezas</option>
                            {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </Select>
                        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-10 text-sm bg-white">
                            <option value="all">Todos Status</option>
                            <option value="active">Em Andamento</option>
                            <option value="completed">Concluídas</option>
                            <option value="cancelled">Canceladas</option>
                        </Select>
                        <div className="lg:col-span-2 flex gap-2">
                            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-10 text-sm flex-1 bg-white" />
                            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-10 text-sm flex-1 bg-white" />
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
        <div className="max-w-[1800px] mx-auto">
            
            {/* NOVO: ABA MAPA DE CALOR */}
            {activeTab === 'heatmap' && (
                <div className="animate-fade-in flex flex-col gap-6 h-[calc(100vh-250px)]">
                    <Card className="flex-1 overflow-hidden border border-slate-200 shadow-xl relative bg-slate-200">
                        {/* Overlay de Legenda Dinâmica */}
                        <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur p-3 rounded-lg shadow-xl border border-slate-200 z-[400] text-[10px] max-w-[200px]">
                            <div className="font-black text-slate-700 mb-2 border-b pb-1 uppercase tracking-tighter flex items-center gap-1">
                                <Shield className="w-3 h-3 text-red-700"/> Legenda do Calor
                            </div>
                            <div className="grid grid-cols-1 gap-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                {missionsInView.map(key => (
                                    <div key={key as string} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: MISSION_COLORS[key as MissionType] }}></div>
                                        <span className="text-slate-600 truncate">{(MISSION_HIERARCHY[key as MissionType]?.label || key).split('. ')[1] || key}</span>
                                    </div>
                                ))}
                                {missionsInView.length === 0 && <span className="italic text-slate-400">Nenhum dado no filtro</span>}
                            </div>
                        </div>

                        <MapContainer center={[-25.2521, -52.0215]} zoom={7} style={{ height: '100%', width: '100%' }}>
                            <MapController activeTab={activeTab} />
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            {filteredOps.map(op => (
                                isValidCoord(op.latitude, op.longitude) && (
                                    <CircleMarker 
                                        key={op.id}
                                        center={[jitter(Number(op.latitude)), jitter(Number(op.longitude))]}
                                        pathOptions={{ 
                                            color: MISSION_COLORS[op.mission_type] || 'gray', 
                                            fillColor: MISSION_COLORS[op.mission_type] || 'gray', 
                                            fillOpacity: 0.4,
                                            weight: 0
                                        }}
                                        radius={8}
                                    >
                                        <Popup>
                                            <div className="text-xs font-bold uppercase">{op.name}</div>
                                            <div className="text-[10px] text-slate-500 mt-1">#{op.occurrence_number}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{new Date(op.start_time).toLocaleDateString()}</div>
                                        </Popup>
                                    </CircleMarker>
                                )
                            ))}
                        </MapContainer>
                    </Card>
                </div>
            )}

            {/* ABA ESPECÍFICOS SEM MAPA - FOCADA EM LISTA E SELEÇÃO */}
            {activeTab === 'specific' && (
                <div className="animate-fade-in space-y-6">
                    <Card className="flex flex-col overflow-hidden bg-white shadow-lg border border-slate-200">
                        <div className="p-4 bg-slate-800 text-white font-bold text-xs uppercase tracking-widest flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <button onClick={selectAllFiltered} className="p-1 hover:bg-white/10 rounded transition-colors">
                                    {selectedOpIds.size === filteredOps.length && filteredOps.length > 0 ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                                </button>
                                <span>Resultados Filtrados ({filteredOps.length})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="danger">{selectedOpIds.size} Selecionados para BO</Badge>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-y md:divide-y-0 md:gap-px bg-slate-200">
                            {filteredOps.map(op => (
                                <div key={op.id} onClick={() => toggleSelectOp(op.id)} className={`p-5 bg-white hover:bg-slate-50 transition-colors cursor-pointer relative ${selectedOpIds.has(op.id) ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/30' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="pr-4">
                                            <h5 className="text-sm font-black text-slate-800 uppercase leading-tight">{op.name}</h5>
                                            <p className="text-[10px] text-slate-400 mt-1 font-mono">{op.occurrence_number}</p>
                                        </div>
                                        {selectedOpIds.has(op.id) ? <CheckSquare className="w-5 h-5 text-blue-600 shrink-0"/> : <Square className="w-5 h-5 text-slate-300 shrink-0"/>}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <Badge className="text-[9px]">{MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type}</Badge>
                                        <Badge variant={op.status === 'completed' ? 'success' : op.status === 'active' ? 'warning' : 'danger'} className="text-[9px]">{op.status.toUpperCase()}</Badge>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(op.start_time).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {(op.flight_hours || 0).toFixed(1)}h voadas</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredOps.length === 0 && (
                            <div className="p-20 text-center text-slate-400 italic text-sm bg-white">
                                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                Nenhuma missão encontrada com os filtros aplicados.
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* ABA ESTATÍSTICO */}
            {activeTab === 'statistical' && (
                <div className="animate-fade-in space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 bg-white border-l-4 border-l-red-700 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Operações</p><h3 className="text-xl md:text-2xl font-bold">{filteredOps.length}</h3></Card>
                        <Card className="p-4 bg-white border-l-4 border-l-blue-600 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Horas Voadas</p><h3 className="text-xl md:text-2xl font-bold">{statsData.totalHours.toFixed(1)}h</h3></Card>
                        <Card className="p-4 bg-white border-l-4 border-l-slate-800 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Aeronaves</p><h3 className="text-xl md:text-2xl font-bold">{new Set(filteredOps.map(o => o.drone_id)).size}</h3></Card>
                        <Card className="p-4 bg-white border-l-4 border-l-green-600 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Efetivo</p><h3 className="text-xl md:text-2xl font-bold">{new Set(filteredOps.map(o => o.pilot_id)).size}</h3></Card>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-5 md:p-6 shadow-sm"><h4 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2 uppercase tracking-tight"><LayoutGrid className="w-4 h-4 text-red-700" /> Natureza das Missões</h4><div className="h-72 md:h-80"><ResponsiveContainer width="100%" height="100%"><PieChart>
                          <Pie data={statsData.missionChart} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                            {statsData.missionChart.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart></ResponsiveContainer></div></Card>
                        <Card className="p-5 md:p-6 shadow-sm"><h4 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2 uppercase tracking-tight"><MapIcon className="w-4 h-4 text-red-700" /> Empenho por Regional</h4><div className="h-72 md:h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={statsData.regionalChart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" hide /><YAxis /><Tooltip /><Bar dataKey="value" fill="#b91c1c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
                    </div>
                </div>
            )}
            
            {/* ABA GERENCIAL */}
            {activeTab === 'managerial' && (
                <div className="animate-fade-in space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-5 md:p-6 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2 uppercase tracking-tight"><Users className="w-4 h-4 text-red-700" /> Produtividade: Horas por Piloto (Top 10)</h4>
                            <div className="h-80 md:h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={managerialData.pilotRanking} layout="vertical" margin={{ left: 20, right: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '9px' }} />
                                        <Tooltip />
                                        <Bar dataKey="hours" fill="#1e293b" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                        <Card className="p-5 md:p-6 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2 uppercase tracking-tight"><Plane className="w-4 h-4 text-red-700" /> Emprego da Frota: Horas por RPA</h4>
                            <div className="h-80 md:h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={managerialData.droneUsage}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" style={{ fontSize: '9px' }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="hours" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
