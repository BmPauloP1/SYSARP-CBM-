import React, { useEffect, useState, useCallback, memo, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MISSION_COLORS, MISSION_LABELS, ConflictNotification, Maintenance } from "../types";
import { Badge, Button, Card } from "../components/ui_components";
import { Radio, Video, AlertTriangle, Map as MapIcon, Wrench, List, Shield, Check, Info, Share2, User, Plane, Building2, UserCheck, Navigation, Clock, History } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Fix Leaflet icons
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// CACHE FOR ICONS
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

const isValidCoord = (lat: any, lng: any) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
};

const MapController = memo(({ activeOps }: { activeOps: Operation[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Force resize
    setTimeout(() => { if (map.getContainer()) map.invalidateSize(); }, 250);

    const validOps = activeOps.filter(op => isValidCoord(op.latitude, op.longitude));
    
    if (validOps.length > 0) {
      // Focus on operations
      const bounds = L.latLngBounds(validOps.map(op => [Number(op.latitude), Number(op.longitude)]));
      if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
      }
    } else {
      // No operations: Focus on User Location
      map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true });
      
      // Fallback handlers if locate fails (optional, but good for UX)
      map.on('locationerror', () => {
         // Fallback to central Paraná if location denied
         map.setView([-24.5, -51.0], 7); 
      });
    }
  }, [map, activeOps]);

  return null;
});

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeOps, setActiveOps] = useState<Operation[]>([]);
  const [recentOps, setRecentOps] = useState<Operation[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<Maintenance[]>([]);
  const [conflictAlerts, setConflictAlerts] = useState<ConflictNotification[]>([]);
  const [liveStreams, setLiveStreams] = useState<Operation[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [pendingPilotsCount, setPendingPilotsCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  
  const isMounted = useRef(true);

  const loadData = useCallback(async () => {
    try {
      const [ops, maints, drn, pils, me] = await Promise.all([
        base44.entities.Operation.list('-start_time'),
        base44.entities.Maintenance.filter(m => m.status !== 'completed'),
        base44.entities.Drone.list(),
        base44.entities.Pilot.list(),
        base44.auth.me()
      ]);

      if (!isMounted.current) return;

      const active = ops.filter(o => o.status === 'active');
      const pendingCount = pils.filter(p => p.status === 'pending').length;
      
      setCurrentUser(me);
      setActiveOps(active);
      setRecentOps(ops.filter(o => o.status !== 'active').slice(0, 5)); // Apenas histórico no recent
      setMaintenanceAlerts(maints);
      setLiveStreams(active.filter(o => o.stream_url));
      setDrones(drn);
      setPilots(pils);
      setPendingPilotsCount(pendingCount);

      if (me) {
          const conflicts = await base44.entities.ConflictNotification.filter({ target_pilot_id: me.id, acknowledged: false });
          if(isMounted.current) setConflictAlerts(conflicts);
      }
    } catch (e: any) {
      console.warn("Dashboard load error:", e.message);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => { 
        isMounted.current = false;
        clearInterval(interval);
    };
  }, [loadData]);

  const handleAckConflict = async (id: string) => {
     try {
         await base44.entities.ConflictNotification.update(id, { acknowledged: true });
         setConflictAlerts(prev => prev.filter(c => c.id !== id));
     } catch (e) { console.error(e); }
  };

  const handleShareOp = async (op: Operation) => {
      const pilot = pilots.find(p => p.id === op.pilot_id);
      const startTime = new Date(op.start_time);
      const text = `🚨 *SYSARP - SITUAÇÃO OPERACIONAL* 🚨\n\n` +
          `🚁 *Ocorrência:* ${op.name}\n` +
          `🔢 *Protocolo:* ${op.occurrence_number}\n` +
          `👤 *Piloto:* ${pilot?.full_name || 'N/A'}\n` +
          `📍 *Coord:* ${op.latitude}, ${op.longitude}\n` +
          `🕒 *Início:* ${startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n`;

      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const mapMarkers = useMemo(() => {
    return activeOps.map(op => {
      if (!isValidCoord(op.latitude, op.longitude)) return null;

      const pilot = pilots.find(p => p.id === op.pilot_id);
      const drone = drones.find(d => d.id === op.drone_id);
      const opColor = MISSION_COLORS[op.mission_type] || '#ef4444';

      return (
          <Marker key={`active-op-${op.id}`} position={[Number(op.latitude), Number(op.longitude)]} icon={getCustomIcon(opColor)}>
            <Popup>
              <div className="min-w-[280px] p-1 font-sans">
                <h3 className="font-bold text-slate-900 text-base uppercase leading-tight border-b pb-2 mb-2">{op.name}</h3>
                <p className="text-[10px] text-slate-400 font-mono mb-2">#{op.occurrence_number}</p>
                
                <div className="mb-4">
                   <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
                      {MISSION_HIERARCHY[op.mission_type]?.label}
                   </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 border border-slate-100">
                   <div className="flex items-center gap-3 text-sm text-slate-600">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                         <span className="font-bold text-slate-800">Piloto:</span> {pilot?.full_name || 'N/A'}
                      </div>
                   </div>
                   <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Plane className="w-4 h-4 text-slate-400" />
                      <div>
                         <span className="font-bold text-slate-800">RPA:</span> {drone ? `${drone.prefix} - ${drone.model}` : 'N/A'}
                      </div>
                   </div>
                   <div className="flex items-start gap-3 text-sm text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div className="flex flex-col">
                         <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-800">Área/Unidade:</span>
                            <span className="text-slate-700">{drone?.unit || 'N/A'}</span>
                         </div>
                         <span className="text-[10px] text-slate-400 mt-0.5">{drone?.crbm}</span>
                      </div>
                   </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                   <span className="flex items-center gap-1"><Clock className="w-3" /> {new Date(op.start_time).toLocaleTimeString()}</span>
                   <span className="flex items-center gap-1"><Navigation className="w-3" /> Raio: {op.radius}m</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
    });
  }, [activeOps, pilots, drones]);

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-600 animate-pulse" />
            CCO - SYSARP
          </h1>
        </div>
        <div className="flex gap-3">
           <div className="px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-center gap-2">
              <span className="font-bold text-sm">{activeOps.length} Ops Ativas</span>
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        <div className="w-full lg:flex-1 h-[50vh] lg:h-auto relative border-r border-slate-200 shadow-inner z-0">
           <MapContainer center={[-25.2521, -52.0215]} zoom={7} style={{ height: '100%', width: '100%' }}>
              <MapController activeOps={activeOps} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapMarkers}
           </MapContainer>
        </div>

        <div className="w-full lg:w-96 h-[50vh] lg:h-auto bg-slate-100 flex flex-col overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-200 z-10 flex-shrink-0">
          <div className="p-4 bg-white border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2 shadow-sm flex-shrink-0">
            <Shield className="w-5 h-5 text-red-700" />
            Painel de Controle
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* ALERTA ADMIN DE CADASTROS */}
            {currentUser?.role === 'admin' && pendingPilotsCount > 0 && (
              <Card className="p-4 bg-amber-600 text-white border-none shadow-lg animate-pulse border-l-4 border-l-amber-400">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                         <UserCheck className="w-6 h-6" />
                      </div>
                      <div>
                         <h3 className="font-bold text-sm">Validações Pendentes</h3>
                         <p className="text-[10px] text-amber-100">{pendingPilotsCount} novos pilotos aguardando acesso.</p>
                      </div>
                   </div>
                   <Button 
                      size="sm" 
                      className="bg-white text-amber-700 hover:bg-amber-50 h-8 text-[10px] font-bold"
                      onClick={() => navigate('/pilots')}
                   >
                      VALIDAR
                   </Button>
                </div>
              </Card>
            )}

            {/* SEÇÃO PRINCIPAL: OPERAÇÕES EM ANDAMENTO */}
            <div className="bg-white rounded-xl shadow-md border border-red-100 overflow-hidden ring-1 ring-red-50">
              <div className="bg-gradient-to-r from-red-700 to-red-600 px-4 py-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
                  <Radio className="w-4 h-4 animate-pulse" /> Operações Ativas
                </h3>
                <Badge variant="default" className="bg-white/20 text-white border-0 text-[10px]">{activeOps.length}</Badge>
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-0">
                {activeOps.length === 0 ? (
                   <div className="p-8 text-center">
                      <div className="bg-slate-50 p-3 rounded-full inline-block mb-3 border border-slate-100"><Check className="w-6 h-6 text-slate-300" /></div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Sem operações no momento</p>
                   </div>
                ) : (
                   <div className="divide-y divide-slate-100">
                      {activeOps.map(op => {
                         const pilot = pilots.find(p => p.id === op.pilot_id);
                         const drone = drones.find(d => d.id === op.drone_id);
                         return (
                           <div key={op.id} className="p-3 hover:bg-red-50/30 transition-colors group relative">
                              <div className="absolute left-0 top-3 bottom-3 w-1 bg-red-600 rounded-r opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <div className="flex justify-between items-start mb-1.5 pl-2">
                                 <span className="text-[9px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse shadow-sm"></span>
                                    Em Andamento
                                 </span>
                                 <button onClick={() => handleShareOp(op)} className="text-slate-300 hover:text-green-600 transition-colors bg-white hover:bg-green-50 p-1.5 rounded border border-transparent hover:border-green-100"><Share2 className="w-3.5 h-3.5" /></button>
                              </div>
                              <div className="pl-2">
                                  <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate pr-2">{op.name}</h4>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2.5">
                                     <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono border border-slate-200">#{op.occurrence_number.split('ARP').pop()}</span>
                                     <span>•</span>
                                     <span className="truncate max-w-[120px]">{MISSION_HIERARCHY[op.mission_type]?.label}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                     <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                                           {pilot?.full_name?.[0]}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase leading-none">PIC</span>
                                            <span className="text-[10px] text-slate-700 font-bold truncate leading-none mt-0.5">{pilot?.full_name?.split(' ')[0] || 'N/A'}</span>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-1.5 min-w-0 justify-end">
                                        <div className="flex flex-col min-w-0 text-right">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase leading-none">Início</span>
                                            <span className="text-[10px] font-mono text-slate-700 font-bold leading-none mt-0.5">
                                                {new Date(op.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                           <Clock className="w-3 h-3" />
                                        </div>
                                     </div>
                                  </div>
                              </div>
                           </div>
                         );
                      })}
                   </div>
                )}
              </div>
            </div>

            {/* TRANSMISSÕES */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-2 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
                  <Video className="w-3 h-3" /> Transmissões
                </h3>
              </div>
              <div className="p-3">
                {liveStreams.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-2">Nenhuma transmissão ativa.</p>
                ) : (
                  liveStreams.map(op => (
                    <div key={op.id} className="p-2 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center mb-1 last:mb-0">
                       <span className="text-xs font-bold text-slate-800 truncate">{op.name}</span>
                       <a href="#/transmissions" className="text-red-600 hover:text-red-800"><Video className="w-4 h-4" /></a>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TRÁFEGO AÉREO / CONFLITOS */}
            <div className={`bg-white rounded-xl shadow-sm border ${conflictAlerts.length > 0 ? 'border-red-500' : 'border-green-200'} overflow-hidden`}>
              <div className={`${conflictAlerts.length > 0 ? 'bg-red-600 animate-pulse' : 'bg-green-600'} px-4 py-2 flex justify-between items-center`}>
                <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
                  <Shield className="w-3 h-3" /> Tráfego Aéreo
                </h3>
              </div>
              <div className="p-3">
                 {conflictAlerts.length === 0 ? (
                    <div className="text-xs text-green-700 bg-green-50 p-2 rounded text-center font-medium">Sem conflitos de espaço aéreo.</div>
                 ) : (
                    conflictAlerts.map(alert => (
                       <div key={alert.id} className="bg-red-50 p-2 rounded text-[10px] flex justify-between items-center mb-2 last:mb-0 border border-red-100">
                          <span className="font-bold text-red-800">{alert.new_op_name}</span>
                          <Button size="sm" className="h-6 text-[9px] bg-red-600 hover:bg-red-700 text-white" onClick={() => handleAckConflict(alert.id)}>CIENTE</Button>
                       </div>
                    ))
                 )}
              </div>
            </div>

            {/* HISTÓRICO RECENTE (ANTIGO 'OPERAÇÕES RECENTES') */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <History className="w-3 h-3" /> Histórico Recente
                </h3>
              </div>
              <div className="p-2 space-y-1">
                {recentOps.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-2">Sem histórico recente.</p>
                ) : (
                    recentOps.map(op => (
                       <div key={op.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                          <div className="min-w-0 flex-1">
                             <p className="text-xs font-bold text-slate-700 truncate">{op.name}</p>
                             <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-slate-400 font-mono bg-slate-100 px-1 rounded">#{op.occurrence_number.split('ARP').pop()}</span>
                                <span className={`text-[9px] font-bold px-1.5 rounded-full ${op.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {op.status === 'completed' ? 'CONCLUÍDA' : 'CANCELADA'}
                                </span>
                             </div>
                          </div>
                       </div>
                    ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}