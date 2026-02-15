
import React, { useEffect, useState, useCallback, memo, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MISSION_COLORS, ConflictNotification, Maintenance } from "../types";
import { Badge, Button, Card } from "../components/ui_components";
import { Radio, Video, Map as MapIcon, Shield, Check, User, Plane, Clock, Share2, LayoutList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OperationalInfoTicker } from "../components/OperationalInfoTicker";

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

  const loadData = useCallback(async () => {
    try {
      const [ops, drn, pils, me] = await Promise.all([
        base44.entities.Operation.list('-start_time'),
        base44.entities.Drone.list(),
        base44.entities.Pilot.list(),
        base44.auth.me()
      ]);
      const active = ops.filter(o => o.status === 'active');
      setActiveOps(active);
      setLiveStreams(active.filter(o => o.stream_url));
      setDrones(drn);
      setPilots(pils);
      setTotalFlightHours(drn.reduce((acc, d) => acc + (d.total_flight_hours || 0), 0));
    } catch (e: any) {}
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      
      {/* Operational Ticker - Otimizado para Mobile */}
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

        {/* Lateral Info */}
        <div className={`w-full lg:w-96 bg-white flex flex-col border-t lg:border-t-0 lg:border-l border-slate-200 shrink-0 ${dashboardView === 'map' ? 'hidden lg:flex' : 'flex h-full'}`}>
          <div className="p-4 bg-white border-b border-slate-200 font-black text-slate-800 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-red-700" /> Operações Ativas</div>
            <Badge variant="danger" className="text-[10px]">{activeOps.length}</Badge>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 lg:pb-4 custom-scrollbar">
            {activeOps.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-400 font-bold uppercase italic">Sem aeronaves em voo</div>
            ) : (
                activeOps.map(op => (
                   <Card key={op.id} className="p-4 hover:bg-slate-50 transition-all border border-slate-100 shadow-md group cursor-pointer" onClick={() => navigate(`/operations/${op.id}/gerenciar`)}>
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[9px] font-black text-red-600 uppercase flex items-center gap-1.5 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-red-600"></div> LIVE
                         </span>
                         <Badge className="bg-slate-100 text-slate-600 text-[8px] uppercase">{MISSION_HIERARCHY[op.mission_type].label.split('. ')[1]}</Badge>
                      </div>
                      <h4 className="font-black text-slate-800 text-sm leading-tight uppercase group-hover:text-red-700">{op.name}</h4>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                         <span className="text-[10px] text-slate-400 font-bold uppercase"><Clock className="w-3 h-3 inline mr-1" /> {new Date(op.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                         <button className="text-[9px] font-black text-white bg-slate-900 px-3 py-1.5 rounded-lg shadow-lg">DETALHES</button>
                      </div>
                   </Card>
                ))
            )}
            
            {liveStreams.length > 0 && (
                <div className="mt-8">
                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-red-600"/> Links de Transmissão
                   </h5>
                   <div className="space-y-2">
                      {liveStreams.map(op => (
                         <div key={op.id} className="p-3 bg-slate-900 rounded-xl flex items-center justify-between border border-slate-800 shadow-lg">
                            <div className="min-w-0 flex-1">
                               <p className="text-white text-[10px] font-black uppercase truncate">{op.name}</p>
                               <p className="text-red-500 text-[8px] font-bold animate-pulse uppercase">Câmera Ativa</p>
                            </div>
                            <button onClick={() => navigate('/transmissions')} className="p-2 bg-red-600 text-white rounded-lg ml-3"><Video className="w-4 h-4"/></button>
                         </div>
                      ))}
                   </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
