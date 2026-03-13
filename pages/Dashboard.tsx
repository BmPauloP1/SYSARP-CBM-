import React, { useEffect, useState, useCallback, memo, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MISSION_COLORS, ConflictNotification, Maintenance } from "../types";
import { Badge, Button, Card } from "../components/ui_components";
import { Radio, Video, Map as MapIcon, Shield, Check, User, Plane, Clock, Share2, LayoutList, ChevronRight } from "lucide-react";
import { PendencyAlerts } from "../components/PendencyAlerts";
import { useNavigate } from "react-router-dom";
import { OperationalInfoTicker } from "../components/OperationalInfoTicker";

import { orgUnitService } from "../services/orgUnitService";

const iconCache: Record<string, L.DivIcon> = {};
const getCustomIcon = (color: string) => {
  if (!iconCache[color]) {
    iconCache[color] = L.divIcon({
      className: "custom-div-icon",
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.4);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }
  return iconCache[color];
};

const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 400);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const MapController = memo(({ activeOps }: { activeOps: Operation[] }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => { if (map.getContainer()) map.invalidateSize(); }, 300);
    const validOps = activeOps.filter(op => op.latitude && op.longitude);
    if (validOps.length > 0) {
      const bounds = L.latLngBounds(validOps.map(op => [Number(op.latitude), Number(op.longitude)]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
    return () => clearTimeout(timer);
  }, [map, activeOps]);
  return null;
});

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeOps, setActiveOps] = useState<Operation[]>([]);
  const [liveStreams, setLiveStreams] = useState<Operation[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [totalFlightHours, setTotalFlightHours] = useState(0);
  const [dashboardView, setDashboardView] = useState<'map' | 'panel'>('map'); 
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null); 

  const loadData = useCallback(async () => {
    try {
      const [ops, drn, pils] = await Promise.all([
        base44.entities.Operation.list('-start_time'),
        base44.entities.Drone.list(),
        base44.entities.Pilot.list()
      ]);
      const active = ops.filter(o => o.status === 'active');
      setActiveOps(active);
      setLiveStreams(active.filter(o => o.stream_url));
      setDrones(drn);
      setPilots(pils);
      setTotalFlightHours(drn.reduce((acc, d) => acc + (d.total_flight_hours || 0), 0));
      const me = await base44.auth.me();
      setCurrentUser(me);
    } catch (e: any) {}
  }, []);

  useEffect(() => {
    orgUnitService.seed();
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleShare = (op: Operation, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#/operations/${op.id}/gerenciar`;
    if (navigator.share) {
        navigator.share({ title: `SYSARP - ${op.name}`, text: `Acompanhe a operação RPA: ${op.name}`, url }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url);
        alert("Link copiado!");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      
      {/* Operational Ticker */}
      <div className="hidden lg:block shrink-0">
        <OperationalInfoTicker 
          totalOps={0} activeOpsCount={activeOps.length}
          pilotsCount={pilots.length} dronesCount={drones.length}
          totalFlightHours={totalFlightHours} activeTransmissions={liveStreams.length}
          alertsCount={0}
        />
      </div>

      {/* Header Mobile com Tabs */}
      <div className="lg:hidden flex bg-white border-b border-slate-200 shrink-0">
          <button 
            onClick={() => setDashboardView('map')} 
            className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${dashboardView === 'map' ? 'text-red-700 border-b-2 border-red-700 bg-slate-50' : 'text-slate-400'}`}
          >
              <MapIcon className="w-4 h-4" /> Mapa
          </button>
          <button 
            onClick={() => setDashboardView('panel')} 
            className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${dashboardView === 'panel' ? 'text-red-700 border-b-2 border-red-700 bg-slate-50' : 'text-slate-400'}`}
          >
              <LayoutList className="w-4 h-4" /> Operações
          </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row relative min-h-0">
        
        {/* Mapa Dash */}
        <div className={`flex-1 relative z-0 ${dashboardView === 'panel' ? 'hidden lg:block' : 'block h-full'}`}>
           <MapContainer center={[-25.25, -52.0]} zoom={7} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <MapController activeOps={activeOps} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {activeOps.map(op => (
                <Marker key={op.id} position={[op.latitude, op.longitude]} icon={getCustomIcon(MISSION_COLORS[op.mission_type])}>
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h4 className="font-bold text-sm uppercase">{op.name}</h4>
                      <div className="mt-2 flex flex-col gap-1 text-[10px] uppercase font-bold text-slate-500">
                         <span><User className="w-3 h-3 inline mr-1"/> {pilots.find(p => p.id === op.pilot_id)?.full_name.split(' ')[0]}</span>
                         <span><Plane className="w-3 h-3 inline mr-1"/> {drones.find(d => d.id === op.drone_id)?.prefix}</span>
                      </div>
                      <Button size="sm" className="w-full mt-3 h-8 text-[9px] font-black" onClick={() => navigate(`/operations/${op.id}/gerenciar`)}>ACESSAR CCO</Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
           </MapContainer>
        </div>

        {/* Painel de Controle Direito */}
        <div className={`w-full lg:w-[400px] bg-slate-50 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-200 shrink-0 ${dashboardView === 'map' ? 'hidden lg:flex' : 'flex h-full'}`}>
          
          <div className="p-5 flex items-center gap-3 shrink-0">
             <Shield className="w-5 h-5 text-red-700" />
             <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Painel de Controle</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-24 lg:pb-6 custom-scrollbar">
<PendencyAlerts currentUser={currentUser} />
            
            {/* Bloco Operações Ativas */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="bg-red-700 p-3 flex justify-between items-center text-white">
                  <div className="flex items-center gap-2">
                     <Radio className="w-4 h-4 animate-pulse" />
                     <span className="text-[10px] font-black uppercase tracking-wider">Operações Ativas</span>
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">{activeOps.length}</span>
               </div>
               
               <div className="p-3 space-y-3">
                  {activeOps.length === 0 ? (
                    <div className="py-10 text-center text-[10px] text-slate-400 font-bold uppercase italic">Sem aeronaves em voo</div>
                  ) : (
                    activeOps.map(op => {
                      const pilot = pilots.find(p => p.id === op.pilot_id);
                      const natureLabel = MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type;
                      
                      return (
                        <Card key={op.id} className="p-0 border-none shadow-sm hover:shadow-lg transition-all cursor-pointer relative group overflow-hidden bg-white" onClick={() => navigate(`/operations/${op.id}/gerenciar`)}>
                            <div className="flex flex-col">
                               {/* Top Bar */}
                               <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                                     <span className="text-[10px] font-black text-red-700 uppercase tracking-tight">Live</span>
                                  </div>
                                  <button onClick={(e) => handleShare(op, e)} className="p-1 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                     <Share2 className="w-3.5 h-3.5" />
                                  </button>
                               </div>

                               <div className="p-4">
                                  <div className="flex justify-between items-start mb-3">
                                     <h4 className="font-black text-slate-800 text-sm leading-tight uppercase line-clamp-2 flex-1">{op.name}</h4>
                                     <Badge variant="outline" className="ml-2 text-[8px] border-slate-200 text-slate-500 shrink-0">#{op.occurrence_number}</Badge>
                                  </div>

                                  <div className="flex items-center gap-2 mb-4">
                                     <div className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase">
                                        {natureLabel}
                                     </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                                      <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-700 font-black text-xs">
                                              {pilot?.full_name?.charAt(0) || 'P'}
                                          </div>
                                          <div className="flex flex-col">
                                              <span className="text-[7px] font-black text-slate-400 uppercase leading-none">Comandante</span>
                                              <span className="text-[10px] font-black text-slate-700 uppercase leading-none mt-1 truncate max-w-[80px]">{pilot?.full_name?.split(' ')[0] || '---'}</span>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2 justify-end">
                                          <div className="text-right">
                                              <span className="text-[7px] font-black text-slate-400 uppercase leading-none block">Decolagem</span>
                                              <span className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1 mt-1 justify-end">
                                                  <Clock className="w-3 h-3 text-slate-400" />
                                                  {new Date(op.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                              </span>
                                          </div>
                                      </div>
                                  </div>
                               </div>
                               
                               {/* Action Bar */}
                               <div className="px-4 py-2 bg-slate-900 text-white flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-[9px] font-black uppercase tracking-widest">Acessar CCO</span>
                                  <ChevronRight className="w-4 h-4" />
                               </div>
                            </div>
                        </Card>
                      );
                    })
                  )}
               </div>
            </div>

            {/* Bloco Transmissões */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="bg-[#1e293b] p-3 flex items-center gap-2 text-white">
                  <Video className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Transmissões</span>
               </div>
               <div className="p-6 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase italic">Nenhuma transmissão ativa.</p>
               </div>
            </div>

            {/* Bloco Tráfego Aéreo */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="bg-[#16a34a] p-3 flex items-center gap-2 text-white">
                  <Plane className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Tráfego Aéreo</span>
               </div>
               <div className="p-6 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase italic">Sem conflitos de espaço aéreo.</p>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
