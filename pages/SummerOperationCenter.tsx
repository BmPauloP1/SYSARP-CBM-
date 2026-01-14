
import React, { useState, useEffect, useMemo } from 'react';
import { operationSummerService } from '../services/operationSummerService';
import { base44 } from '../services/base44Client';
import { SummerFlight, SUMMER_LOCATIONS, SummerAuditLog } from '../types_summer';
import { Pilot, Drone, MISSION_HIERARCHY, MissionType, MISSION_COLORS, SYSARP_LOGO } from '../types';
import { Card, Button, Input, Select, Badge } from '../components/ui_components';
import { 
  Sun, Clock, MapPin, Activity, Filter, Search, RefreshCcw, 
  Map as MapIcon, ChevronDown, Download, FileText, Shield, 
  Trash2, CheckSquare, Square, Loader2, PieChart as PieChartIcon,
  LayoutGrid, TrendingUp, Users, Calendar, RefreshCw, Pencil, Save, X,
  BarChart3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';

const CHART_COLORS = ['#f97316', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#64748b'];

// Helper para converter minutos totais em HH:MM
const formatMinutesToHHMM = (totalMinutes: number | undefined | null) => {
  if (!totalMinutes && totalMinutes !== 0) return "00:00";
  const safeMinutes = Math.round(totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} h`;
};

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

// Componente Visual de Chip para Filtros Ativos
const FilterChip = ({ label, onClear }: { label: string, onClear: () => void }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
    {label}
    <button onClick={onClear} className="hover:bg-orange-200 rounded-full p-0.5 transition-colors">
      <X className="w-3 h-3" />
    </button>
  </span>
);

// Custom Tooltip para Gráficos
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white p-2 rounded shadow-lg border border-slate-700 text-xs">
        <p className="font-bold mb-1">{label || payload[0].name}</p>
        <p className="text-orange-300">
          {payload[0].value} {payload[0].name === 'Horas' ? 'h' : 'voos'}
        </p>
      </div>
    );
  }
  return null;
};

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
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<SummerFlight | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<SummerFlight>>({});

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
      setPilots(p.sort((a,b) => a.full_name.localeCompare(b.full_name)));
      setDrones(d);
      setCurrentUser(me);
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncData = async () => {
      if (!currentUser) return;
      setIsSyncing(true);
      try {
          const count = await operationSummerService.syncMissingFlights(currentUser.id);
          if (count > 0) {
              alert(`Sincronização concluída! ${count} registros recuperados da base geral.`);
              loadData();
          } else {
              alert("Todos os dados já estão sincronizados.");
          }
      } catch (e) {
          alert("Erro ao sincronizar dados.");
      } finally {
          setIsSyncing(false);
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
            formatMinutesToHHMM(f.flight_duration),
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

  const handleEditSelected = () => {
      if (selectedIds.size !== 1) return;
      const flightId = Array.from(selectedIds)[0];
      const flight = flights.find(f => f.id === flightId);
      if (flight) {
          setEditingFlight(flight);
          setEditFormData({...flight});
          setIsEditModalOpen(true);
      }
  };

  const handleEditTimeChange = (field: 'start_time' | 'end_time', value: string) => {
      const newData = { ...editFormData, [field]: value };
      
      if (newData.start_time && newData.end_time) {
          const dummyDate = '2024-01-01';
          const start = new Date(`${dummyDate}T${newData.start_time}`);
          const end = new Date(`${dummyDate}T${newData.end_time}`);
          
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              let diff = Math.round((end.getTime() - start.getTime()) / 60000);
              if (diff < 0) diff += 1440; // Ajuste para virada de dia
              newData.flight_duration = diff;
          }
      }
      setEditFormData(newData);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingFlight || !currentUser) return;
      setLoading(true);
      try {
          await operationSummerService.update(editingFlight.id, editFormData, currentUser.id);
          alert("Registro atualizado com sucesso!");
          setIsEditModalOpen(false);
          setEditingFlight(null);
          loadData();
      } catch (e) {
          alert("Erro ao atualizar registro.");
      } finally {
          setLoading(false);
      }
  };

  // Contagem de Filtros Ativos
  const activeFilterCount = [
    filterMission !== 'all',
    filterLocation !== 'all',
    filterPgv !== 'all',
    dateStart !== '',
    dateEnd !== ''
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white border-b border-slate-200 shrink-0 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm z-20">
         <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Sun className="w-7 h-7 text-orange-500 fill-orange-500" />
               Centro de Operações Verão
            </h1>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mt-1">
               Monitoramento e Gestão de Voos Litorâneos
            </p>
         </div>
         <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
            {[
                { id: 'stats', label: 'Painel Geral', icon: Activity },
                { id: 'flights', label: 'Diário de Voos', icon: Clock },
                { id: 'report', label: 'Relatórios', icon: FileText },
                { id: 'audit', label: 'Auditoria', icon: Shield, admin: true }
            ].map(tab => {
                if (tab.admin && currentUser?.role !== 'admin') return null;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as SummerTab)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all duration-200 ${
                            isActive 
                            ? 'bg-white text-orange-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 ${isActive ? 'fill-orange-100' : ''}`} />
                        {tab.label}
                    </button>
                )
            })}
         </div>
      </div>

      {/* BARRA DE AÇÕES E FILTROS */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-col gap-3 shrink-0 z-10">
         <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            
            {/* Esquerda: Toggle Filtros e Resumo */}
            <div className="flex items-center gap-4 w-full md:w-auto">
               <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isFilterOpen ? 'bg-slate-100 text-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
               >
                  <Filter className="w-3.5 h-3.5" />
                  Filtros
                  {activeFilterCount > 0 && (
                      <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded-full text-[9px] ml-1">{activeFilterCount}</span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
               </button>

               {/* Filtros Ativos (Chips) */}
               <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar">
                  {filterMission !== 'all' && <FilterChip label={MISSION_HIERARCHY[filterMission as MissionType]?.label || filterMission} onClear={() => setFilterMission('all')} />}
                  {filterLocation !== 'all' && <FilterChip label={filterLocation} onClear={() => {setFilterLocation('all'); setFilterPgv('all');}} />}
                  {filterPgv !== 'all' && <FilterChip label={filterPgv} onClear={() => setFilterPgv('all')} />}
                  {(dateStart || dateEnd) && <FilterChip label="Período" onClear={() => {setDateStart(''); setDateEnd('');}} />}
               </div>
            </div>

            {/* Direita: Ações Globais */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <Button 
                    onClick={handleSyncData} 
                    disabled={isSyncing} 
                    variant="outline"
                    className="h-8 text-[10px] font-bold uppercase border-slate-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
                >
                    <RefreshCw className={`w-3 h-3 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} /> 
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Base'}
                </Button>

                {activeTab === 'flights' && selectedIds.size > 0 && (
                    <>
                        <div className="h-6 w-px bg-slate-300 mx-1"></div>
                        {selectedIds.size === 1 && currentUser?.role === 'admin' && (
                            <Button onClick={handleEditSelected} className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-[10px] px-3 font-bold uppercase shadow-sm">
                                <Pencil className="w-3 h-3 mr-1.5" /> Editar
                            </Button>
                        )}
                        {currentUser?.role === 'admin' && (
                            <Button onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700 text-white h-8 text-[10px] px-3 font-bold uppercase shadow-sm">
                                <Trash2 className="w-3 h-3 mr-1.5" /> Excluir ({selectedIds.size})
                            </Button>
                        )}
                        <Button onClick={handleExportPDF} className="bg-slate-700 hover:bg-slate-800 text-white h-8 text-[10px] px-3 font-bold uppercase shadow-sm">
                            <Download className="w-3 h-3 mr-1.5" /> PDF ({selectedIds.size})
                        </Button>
                    </>
                )}
                
                {activeTab !== 'flights' && (
                    <Button onClick={handleExportPDF} disabled={isGenerating} className="bg-slate-700 hover:bg-slate-800 text-white h-8 text-[10px] px-3 font-bold uppercase shadow-sm">
                        <Download className="w-3 h-3 mr-1.5" /> {isGenerating ? 'Gerando...' : 'Exportar Relatório'}
                    </Button>
                )}
            </div>
         </div>

         {/* Painel Expansível de Filtros */}
         {isFilterOpen && (
            <div className="pt-3 border-t border-slate-100 animate-fade-in grid grid-cols-1 md:grid-cols-5 gap-3">
                <Select label="Natureza" value={filterMission} onChange={e => setFilterMission(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200">
                    <option value="all">Todas as Naturezas</option>
                    {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
                <Select label="Cidade" value={filterLocation} onChange={e => {setFilterLocation(e.target.value); setFilterPgv('all');}} className="h-9 text-xs bg-slate-50 border-slate-200">
                    <option value="all">Todas as Cidades</option>
                    {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                </Select>
                <Select label="Posto (PGV)" value={filterPgv} onChange={e => setFilterPgv(e.target.value)} disabled={filterLocation === 'all'} className="h-9 text-xs bg-slate-50 border-slate-200">
                    <option value="all">Todos os Postos</option>
                    {filterLocation !== 'all' && SUMMER_LOCATIONS[filterLocation]?.map(pgv => <option key={pgv} value={pgv}>{pgv}</option>)}
                </Select>
                <div className="md:col-span-2 grid grid-cols-2 gap-2">
                    <Input label="De" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200" />
                    <Input label="Até" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200" />
                </div>
            </div>
         )}
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
        <div className="max-w-[1800px] mx-auto space-y-6">
            
            {activeTab === 'stats' && (
                <div className="animate-fade-in space-y-6">
                    
                    {/* KPIs - Novo Design */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-5 flex items-center justify-between border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Voos</p>
                                <h3 className="text-3xl font-black text-slate-800">{filteredFlights.length}</h3>
                                <p className="text-xs text-orange-600 font-medium mt-1">Registrados no período</p>
                            </div>
                            <div className="p-3 bg-orange-50 rounded-full text-orange-500 opacity-80">
                                <Activity className="w-8 h-8" />
                            </div>
                        </Card>

                        <Card className="p-5 flex items-center justify-between border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tempo de Voo</p>
                                <h3 className="text-3xl font-black text-slate-800">{stats.totalHours.toFixed(1)}<span className="text-lg text-slate-400 font-bold ml-1">h</span></h3>
                                <p className="text-xs text-blue-600 font-medium mt-1">Horas acumuladas</p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-full text-blue-500 opacity-80">
                                <Clock className="w-8 h-8" />
                            </div>
                        </Card>

                        <Card className="p-5 flex items-center justify-between border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Postos Atendidos</p>
                                <h3 className="text-3xl font-black text-slate-800">{new Set(filteredFlights.map(f => f.location)).size}</h3>
                                <p className="text-xs text-green-600 font-medium mt-1">Locais distintos</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-full text-green-500 opacity-80">
                                <MapPin className="w-8 h-8" />
                            </div>
                        </Card>

                        <Card className="p-5 flex items-center justify-between border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Frota Empregada</p>
                                <h3 className="text-3xl font-black text-slate-800">{new Set(filteredFlights.map(f => f.drone_id)).size}</h3>
                                <p className="text-xs text-purple-600 font-medium mt-1">Aeronaves ativas</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-full text-purple-500 opacity-80">
                                <RefreshCcw className="w-8 h-8" />
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* MAPA OPERACIONAL */}
                        <Card className="lg:col-span-2 min-h-[500px] overflow-hidden relative shadow-md border border-slate-200">
                            <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 shadow-lg flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Mapa de Calor Operacional</span>
                            </div>
                            
                            <MapContainer center={[-25.65, -48.5]} zoom={9} style={{ height: '100%', width: '100%' }}>
                                <MapController />
                                <TileLayer 
                                    attribution='&copy; OpenStreetMap'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                                />
                                {filteredFlights.map(f => (
                                    isValidCoord(f.latitude, f.longitude) && (
                                        <CircleMarker 
                                            key={f.id}
                                            center={[jitter(f.latitude!), jitter(f.longitude!)]}
                                            pathOptions={{ 
                                                color: MISSION_COLORS[f.mission_type] || '#f97316', 
                                                fillColor: MISSION_COLORS[f.mission_type] || '#f97316', 
                                                fillOpacity: 0.6, 
                                                weight: 1 
                                            }}
                                            radius={6}
                                        >
                                            <Popup>
                                                <div className="min-w-[150px]">
                                                    <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">{MISSION_HIERARCHY[f.mission_type as MissionType]?.label}</div>
                                                    <div className="font-bold text-slate-800 text-sm leading-tight">{f.location}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3"/> {new Date(f.date).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </Popup>
                                        </CircleMarker>
                                    )
                                ))}
                            </MapContainer>
                        </Card>
                        
                        {/* GRÁFICOS LATERAIS */}
                        <div className="flex flex-col gap-6">
                            <Card className="p-5 flex-1 shadow-md border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-600 mb-4 uppercase tracking-widest flex items-center gap-2">
                                    <PieChartIcon className="w-4 h-4 text-orange-500" /> Distribuição por Natureza
                                </h4>
                                <div className="h-48 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={stats.byMission} 
                                                innerRadius={45} 
                                                outerRadius={70} 
                                                paddingAngle={4} 
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {stats.byMission.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '10px' }}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="p-5 flex-1 shadow-md border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-600 mb-4 uppercase tracking-widest flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-blue-500" /> Top Localidades
                                </h4>
                                <div className="h-48 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.byLocation} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                                            <XAxis type="number" hide />
                                            <YAxis 
                                                dataKey="name" 
                                                type="category" 
                                                width={90} 
                                                tick={{fontSize: 10, fill: '#64748b', fontWeight: 500}} 
                                                interval={0}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'flights' && (
                <div className="animate-fade-in">
                    <Card className="border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center">
                                            <button 
                                                onClick={() => selectedIds.size === filteredFlights.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filteredFlights.map(f => f.id)))} 
                                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {selectedIds.size === filteredFlights.length && filteredFlights.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4"/>}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Data / Hora</th>
                                        <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Local</th>
                                        <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Natureza</th>
                                        <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Duração</th>
                                        <th className="px-4 py-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Equipe / Drone</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredFlights.map(f => (
                                        <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(f.id) ? 'bg-blue-50/40' : ''}`}>
                                            <td className="px-4 py-3 text-center align-middle">
                                                <button onClick={() => { const n = new Set(selectedIds); if(n.has(f.id)) n.delete(f.id); else n.add(f.id); setSelectedIds(n); }}>
                                                    {selectedIds.has(f.id) ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4 text-slate-300"/>}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <div className="font-bold text-xs text-slate-700">{new Date(f.date + 'T12:00:00').toLocaleDateString()}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{f.start_time} - {f.end_time}</div>
                                            </td>
                                            <td className="px-4 py-3 align-middle font-medium text-xs text-slate-600 truncate max-w-[180px]" title={f.location}>
                                                {f.location}
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    {MISSION_HIERARCHY[f.mission_type as MissionType]?.label || f.mission_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 align-middle font-mono text-xs font-bold text-slate-700">
                                                {formatMinutesToHHMM(f.flight_duration)}
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <div className="text-[10px] font-bold text-slate-700">{pilots.find(p => p.id === f.pilot_id)?.full_name || 'N/A'}</div>
                                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">{drones.find(d => d.id === f.drone_id)?.prefix || 'N/A'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredFlights.length === 0 && (
                                        <tr><td colSpan={6} className="p-12 text-center text-xs text-slate-400 italic bg-slate-50/30">Nenhum registro encontrado com os filtros atuais.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'report' && (
                <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
                    <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-t-4 border-t-orange-500 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <FileText className="w-32 h-32" />
                        </div>
                        
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600 mb-2 ring-4 ring-orange-50">
                            <Download className="w-8 h-8" />
                        </div>
                        
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Exportação de Relatório</h3>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                Gere um documento PDF oficial contendo estatísticas consolidadas e o log detalhado dos voos filtrados.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4 text-left space-y-2 border border-slate-100">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-bold uppercase">Registros</span>
                                <span className="text-slate-800 font-mono">{filteredFlights.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500 font-bold uppercase">Horas Totais</span>
                                <span className="text-slate-800 font-mono">{stats.totalHours.toFixed(1)}h</span>
                            </div>
                        </div>

                        <Button onClick={handleExportPDF} disabled={isGenerating} className="w-full h-11 text-sm bg-slate-900 hover:bg-black text-white font-bold shadow-lg transition-transform active:scale-95">
                            {isGenerating ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando Documento...</>
                            ) : (
                                <><Download className="w-4 h-4 mr-2" /> Baixar Relatório PDF</>
                            )}
                        </Button>
                    </Card>
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="animate-fade-in">
                    <Card className="border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data/Hora</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ação</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                                {auditLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-4 py-2 font-bold text-slate-700">{pilots.find(p => p.id === log.user_id)?.full_name || 'Sistema'}</td>
                                        <td className="px-4 py-2">
                                            <Badge variant={log.action === 'CREATE' ? 'success' : log.action === 'DELETE' ? 'danger' : 'warning'} className="text-[9px] px-1.5 py-0.5">
                                                {log.action}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-2 italic text-slate-500 truncate max-w-md" title={log.details}>{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

        </div>
      </main>

      {/* EDIT MODAL */}
      {isEditModalOpen && editingFlight && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <Card className="w-full max-w-lg bg-white shadow-2xl p-6 border-t-4 border-t-blue-600">
                  <div className="flex justify-between items-center mb-6 border-b pb-3">
                      <div>
                          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                              <Pencil className="w-5 h-5 text-blue-600" /> Editar Registro
                          </h2>
                          <p className="text-xs text-slate-400 mt-1 font-mono">ID: {editingFlight.id.split('-')[0]}</p>
                      </div>
                      <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSaveEdit} className="space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4">
                          <Input 
                              label="Data" 
                              type="date" 
                              value={editFormData.date} 
                              onChange={e => setEditFormData({...editFormData, date: e.target.value})} 
                              required 
                              className="font-bold text-slate-700"
                          />
                          <Select 
                              label="Localidade Base" 
                              value={Object.keys(SUMMER_LOCATIONS).find(key => editFormData.location?.includes(key)) ? 'Outro' : 'Outro'}
                              onChange={e => {
                                  if(e.target.value !== 'Outro') setEditFormData({...editFormData, location: e.target.value});
                              }}
                          >
                              <option value="Outro">Manual / Específico</option>
                              {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                          </Select>
                      </div>

                      <Input 
                          label="Local Específico (PGV / Praia)" 
                          value={editFormData.location} 
                          onChange={e => setEditFormData({...editFormData, location: e.target.value})} 
                          required 
                      />

                      <div className="grid grid-cols-2 gap-4">
                          <Select 
                              label="Piloto" 
                              value={editFormData.pilot_id} 
                              onChange={e => setEditFormData({...editFormData, pilot_id: e.target.value})} 
                              required
                          >
                              {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                          </Select>
                          <Select 
                              label="Aeronave" 
                              value={editFormData.drone_id} 
                              onChange={e => setEditFormData({...editFormData, drone_id: e.target.value})} 
                              required
                          >
                              {drones.map(d => <option key={d.id} value={d.id}>{d.prefix}</option>)}
                          </Select>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-3 gap-3">
                          <Input 
                              label="Início" 
                              type="time" 
                              value={editFormData.start_time} 
                              onChange={e => handleEditTimeChange('start_time', e.target.value)} 
                              required 
                          />
                          <Input 
                              label="Término" 
                              type="time" 
                              value={editFormData.end_time} 
                              onChange={e => handleEditTimeChange('end_time', e.target.value)} 
                              required 
                          />
                          <div className="bg-white p-2 rounded border border-slate-200 flex flex-col justify-center items-center">
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Duração</label>
                              <div className="text-center font-mono font-bold text-blue-600 text-sm">
                                {formatMinutesToHHMM(editFormData.flight_duration)}
                              </div>
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Natureza da Missão</label>
                          <select 
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                              value={editFormData.mission_type} 
                              onChange={e => setEditFormData({...editFormData, mission_type: e.target.value as any})}
                          >
                              {Object.entries(MISSION_HIERARCHY).map(([key, val]) => (
                                  <option key={key} value={key}>{val.label}</option>
                              ))}
                          </select>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Observações</label>
                          <textarea 
                              className="w-full p-3 border border-slate-300 rounded-lg text-sm h-24 resize-none bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                              value={editFormData.notes || ''}
                              onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                              placeholder="Detalhes adicionais..."
                          />
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                          <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold">
                              <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                          </Button>
                      </div>
                  </form>
              </Card>
          </div>
      )}
    </div>
  );
}
