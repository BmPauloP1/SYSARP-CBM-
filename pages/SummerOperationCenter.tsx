
import React, { useState, useEffect, useMemo } from 'react';
import { operationSummerService } from '../services/operationSummerService';
import { base44 } from '../services/base44Client';
import { SummerFlight, SummerStats, SUMMER_LOCATIONS, SummerAuditLog } from '../types_summer';
import { Pilot, Drone, MISSION_HIERARCHY, MissionType, MISSION_COLORS, SYSARP_LOGO } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { 
  Sun, Clock, MapPin, Activity, Filter, Search, RefreshCcw, 
  Map as MapIcon, ChevronDown, Download, FileText, Shield, 
  Trash2, CheckSquare, Square, Loader2, PieChart as PieChartIcon,
  LayoutGrid, TrendingUp, Users, Calendar
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';

const CHART_COLORS = ['#f97316', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6'];

const MapController = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map && map.getContainer()) map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const isValidCoord = (lat: any, lng: any) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
};

const jitter = (coord: number) => coord + (Math.random() - 0.5) * 0.02;

type SummerTab = 'stats' | 'flights' | 'report' | 'audit';

export default function SummerOperationCenter() {
  const [activeTab, setActiveTab] = useState<SummerTab>('stats');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flights, setFlights] = useState<SummerFlight[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [auditLogs, setAuditLogs] = useState<SummerAuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  
  // Selection/Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  // Filters State
  const [filterMission, setFilterMission] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterPgv, setFilterPgv] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [f, p, d, me, logs] = await Promise.all([
        operationSummerService.list(),
        base44.entities.Pilot.list(),
        base44.entities.Drone.list(),
        base44.auth.me(),
        operationSummerService.getAuditLogs()
      ]);
      setFlights(f);
      setPilots(p);
      setDrones(d);
      setCurrentUser(me);
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredFlights = useMemo(() => {
    return flights.filter(f => {
      const matchMission = filterMission === 'all' || f.mission_type === filterMission;
      const matchLocation = filterLocation === 'all' || f.location.includes(filterLocation);
      const matchPgv = filterPgv === 'all' || f.location.includes(filterPgv);
      
      let matchDate = true;
      if (dateStart) matchDate = matchDate && new Date(f.date) >= new Date(dateStart);
      if (dateEnd) matchDate = matchDate && new Date(f.date) <= new Date(dateEnd);

      return matchMission && matchLocation && matchPgv && matchDate;
    });
  }, [flights, filterMission, filterLocation, filterPgv, dateStart, dateEnd]);

  const stats = useMemo(() => {
    const s = {
      totalHours: 0,
      byMission: [] as any[],
      byLocation: [] as any[],
      byDrone: [] as any[]
    };

    const missionCounts: Record<string, number> = {};
    const locCounts: Record<string, number> = {};

    filteredFlights.forEach(f => {
      s.totalHours += (f.flight_duration || 0) / 60;
      const mLabel = MISSION_HIERARCHY[f.mission_type as MissionType]?.label || f.mission_type;
      missionCounts[mLabel] = (missionCounts[mLabel] || 0) + 1;
      locCounts[f.location] = (locCounts[f.location] || 0) + 1;
    });

    s.byMission = Object.entries(missionCounts).map(([name, value]) => ({ name, value }));
    s.byLocation = Object.entries(locCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return s;
  }, [filteredFlights]);

  const handleExportPDF = async () => {
    setIsGenerating(true);
    try {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text("RELATÓRIO CONSOLIDADO - OPERAÇÃO VERÃO", 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

        const tableData = filteredFlights.map(f => [
            new Date(f.date + 'T12:00:00').toLocaleDateString(),
            f.location,
            MISSION_HIERARCHY[f.mission_type as MissionType]?.label || f.mission_type,
            `${f.flight_duration} min`,
            pilots.find(p => p.id === f.pilot_id)?.full_name || 'N/A'
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Data', 'Local', 'Natureza', 'Duração', 'Piloto']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [249, 115, 22] }
        });

        doc.save(`Relatorio_Verao_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
        alert("Erro ao gerar PDF.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || !currentUser) return;
    if (confirm(`Excluir ${selectedIds.size} registros permanentemente?`)) {
      setLoading(true);
      try {
        await operationSummerService.delete(Array.from(selectedIds), currentUser.id);
        setSelectedIds(new Set());
        loadData();
      } catch (e) {
        alert("Erro ao excluir.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden font-sans">
      
      {/* HEADER TABS (Padrão visual solicitado) */}
      <nav className="bg-[#1e293b] text-white shrink-0 border-b border-slate-700 shadow-lg z-30">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between px-4">
            <div className="flex flex-row overflow-x-auto no-scrollbar py-2 gap-1 md:gap-2">
                <button 
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                    <Activity className="w-4 h-4" /> Estatísticas
                </button>
                <button 
                    onClick={() => setActiveTab('flights')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'flights' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                    <Clock className="w-4 h-4" /> Diário de Voos
                </button>
                <button 
                    onClick={() => setActiveTab('report')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'report' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                    <FileText className="w-4 h-4" /> Relatórios
                </button>
                {currentUser?.role === 'admin' && (
                    <button 
                        onClick={() => setActiveTab('audit')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'audit' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Shield className="w-4 h-4" /> Auditoria
                    </button>
                )}
            </div>

            <div className="py-2 md:py-0 flex gap-2">
                {activeTab === 'flights' && selectedIds.size > 0 && currentUser?.role === 'admin' && (
                    <Button onClick={handleDeleteSelected} variant="danger" size="sm" className="h-9 px-4 font-bold">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir ({selectedIds.size})
                    </Button>
                )}
                <Button 
                    onClick={handleExportPDF} 
                    disabled={isGenerating} 
                    className="bg-slate-700 hover:bg-slate-600 border-none text-xs h-9 px-4 font-bold"
                >
                    <Download className="w-3.5 h-3.5 mr-2" /> {isGenerating ? 'Gerando...' : 'PDF'}
                </Button>
            </div>
        </div>
      </nav>

      {/* FILTERS BAR (Collapsible) */}
      <div className="bg-white border-b shadow-sm shrink-0 z-20">
        <div className="max-w-[1800px] mx-auto">
            <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="w-full flex justify-between items-center p-4 text-left hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                    <Filter className="w-3 h-3 text-orange-600" /> Filtros Operação Verão
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
                <div className="p-4 md:p-6 border-t border-slate-100 animate-fade-in bg-slate-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                        <Select value={filterMission} onChange={e => setFilterMission(e.target.value)} className="h-10 text-sm bg-white">
                            <option value="all">Todas Naturezas</option>
                            {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </Select>
                        <Select value={filterLocation} onChange={e => {setFilterLocation(e.target.value); setFilterPgv('all');}} className="h-10 text-sm bg-white">
                            <option value="all">Todas as Cidades</option>
                            {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                        </Select>
                        <Select value={filterPgv} onChange={e => setFilterPgv(e.target.value)} disabled={filterLocation === 'all'} className="h-10 text-sm bg-white">
                            <option value="all">Todos os Postos (PGV)</option>
                            {filterLocation !== 'all' && SUMMER_LOCATIONS[filterLocation]?.map(pgv => <option key={pgv} value={pgv}>{pgv}</option>)}
                        </Select>
                        <div className="lg:col-span-2 flex gap-2">
                            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-10 text-sm flex-1 bg-white" />
                            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-10 text-sm flex-1 bg-white" />
                            <Button variant="outline" onClick={() => {setFilterMission("all"); setFilterLocation("all"); setFilterPgv("all"); setDateStart(""); setDateEnd("");}} className="bg-white h-10 px-3">
                                <RefreshCcw className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
        <div className="max-w-[1800px] mx-auto">
            
            {activeTab === 'stats' && (
                <div className="animate-fade-in space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 bg-white border-l-4 border-l-orange-500 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Total Registros</p>
                            <h3 className="text-xl md:text-2xl font-bold text-slate-800">{filteredFlights.length}</h3>
                        </Card>
                        <Card className="p-4 bg-white border-l-4 border-l-blue-600 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Horas de Empenho</p>
                            <h3 className="text-xl md:text-2xl font-bold text-slate-800">{stats.totalHours.toFixed(1)}h</h3>
                        </Card>
                        <Card className="p-4 bg-white border-l-4 border-l-green-600 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Postos Atendidos</p>
                            <h3 className="text-xl md:text-2xl font-bold text-slate-800">{new Set(filteredFlights.map(f => f.location)).size}</h3>
                        </Card>
                        <Card className="p-4 bg-white border-l-4 border-l-slate-800 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Aeronaves</p>
                            <h3 className="text-xl md:text-2xl font-bold text-slate-800">{new Set(filteredFlights.map(f => f.drone_id)).size}</h3>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 h-[500px] overflow-hidden relative shadow-lg">
                            <div className="absolute top-4 left-4 z-[400] bg-white/90 p-2 rounded border font-bold text-[10px] uppercase shadow-sm">Mapa de Calor Operacional</div>
                            <MapContainer center={[-25.7, -48.5]} zoom={10} style={{ height: '100%', width: '100%' }}>
                                <MapController />
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                {filteredFlights.map(f => (
                                    isValidCoord(f.latitude, f.longitude) && (
                                        <CircleMarker 
                                            key={f.id}
                                            center={[jitter(f.latitude!), jitter(f.longitude!)]}
                                            pathOptions={{ color: MISSION_COLORS[f.mission_type] || 'orange', fillColor: MISSION_COLORS[f.mission_type] || 'orange', fillOpacity: 0.5 }}
                                            radius={8}
                                        >
                                            <Popup>
                                                <div className="text-[10px] font-bold uppercase">{f.location}</div>
                                                <div className="text-[9px] text-slate-500 mt-1">{new Date(f.date).toLocaleDateString()}</div>
                                            </Popup>
                                        </CircleMarker>
                                    )
                                ))}
                            </MapContainer>
                        </Card>
                        
                        <div className="space-y-6">
                            <Card className="p-5 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-tight"><PieChartIcon className="w-4 h-4 text-orange-600" /> Natureza das Missões</h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={stats.byMission} innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {stats.byMission.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                            <Card className="p-5 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-tight"><MapPin className="w-4 h-4 text-orange-600" /> Top Localidades</h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.byLocation} layout="vertical">
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '9px' }} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'flights' && (
                <div className="animate-fade-in space-y-4">
                    <Card className="overflow-hidden bg-white shadow-md border-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-800 text-slate-200 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <button onClick={() => selectedIds.size === filteredFlights.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filteredFlights.map(f => f.id)))}>
                                                {selectedIds.size === filteredFlights.length ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                                            </button>
                                        </th>
                                        <th className="p-4">Data / Hora</th>
                                        <th className="p-4">Localidade (Posto)</th>
                                        <th className="p-4">Natureza</th>
                                        <th className="p-4">Duração</th>
                                        <th className="p-4">Equipe / Drone</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredFlights.map(f => (
                                        <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(f.id) ? 'bg-orange-50' : ''}`}>
                                            <td className="p-4 text-center">
                                                <button onClick={() => { const n = new Set(selectedIds); if(n.has(f.id)) n.delete(f.id); else n.add(f.id); setSelectedIds(n); }}>
                                                    {selectedIds.has(f.id) ? <CheckSquare className="w-4 h-4 text-orange-600"/> : <Square className="w-4 h-4 text-slate-300"/>}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-700">{new Date(f.date + 'T12:00:00').toLocaleDateString()}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{f.start_time} - {f.end_time}</div>
                                            </td>
                                            <td className="p-4 font-medium text-orange-800">{f.location}</td>
                                            <td className="p-4">
                                                <Badge variant="default" className="text-[10px]">{MISSION_HIERARCHY[f.mission_type as MissionType]?.label || f.mission_type}</Badge>
                                            </td>
                                            <td className="p-4 font-mono font-bold text-slate-600">{f.flight_duration} min</td>
                                            <td className="p-4">
                                                <div className="text-xs font-bold">{pilots.find(p => p.id === f.pilot_id)?.full_name || 'N/A'}</div>
                                                <div className="text-[10px] text-slate-400 uppercase">{drones.find(d => d.id === f.drone_id)?.prefix || 'N/A'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredFlights.length === 0 && (
                                        <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">Nenhum registro encontrado para os filtros.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'report' && (
                <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
                    <Card className="max-w-xl w-full p-8 text-center space-y-6 shadow-xl border-t-8 border-orange-500 bg-white">
                        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600">
                            <FileText className="w-10 h-10" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Emissor de Relatório Consolidado</h3>
                            <p className="text-sm text-slate-500 mt-2">Clique no botão abaixo para gerar o PDF consolidado com base nos filtros atuais.</p>
                        </div>
                        <div className="pt-4 flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-2 text-left">
                                <div className="p-2 bg-slate-50 rounded border text-xs"><span className="font-bold block text-slate-400">Total Voos</span>{filteredFlights.length}</div>
                                <div className="p-2 bg-slate-50 rounded border text-xs"><span className="font-bold block text-slate-400">Total Horas</span>{stats.totalHours.toFixed(1)}h</div>
                            </div>
                            <Button onClick={handleExportPDF} disabled={isGenerating} className="h-14 text-lg bg-orange-600 hover:bg-orange-700 text-white font-black shadow-lg">
                                <Download className="w-6 h-6 mr-2" /> {isGenerating ? 'Processando...' : 'Baixar Relatório Completo'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="animate-fade-in">
                    <Card className="overflow-hidden bg-white shadow-md border-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-800 text-slate-200 font-bold uppercase">
                                    <tr>
                                        <th className="p-4">Data / Hora</th>
                                        <th className="p-4">Militar Responsável</th>
                                        <th className="p-4">Ação</th>
                                        <th className="p-4">Descrição do Log</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-slate-600">
                                    {auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="p-4 font-bold">{pilots.find(p => p.id === log.user_id)?.full_name || 'Sistema'}</td>
                                            <td className="p-4"><Badge variant={log.action === 'CREATE' ? 'success' : 'danger'}>{log.action}</Badge></td>
                                            <td className="p-4 italic">{log.details}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

        </div>
      </main>
    </div>
  );
}
