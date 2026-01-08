
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
        
        // Definição dos dados a serem exportados: Seleção ou Filtro Atual
        const flightsToExport = selectedIds.size > 0 
            ? filteredFlights.filter(f => selectedIds.has(f.id))
            : filteredFlights;

        const titleText = selectedIds.size > 0 
            ? `RELATÓRIO DE VOOS SELECIONADOS (${selectedIds.size})`
            : "RELATÓRIO CONSOLIDADO - OPERAÇÃO VERÃO";

        doc.setFontSize(16);
        doc.text(titleText, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

        const tableData = flightsToExport.map(f => [
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

        const fileName = selectedIds.size > 0 ? 'Relatorio_Selecao_Verao' : 'Relatorio_Geral_Verao';
        doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
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
      
      {/* COMPACT HEADER TABS */}
      <nav className="bg-[#1e293b] text-white shrink-0 border-b border-slate-700 shadow-sm z-30">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between px-3 h-12">
            <div className="flex flex-row overflow-x-auto no-scrollbar gap-1 items-center h-full">
                {[
                  { id: 'stats', label: 'Painel Geral', icon: Activity },
                  { id: 'flights', label: 'Diário de Voos', icon: Clock },
                  { id: 'report', label: 'Relatórios', icon: FileText },
                  { id: 'audit', label: 'Auditoria', icon: Shield, admin: true }
                ].map(tab => {
                  if (tab.admin && currentUser?.role !== 'admin') return null;
                  return (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as SummerTab)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                    >
                        <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                    </button>
                  )
                })}
            </div>

            <div className="flex gap-2 items-center">
                {activeTab === 'flights' && selectedIds.size > 0 && currentUser?.role === 'admin' && (
                    <Button onClick={handleDeleteSelected} variant="danger" size="sm" className="h-7 px-3 text-[10px] font-bold uppercase">
                        <Trash2 className="w-3 h-3 mr-1.5" /> Excluir ({selectedIds.size})
                    </Button>
                )}
                <Button 
                    onClick={handleExportPDF} 
                    disabled={isGenerating} 
                    className="bg-slate-700 hover:bg-slate-600 border-none text-[10px] h-7 px-3 font-bold uppercase"
                >
                    <Download className="w-3 h-3 mr-1.5" /> 
                    {isGenerating ? '...' : selectedIds.size > 0 ? `PDF (${selectedIds.size})` : 'PDF Total'}
                </Button>
            </div>
        </div>
      </nav>

      {/* COMPACT FILTERS BAR */}
      <div className="bg-white border-b border-slate-200 shrink-0 z-20">
        <div className="max-w-[1800px] mx-auto">
            <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="w-full flex justify-between items-center px-4 py-2 text-left hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Filter className="w-3 h-3 text-orange-600" /> Filtros ({filteredFlights.length} reg.)
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
                <div className="px-4 pb-3 border-t border-slate-100 animate-fade-in bg-slate-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
                        <Select value={filterMission} onChange={e => setFilterMission(e.target.value)} className="h-8 text-xs bg-white">
                            <option value="all">Todas Naturezas</option>
                            {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </Select>
                        <Select value={filterLocation} onChange={e => {setFilterLocation(e.target.value); setFilterPgv('all');}} className="h-8 text-xs bg-white">
                            <option value="all">Todas Cidades</option>
                            {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                        </Select>
                        <Select value={filterPgv} onChange={e => setFilterPgv(e.target.value)} disabled={filterLocation === 'all'} className="h-8 text-xs bg-white">
                            <option value="all">Todos Postos</option>
                            {filterLocation !== 'all' && SUMMER_LOCATIONS[filterLocation]?.map(pgv => <option key={pgv} value={pgv}>{pgv}</option>)}
                        </Select>
                        <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-8 text-xs bg-white" />
                        <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-8 text-xs bg-white" />
                        <Button variant="outline" onClick={() => {setFilterMission("all"); setFilterLocation("all"); setFilterPgv("all"); setDateStart(""); setDateEnd("");}} className="bg-white h-8 px-2 text-xs">
                            <RefreshCcw className="w-3 h-3 mr-1" /> Limpar
                        </Button>
                    </div>
                </div>
            )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-3 bg-slate-100/50">
        <div className="max-w-[1800px] mx-auto space-y-3">
            
            {activeTab === 'stats' && (
                <div className="animate-fade-in space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><Activity className="w-8 h-8 text-orange-500"/></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Voos</span>
                            <span className="text-2xl font-bold text-slate-800">{filteredFlights.length}</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="w-8 h-8 text-blue-500"/></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horas Totais</span>
                            <span className="text-2xl font-bold text-slate-800">{stats.totalHours.toFixed(1)}h</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><MapPin className="w-8 h-8 text-green-500"/></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Postos</span>
                            <span className="text-2xl font-bold text-slate-800">{new Set(filteredFlights.map(f => f.location)).size}</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><Users className="w-8 h-8 text-slate-500"/></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aeronaves</span>
                            <span className="text-2xl font-bold text-slate-800">{new Set(filteredFlights.map(f => f.drone_id)).size}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <Card className="lg:col-span-2 h-[400px] overflow-hidden relative shadow-sm border border-slate-200 rounded-lg">
                            <div className="absolute top-3 left-3 z-[400] bg-white/90 px-2 py-1 rounded border border-slate-200 font-bold text-[10px] uppercase shadow-sm flex items-center gap-2">
                                <MapIcon className="w-3 h-3 text-orange-600"/> Mapa Operacional
                            </div>
                            <MapContainer center={[-25.7, -48.5]} zoom={9} style={{ height: '100%', width: '100%' }}>
                                <MapController />
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                {filteredFlights.map(f => (
                                    isValidCoord(f.latitude, f.longitude) && (
                                        <CircleMarker 
                                            key={f.id}
                                            center={[jitter(f.latitude!), jitter(f.longitude!)]}
                                            pathOptions={{ color: MISSION_COLORS[f.mission_type] || 'orange', fillColor: MISSION_COLORS[f.mission_type] || 'orange', fillOpacity: 0.6, weight: 1 }}
                                            radius={5}
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
                        
                        <div className="flex flex-col gap-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex-1 min-h-[190px]">
                                <h4 className="text-[10px] font-bold text-slate-500 mb-2 uppercase flex items-center gap-1"><PieChartIcon className="w-3 h-3 text-orange-600" /> Natureza</h4>
                                <div className="h-32">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={stats.byMission} innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                                                {stats.byMission.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ fontSize: '10px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex-1 min-h-[190px]">
                                <h4 className="text-[10px] font-bold text-slate-500 mb-2 uppercase flex items-center gap-1"><MapPin className="w-3 h-3 text-orange-600" /> Localidades</h4>
                                <div className="h-32">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.byLocation} layout="vertical" margin={{ left: 0, right: 10 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={90} style={{ fontSize: '9px', fontWeight: 600 }} />
                                            <Tooltip contentStyle={{ fontSize: '10px' }} cursor={{fill: 'transparent'}} />
                                            <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} barSize={12} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'flights' && (
                <div className="animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2 w-10 text-center">
                                            <button onClick={() => selectedIds.size === filteredFlights.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filteredFlights.map(f => f.id)))} className="text-slate-400 hover:text-slate-600">
                                                {selectedIds.size === filteredFlights.length && filteredFlights.length > 0 ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data / Hora</th>
                                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Local</th>
                                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Natureza</th>
                                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dur.</th>
                                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Equipe / Drone</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredFlights.map(f => (
                                        <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(f.id) ? 'bg-orange-50/50' : ''}`}>
                                            <td className="px-3 py-2 text-center align-middle">
                                                <button onClick={() => { const n = new Set(selectedIds); if(n.has(f.id)) n.delete(f.id); else n.add(f.id); setSelectedIds(n); }}>
                                                    {selectedIds.has(f.id) ? <CheckSquare className="w-4 h-4 text-orange-600"/> : <Square className="w-4 h-4 text-slate-300"/>}
                                                </button>
                                            </td>
                                            <td className="px-3 py-2 align-middle">
                                                <div className="font-bold text-xs text-slate-700">{new Date(f.date + 'T12:00:00').toLocaleDateString()}</div>
                                                <div className="text-[9px] text-slate-400 font-mono">{f.start_time} - {f.end_time}</div>
                                            </td>
                                            <td className="px-3 py-2 align-middle font-medium text-xs text-slate-600 truncate max-w-[150px]" title={f.location}>{f.location}</td>
                                            <td className="px-3 py-2 align-middle">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                    {MISSION_HIERARCHY[f.mission_type as MissionType]?.label || f.mission_type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 align-middle font-mono text-xs font-bold text-slate-600">{f.flight_duration} min</td>
                                            <td className="px-3 py-2 align-middle">
                                                <div className="text-[10px] font-bold text-slate-700">{pilots.find(p => p.id === f.pilot_id)?.full_name || 'N/A'}</div>
                                                <div className="text-[9px] text-slate-400">{drones.find(d => d.id === f.drone_id)?.prefix || 'N/A'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredFlights.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-xs text-slate-400 italic">Nenhum registro encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'report' && (
                <div className="animate-fade-in flex items-center justify-center min-h-[300px]">
                    <div className="max-w-md w-full p-6 text-center space-y-4 bg-white rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
                        <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-orange-600 mb-2">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Exportação Consolidada</h3>
                            <p className="text-xs text-slate-500 mt-1">Gere um relatório PDF com os filtros atuais aplicados.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-left mt-2">
                            <div className="p-2 bg-slate-50 rounded border border-slate-100 text-[10px]"><span className="font-bold block text-slate-400 uppercase">Voos</span>{filteredFlights.length}</div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100 text-[10px]"><span className="font-bold block text-slate-400 uppercase">Horas</span>{stats.totalHours.toFixed(1)}h</div>
                        </div>
                        <Button onClick={handleExportPDF} disabled={isGenerating} className="w-full h-10 text-sm bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-md">
                            <Download className="w-4 h-4 mr-2" /> {isGenerating ? 'Processando...' : 'Baixar Relatório'}
                        </Button>
                    </div>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Data</th>
                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Usuário</th>
                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Ação</th>
                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Log</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                                {auditLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 font-mono text-[10px]">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-3 py-2 font-bold">{pilots.find(p => p.id === log.user_id)?.full_name || 'Sistema'}</td>
                                        <td className="px-3 py-2"><Badge variant={log.action === 'CREATE' ? 'success' : 'danger'} className="text-[9px] px-1.5 py-0.5">{log.action}</Badge></td>
                                        <td className="px-3 py-2 italic text-slate-500 truncate max-w-xs" title={log.details}>{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
      </main>
    </div>
  );
}
