import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polygon, Polyline } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { base44 } from "../services/base44Client";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MISSION_COLORS, MISSION_LABELS, ORGANIZATION_CHART, MissionType } from "../types";
import { SUMMER_LOCATIONS } from "../types_summer";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
import { 
  Plus, Clock, User, X, Radio, Plane, 
  Shield, MapPin, LocateFixed, Users, 
  Share2, Play, Pause, Pencil, CheckCircle, 
  Crosshair, Loader2, Save, FileText, Navigation, LayoutList, Map as MapIcon,
  Sun, Calendar, Zap, Flag, Hexagon, Route,
  Video, ChevronDown, CheckSquare, Square, Building2, Phone, SaveIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom"; 

// Mapeamento de Coordenadas das Sedes (Bases) do CBMPR
const UNIT_COORDINATES: Record<string, [number, number]> = {
  "1º BBM - Curitiba": [-25.4370, -49.2700],
  "2º BBM - Ponta Grossa": [-25.0950, -50.1613],
  "3º BBM - Londrina": [-23.3106, -51.1628],
  "4º BBM - Cascavel": [-24.9555, -53.4552],
  "5º BBM - Maringá": [-23.4209, -51.9331],
  "6º BBM - São José dos Pinhais": [-25.5348, -49.2064],
  "7º BBM - Colombo": [-25.2925, -49.2244],
  "8º BBM - Paranaguá": [-25.5204, -48.5093],
  "9º BBM - Foz do Iguaçu": [-25.5478, -54.5881],
  "10º BBM - Francisco Beltrão": [-26.0779, -53.0518],
  "11º BBM - Apucarana": [-23.5505, -51.4614],
  "12º BBM - Guarapuava": [-25.3907, -51.4628],
  "13º BBM - Pato Branco": [-26.2275, -52.6711],
  "1ª CIBM - Ivaiporã": [-24.2478, -51.6834],
  "2ª CIBM - Umuarama": [-23.7664, -53.3206],
  "3ª CIBM - Santo Antônio da Platina": [-23.2944, -50.0789],
  "4ª CIBM - Cianorte": [-23.6631, -52.6047],
  "5ª CIBM - Paranavaí": [-23.0848, -52.4633],
  "6ª CIBM - Irati": [-25.4672, -50.6511],
  "BOA - Batalhão de Operações Aéreas": [-25.4032, -49.2321],
  "GOST - Grupo de Operações de Socorro Tático": [-25.4431, -49.2455],
  "CCB (QCGBM) - Quartel do Comando Geral": [-25.4375, -49.2715],
  "FORÇA TAREFA (FT) - Resposta a Desastres": [-25.4400, -49.2750]
};

const handleWhatsAppContact = (phone: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
};

const getOrgShortCode = (label: string) => {
    if (!label) return '';
    const part = label.split(' - ')[0];
    return part.replace(/[ºª.]/g, '').replace(/\s/g, '').toUpperCase();
};

const calculateNextOccurrenceNumber = (crbm: string, unit: string, allOps: Operation[]) => {
    const year = new Date().getFullYear();
    const targetOrg = unit ? unit : crbm;
    const shortCode = getOrgShortCode(targetOrg);
    const prefix = `${year}ARP${shortCode}`;
    const relevantOps = allOps.filter(o => o.occurrence_number && o.occurrence_number.startsWith(prefix));
    let maxSeq = 0;
    relevantOps.forEach(op => {
        const seqPart = op.occurrence_number.replace(prefix, '');
        const seq = parseInt(seqPart, 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });
    const nextSeq = (maxSeq + 1).toString().padStart(5, '0');
    return `${prefix}${nextSeq}`;
};

const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => { map.invalidateSize(); }, 500);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const DrawingManager = ({ drawMode, onShapeCreated }: { drawMode: string | null, onShapeCreated: (geojson: any, mode: string) => void }) => {
    const map = useMap();
    useEffect(() => {
        if (!map || !(map as any).pm) return;
        const pm = (map as any).pm;
        pm.setPathOptions({ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2 });
        pm.disableDraw();
        if (drawMode === 'pc') pm.enableDraw('Marker', { snappable: true });
        else if (drawMode === 'area') pm.enableDraw('Polygon', { snappable: true });
        else if (drawMode === 'route') pm.enableDraw('Line', { snappable: true });
        else if (drawMode === 'poi') pm.enableDraw('Marker', { snappable: true });
        const handleCreate = (e: any) => {
            const geojson = e.layer.toGeoJSON();
            onShapeCreated(geojson, drawMode || '');
            map.removeLayer(e.layer);
        };
        map.on('pm:create', handleCreate);
        return () => { map.off('pm:create', handleCreate); };
    }, [map, drawMode, onShapeCreated]);
    return null;
};

const LocationSelectorMap = ({ center, radius, shapes }: any) => {
    return (
        <>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Circle center={center} radius={radius} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, dashArray: '5, 10', weight: 2 }} />
            <Marker position={center} icon={L.divIcon({ className: '', html: '<div style="background-color: #ef4444; width: 18px; height: 18px; border: 3.5px solid white; border-radius: 50%; box-shadow: 0 0 12px rgba(0,0,0,0.5);"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })}>
               <Popup><span className="font-bold text-xs uppercase">Ponto Zero (PC)</span></Popup>
            </Marker>
            {shapes && Array.isArray(shapes.features) && shapes.features.map((f: any, i: number) => {
                if (f.geometry.type === 'Polygon') return <Polygon key={i} positions={L.GeoJSON.coordsToLatLngs(f.geometry.coordinates, 1) as any} pathOptions={{ color: '#ef4444', fillOpacity: 0.1 }} />;
                if (f.geometry.type === 'LineString') return <Polyline key={i} positions={L.GeoJSON.coordsToLatLngs(f.geometry.coordinates, 0) as any} pathOptions={{ color: '#f97316', weight: 4 }} />;
                if (f.geometry.type === 'Point') return <Marker key={i} position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]} icon={L.divIcon({ className: '', html: '<div style="background-color: #3b82f6; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%;"></div>' })} />;
                return null;
            })}
        </>
    );
};

export default function OperationManagement() {
  const navigate = useNavigate();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list'); 
  const [loading, setLoading] = useState(false);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [drawMode, setDrawMode] = useState<string | null>(null);
  const [controlModal, setControlModal] = useState<{type: 'pause' | 'cancel' | 'end' | null, op: Operation | null}>({type: null, op: null});
  const [flightDurationStr, setFlightDurationStr] = useState("00:00");
  const [actionsTaken, setActionsTaken] = useState('');
  const [mapLayers, setMapLayers] = useState({ ops: true, drones: false, pilots: false, bases: false });

  const modalMapRef = useRef<L.Map | null>(null);

  const [formData, setFormData] = useState({ 
    id: '', name: '', occurrence_number: '', mission_type: 'diverse' as any, sub_mission_type: '', pilot_id: '', observer_name: '', drone_id: '', 
    latitude: -25.42, longitude: -49.27, radius: 200, flight_altitude: 60, description: '', stream_url: '', sarpas_protocol: '',
    is_summer_op: false, is_multi_day: false, op_crbm: '', op_unit: '', start_date: new Date().toISOString().split('T')[0],
    start_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}), estimated_end_time: '', takeoff_points: [] as any[], 
    shapes: { type: 'FeatureCollection', features: [] } as any, summer_city: '', summer_pgv: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ops, pils, drns] = await Promise.all([ base44.entities.Operation.list('-created_at'), base44.entities.Pilot.list(), base44.entities.Drone.list() ]);
      setOperations(ops); setPilots(pils); setDrones(drns);
    } catch(e) {}
  };

  const handleLocateMeInModal = () => {
      if (!navigator.geolocation) { alert("GPS não disponível."); return; }
      setDrawMode(null);
      navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          setFormData(prev => ({ ...prev, latitude, longitude }));
          if (modalMapRef.current) modalMapRef.current.flyTo([latitude, longitude], 17);
      }, () => alert("Erro ao obter GPS."), { enableHighAccuracy: true });
  };

  const handleShapeCreated = (geojson: any, mode: string) => {
      if (mode === 'pc') { const [lng, lat] = geojson.geometry.coordinates; setFormData(prev => ({ ...prev, latitude: lat, longitude: lng })); }
      else { setFormData(prev => ({ ...prev, shapes: { ...prev.shapes, features: [...prev.shapes.features, geojson] } })); }
      setDrawMode(null);
  };

  const handleOpenNewMission = () => {
      setFormData({ 
        id: '', name: '', occurrence_number: '', mission_type: 'diverse', sub_mission_type: '', pilot_id: '', observer_name: '', drone_id: '', 
        latitude: -25.42, longitude: -49.27, radius: 200, flight_altitude: 60, description: '', stream_url: '', sarpas_protocol: '', 
        is_summer_op: false, is_multi_day: false, op_crbm: '', op_unit: '', start_date: new Date().toISOString().split('T')[0], 
        start_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}), estimated_end_time: '', takeoff_points: [], 
        shapes: { type: 'FeatureCollection', features: [] }, summer_city: '', summer_pgv: ''
      });
      setIsMissionModalOpen(true);
  };

  const handleSaveMission = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const localStartDate = new Date(`${formData.start_date}T${formData.start_time}:00`);
          let estimatedEndISO = formData.estimated_end_time ? new Date(`${formData.start_date}T${formData.estimated_end_time}:00`).toISOString() : undefined;
          const { id, start_date, start_time, estimated_end_time, summer_city, summer_pgv, ...payloadBase } = formData;
          
          let finalName = formData.name;
          if (formData.is_summer_op && summer_city) {
              finalName = `VERÃO: ${summer_city} - ${summer_pgv || 'Geral'}`;
          }

          const finalPayload: any = { 
              ...payloadBase, name: finalName || "Missão Sem Título", start_time: localStartDate.toISOString(), estimated_end_time: estimatedEndISO, 
              latitude: Number(formData.latitude), longitude: Number(formData.longitude), radius: Number(formData.radius), flight_altitude: Number(formData.flight_altitude), status: 'active'
          };

          let targetId = id;
          if (id && id.length > 5) {
              await base44.entities.Operation.update(id, finalPayload);
          } else {
              const allOps = await base44.entities.Operation.list();
              const nextOccurrence = calculateNextOccurrenceNumber(formData.op_crbm, formData.op_unit, allOps);
              finalPayload.occurrence_number = nextOccurrence;
              const newOp = await base44.entities.Operation.create(finalPayload);
              targetId = newOp.id;
              if (formData.drone_id) await base44.entities.Drone.update(formData.drone_id, { status: 'in_operation' });
          }
          
          setIsMissionModalOpen(false); 
          loadData();

          if (formData.is_multi_day && targetId) {
              navigate(`/operations/${targetId}/gerenciar`);
          }
      } catch(err: any) { alert("Erro ao salvar missão."); } finally { setLoading(false); }
  };

  const handleShare = (op: Operation) => {
      const pilot = pilots.find(p => p.id === op.pilot_id);
      const drone = drones.find(d => d.id === op.drone_id);
      const nature = MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type;
      
      const startTime = new Date(op.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const endTime = op.estimated_end_time ? new Date(op.estimated_end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/D';

      const message = `🚨 SYSARP - SITUAÇÃO OPERACIONAL 🚨

🚁 Ocorrência: ${op.name.toUpperCase()}
🔢 Protocolo: ${op.occurrence_number}
📋 Natureza: ${nature}

👤 PIC: ${pilot?.full_name || 'Não atribuído'}
📞 Contato: ${pilot?.phone || 'Não disponível'}
🛡️ Aeronave: ${drone?.prefix || 'Não atribuída'} (${drone?.model || 'Modelo N/D'})

📍 Coord: ${op.latitude.toFixed(6)}, ${op.longitude.toFixed(6)}
🗺️ Google Maps: https://www.google.com/maps?q=${op.latitude},${op.longitude}

📏 Raio: ${op.radius}m
✈️ Altitude: ${op.flight_altitude || 60}m

🕒 Início: ${startTime}
🏁 Término Previsto: ${endTime}`;

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  const handleResume = async (op: Operation) => {
      setLoading(true);
      try { await base44.entities.Operation.update(op.id, { is_paused: false }); loadData(); } catch(e) {} finally { setLoading(false); }
  };

  const handleAction = async (e: React.FormEvent) => {
      e.preventDefault();
      const op = controlModal.op;
      if (!op) return;
      setLoading(true);
      try {
          if (controlModal.type === 'pause') {
              const currentLogs = op.pause_logs || [];
              await base44.entities.Operation.update(op.id, { is_paused: true, last_pause_start: new Date().toISOString(), pause_logs: [...currentLogs, { start: new Date().toISOString(), reason: actionsTaken }] });
          } else if (controlModal.type === 'cancel') {
              await base44.entities.Operation.update(op.id, { status: 'cancelled' });
              if (op.drone_id) await base44.entities.Drone.update(op.drone_id, { status: 'available' });
          } else if (controlModal.type === 'end') {
              let decimalHours = 0; const parts = flightDurationStr.split(':');
              if (parts.length === 2) decimalHours = Number(parts[0]) + (Number(parts[1]) / 60);
              await base44.entities.Operation.update(op.id, { status: 'completed', flight_hours: decimalHours, actions_taken: actionsTaken, end_time: new Date().toISOString() });
              if (op.drone_id) await base44.entities.Drone.update(op.drone_id, { status: 'available' });
          }
          setControlModal({type: null, op: null}); setActionsTaken(''); loadData();
      } catch(e) {} finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-100 overflow-hidden relative">
      <div className="lg:hidden flex bg-white border-b border-slate-200 shrink-0">
          <button onClick={() => setMobileView('list')} className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${mobileView === 'list' ? 'text-red-700 border-b-2 border-red-700 bg-slate-50' : 'text-slate-400'}`}><LayoutList className="w-4 h-4" /> Missões</button>
          <button onClick={() => setMobileView('map')} className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${mobileView === 'map' ? 'text-red-700 border-b-2 border-red-700 bg-slate-50' : 'text-slate-400'}`}><MapIcon className="w-4 h-4" /> Mapa</button>
      </div>

      <div className={`flex-1 relative z-0 ${mobileView === 'list' ? 'hidden lg:block' : 'block h-full'}`}>
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
              <button onClick={() => setMapLayers(prev => ({ ...prev, ops: !prev.ops }))} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-xl transition-all border-2 ${mapLayers.ops ? 'bg-red-700 text-white border-red-800 scale-105' : 'bg-white/90 backdrop-blur text-slate-400 border-slate-100'}`}><Radio className={`w-4 h-4 ${mapLayers.ops ? 'animate-pulse' : ''}`} /> <span className="hidden lg:inline">Operações</span></button>
              <button onClick={() => setMapLayers(prev => ({ ...prev, drones: !prev.drones }))} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-xl transition-all border-2 ${mapLayers.drones ? 'bg-orange-600 text-white border-orange-700 scale-105' : 'bg-white/90 backdrop-blur text-slate-400 border-slate-100'}`}><Plane className="w-4 h-4" /> <span className="hidden lg:inline">Aeronaves</span></button>
              <button onClick={() => setMapLayers(prev => ({ ...prev, pilots: !prev.pilots }))} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-xl transition-all border-2 ${mapLayers.pilots ? 'bg-blue-600 text-white border-blue-700 scale-105' : 'bg-white/90 backdrop-blur text-slate-400 border-slate-100'}`}><Users className="w-4 h-4" /> <span className="hidden lg:inline">Pilotos</span></button>
              <button onClick={() => setMapLayers(prev => ({ ...prev, bases: !prev.bases }))} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-xl transition-all border-2 ${mapLayers.bases ? 'bg-slate-800 text-white border-slate-900 scale-105' : 'bg-white/90 backdrop-blur text-slate-400 border-slate-100'}`}><Shield className="w-4 h-4" /> <span className="hidden lg:inline">Bases / Sedes</span></button>
          </div>

          <MapContainer center={[-24.8, -51.5]} zoom={7} style={{ height: '100%', width: '100%' }}>
              <MapResizer />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {mapLayers.ops && operations.filter(o => o.status === 'active').map(op => (
                  <Marker key={op.id} position={[op.latitude, op.longitude]} icon={L.divIcon({ className: 'op-marker', html: `<div style="background-color: ${MISSION_COLORS[op.mission_type]}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>`, iconSize: [14, 14] })}>
                    <Popup><div className="p-1 min-w-[200px]"><h4 className="font-black text-xs uppercase leading-tight">{op.name}</h4><p className="text-[10px] text-slate-500 font-mono mt-1">#{op.occurrence_number}</p><Button size="sm" className="w-full mt-3 h-8 text-[9px] font-black uppercase" onClick={() => navigate(`/operations/${op.id}/gerenciar`)}>CENTRO TÁTICO</Button></div></Popup>
                  </Marker>
              ))}

              {mapLayers.bases && Object.entries(UNIT_COORDINATES).map(([name, coords]) => (
                  <Marker key={name} position={coords} icon={L.divIcon({ className: '', html: `<div style="background-color: #1e293b; width: 24px; height: 24px; border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4);"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 14px; height: 14px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>`, iconSize: [24, 24] })}>
                      <Popup><div className="p-1"><p className="font-black text-xs uppercase">{name}</p><p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Sede Administrativa / Operacional</p></div></Popup>
                  </Marker>
              ))}

              {mapLayers.drones && Object.entries(UNIT_COORDINATES).map(([unitName, coords]) => {
                  const unitDrones = drones.filter(d => d.unit === unitName);
                  if (unitDrones.length === 0) return null;
                  return (
                    <Marker key={`unit-drone-${unitName}`} position={coords} icon={L.divIcon({ className: '', html: `<div style="background-color: #ea580c; width: 26px; height: 26px; border: 2.5px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 16px; height: 16px;"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M12 12v-4" /><circle cx="4.5" cy="9" r="2" /><circle cx="19.5" cy="9" r="2" /></svg></div>`, iconSize: [26, 26] })}>
                        <Popup><div className="p-2 min-w-[220px]"><h4 className="font-black text-xs uppercase border-b pb-2 mb-2 text-orange-700">{unitName} - Frota ({unitDrones.length})</h4><div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">{unitDrones.map(d => (<div key={d.id} className="bg-slate-50 p-2 rounded-lg border border-slate-100"><p className="font-black text-[10px] text-slate-800 uppercase leading-none">{d.prefix}</p><p className="text-[9px] text-slate-500 uppercase mt-1">{d.model}</p></div>))}</div></div></Popup>
                    </Marker>
                  );
              })}

              {mapLayers.pilots && Object.entries(UNIT_COORDINATES).map(([unitName, coords]) => {
                  const unitPilots = pilots.filter(p => p.unit === unitName && p.status === 'active');
                  if (unitPilots.length === 0) return null;
                  return (
                    <Marker key={`unit-pilot-${unitName}`} position={coords} icon={L.divIcon({ className: '', html: `<div style="background-color: #2563eb; width: 24px; height: 24px; border: 2.5px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width: 12px; height: 12px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`, iconSize: [24, 24] })}>
                        <Popup><div className="p-2 min-w-[220px]"><h4 className="font-black text-xs uppercase border-b pb-2 mb-2 text-blue-700">{unitName} - Efetivo ({unitPilots.length})</h4><div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">{unitPilots.map(p => (<div key={p.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm"><div className="min-w-0 flex-1 mr-2"><p className="font-black text-[10px] text-slate-800 uppercase leading-none truncate">{p.full_name}</p></div><button onClick={() => handleWhatsAppContact(p.phone)} className="p-2 bg-green-500 text-white rounded-full shadow-md"><Phone className="w-3 h-3 fill-white" /></button></div>))}</div></div></Popup>
                    </Marker>
                  );
              })}
          </MapContainer>
      </div>

      <div className={`${mobileView === 'map' ? 'hidden lg:flex' : 'flex'} w-full lg:w-[450px] bg-white flex flex-col shadow-2xl z-10 border-l border-slate-200 overflow-hidden`}>
          <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
            <div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Missões RPA</h2><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Corpo de Bombeiros Militar</p></div>
            <Button onClick={handleOpenNewMission} className="bg-red-700 hover:bg-red-800 text-white h-11 px-5 font-black text-[11px] uppercase shadow-lg transition-transform active:scale-95"><Plus className="w-4 h-4 mr-2" /> Nova Missão</Button>
          </div>
          
          <div className="flex p-2 bg-slate-100 mx-6 mt-6 rounded-2xl shrink-0 border border-slate-200">
            <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'active' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Ativas</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Histórico</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white pb-24 lg:pb-6">
              {activeTab === 'active' ? (
                  operations.filter(o => o.status === 'active').map(op => {
                    const pilot = pilots.find(p => p.id === op.pilot_id);
                    const isPaused = op.is_paused === true;
                    return (
                      <Card key={op.id} className="bg-white border-l-[6px] border-l-red-600 shadow-xl p-6 flex flex-col gap-4 relative transition-all group hover:border-l-red-700">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1"><h4 className="font-black text-slate-900 text-lg uppercase leading-none truncate group-hover:text-red-700 transition-colors">{op.name}</h4><p className="text-[10px] font-mono text-slate-400 mt-2 uppercase font-black tracking-tighter">#{op.occurrence_number}</p></div>
                            {isPaused && <Badge className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase ring-1 ring-amber-200">PAUSADA</Badge>}
                          </div>
                          <div className="space-y-2 text-[11px] font-black text-slate-500 uppercase tracking-tighter bg-slate-50 p-3 rounded-xl border border-slate-100"><div className="flex items-center gap-3"><Clock className="w-4 h-4 text-red-400" /><span>{new Date(op.start_time).toLocaleString()}</span></div><div className="flex items-center gap-3"><User className="w-4 h-4 text-blue-400" /><span className="truncate">PIC: {pilot?.full_name}</span></div></div>
                          <div className="grid grid-cols-4 gap-2">
                             <button onClick={(e) => { e.stopPropagation(); isPaused ? handleResume(op) : setControlModal({type: 'pause', op}); }} className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${isPaused ? 'bg-green-50 text-green-600 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}><div className="w-5 h-5">{isPaused ? <Play /> : <Pause />}</div><span className="text-[8px] font-black mt-1 uppercase">{isPaused ? 'Retomar' : 'Pausar'}</span></button>
                             <button onClick={() => { setFormData({...op} as any); setIsMissionModalOpen(true); }} className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600"><Pencil className="w-5 h-5"/><span className="text-[8px] font-black mt-1 uppercase">Editar</span></button>
                             <button onClick={() => handleShare(op)} className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200 bg-slate-50 text-blue-600"><Share2 className="w-5 h-5"/><span className="text-[8px] font-black mt-1 uppercase">Partilhar</span></button>
                             <button onClick={() => navigate(`/operations/${op.id}/gerenciar`)} className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 text-white font-black uppercase text-[10px]"><Crosshair className="w-5 h-5 text-red-500 animate-pulse"/> TÁTICO</button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                             <button onClick={() => setControlModal({type: 'cancel', op})} className="h-11 rounded-xl border border-slate-200 text-slate-500 font-black text-[11px] uppercase">X Cancelar</button>
                             <button onClick={() => setControlModal({type: 'end', op})} className="h-11 rounded-xl bg-red-600 text-white font-black text-[11px] uppercase">✓ Encerrar</button>
                          </div>
                      </Card>
                    );
                  })
              ) : (
                  operations.filter(o => o.status !== 'active').map(op => (
                    <Card key={op.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center shadow-sm opacity-80">
                        <div className="min-w-0 flex-1"><p className="font-black text-slate-700 text-xs truncate uppercase leading-none">{op.name}</p><p className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase font-black">#{op.occurrence_number} • {new Date(op.start_time).toLocaleDateString()}</p></div>
                        <Badge variant={op.status === 'completed' ? 'success' : 'danger'} className="text-[9px] font-black uppercase">{op.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}</Badge>
                    </Card>
                  ))
              )}
          </div>
      </div>

      {/* MODAL DE CONTROLE */}
      {controlModal.type && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
              <Card className="w-full max-w-md bg-white shadow-2xl rounded-3xl overflow-hidden border-t-8 border-red-600">
                  <div className="p-8">
                      <h3 className="text-xl font-black uppercase mb-6">{controlModal.type === 'pause' ? 'Pausar Missão' : controlModal.type === 'cancel' ? 'Cancelar Missão' : 'Encerrar Missão'}</h3>
                      <form onSubmit={handleAction} className="space-y-5">
                          {controlModal.type === 'end' && <Input label="Horas de Voo" value={flightDurationStr} onChange={e => setFlightDurationStr(e.target.value)} placeholder="00:00" />}
                          <textarea required className="w-full p-4 border border-slate-200 rounded-2xl text-sm h-32 resize-none" placeholder="Relato das ações..." value={actionsTaken} onChange={e => setActionsTaken(e.target.value)} />
                          <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1 font-black" onClick={() => setControlModal({type: null, op: null})}>VOLTAR</Button><Button type="submit" className="flex-[2] bg-red-700 text-white font-black">CONFIRMAR</Button></div>
                      </form>
                  </div>
              </Card>
          </div>
      )}

      {/* MODAL DE NOVA MISSÃO (ESTRUTURA 1 A 10) */}
      {isMissionModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[2000] flex items-center justify-center p-0 md:p-4 animate-fade-in overflow-hidden">
              <Card className="w-full lg:max-w-4xl h-full md:h-[95vh] bg-slate-50 shadow-2xl rounded-none md:rounded-3xl flex flex-col overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center shrink-0 bg-white shadow-sm">
                      <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-slate-800"><Radio className="w-7 h-7 text-red-600 animate-pulse" /> LANÇAR OPERAÇÃO RPA</h3>
                      <button onClick={() => setIsMissionModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X className="w-7 h-7"/></button>
                  </div>
                  
                  <form onSubmit={handleSaveMission} id="mission-form" className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 custom-scrollbar pb-10">
                      
                      {/* 1. LOTAÇÃO OPERACIONAL */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-4 h-4"/> 1. LOTAÇÃO OPERACIONAL</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Select label="CRBM" value={formData.op_crbm} onChange={e => setFormData({...formData, op_crbm: e.target.value, op_unit: ''})} required>
                                  <option value="">Selecione...</option>
                                  {Object.keys(ORGANIZATION_CHART).map(c => <option key={c} value={c}>{c}</option>)}
                              </Select>
                              <Select label="Unidade" value={formData.op_unit} onChange={e => setFormData({...formData, op_unit: e.target.value})} required disabled={!formData.op_crbm}>
                                  <option value="">Selecione...</option>
                                  {formData.op_crbm && ORGANIZATION_CHART[formData.op_crbm as keyof typeof ORGANIZATION_CHART]?.map((u: string) => <option key={u} value={u}>{u}</option>)}
                              </Select>
                          </div>
                      </Card>

                      {/* 2. DADOS DA MISSÃO */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Navigation className="w-4 h-4"/> 2. DADOS DA MISSÃO</h4>
                          <Input label="Título da Ocorrência" placeholder="Ex: Incêndio Urbano..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required disabled={formData.is_summer_op} />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Select label="Natureza" value={formData.mission_type} onChange={e => setFormData({...formData, mission_type: e.target.value as any})} required>
                                  <option value="">Selecione...</option>
                                  {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </Select>
                              <Select label="Subnatureza" value={formData.sub_mission_type} onChange={e => setFormData({...formData, sub_mission_type: e.target.value})}>
                                  <option value="">Selecione...</option>
                                  {MISSION_HIERARCHY[formData.mission_type as keyof typeof MISSION_HIERARCHY]?.subtypes.map((s: string) => <option key={s} value={s}>{s}</option>)}
                              </Select>
                          </div>
                      </Card>

                      {/* 3. EQUIPE E AERONAVE */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4"/> 3. EQUIPE E AERONAVE</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Select label="Piloto (PIC)" required value={formData.pilot_id} onChange={e => setFormData({...formData, pilot_id: e.target.value})}><option value="">Selecione...</option>{pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Select>
                              <Select label="Aeronave (RPA)" required value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})}><option value="">Selecione...</option>{drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}</Select>
                          </div>
                          <Input label="Observador / Auxiliar" placeholder="Nome do militar de apoio" value={formData.observer_name} onChange={e => setFormData({...formData, observer_name: e.target.value})} />
                      </Card>

                      {/* 4. LOCALIZAÇÃO E MAPA TÁTICO */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-4 h-4"/> 4. LOCALIZAÇÃO E MAPA TÁTICO</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <Input label="Latitude PC" value={formData.latitude} type="number" step="any" onChange={e => setFormData({...formData, latitude: Number(e.target.value)})} />
                              <Input label="Longitude PC" value={formData.longitude} type="number" step="any" onChange={e => setFormData({...formData, longitude: Number(e.target.value)})} />
                              <Input label="Raio de Voo (m)" value={formData.radius} type="number" onChange={e => setFormData({...formData, radius: Number(e.target.value)})} />
                              <Input label="Altitude Máx (m)" value={formData.flight_altitude} type="number" onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})} />
                          </div>
                          <div className="h-80 rounded-2xl overflow-hidden border border-slate-200 relative">
                              <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-2">
                                  <button type="button" onClick={() => setDrawMode('pc')} className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg border transition-all ${drawMode === 'pc' ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`} title="Marcar PC"><MapPin className="w-5 h-5"/></button>
                                  <button type="button" onClick={() => setDrawMode('area')} className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg border transition-all ${drawMode === 'area' ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`} title="Desenhar Área"><Square className="w-5 h-5"/></button>
                                  <button type="button" onClick={() => setDrawMode('route')} className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg border transition-all ${drawMode === 'route' ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`} title="Desenhar Rota"><Route className="w-5 h-5"/></button>
                                  <button type="button" onClick={() => setDrawMode('poi')} className={`w-10 h-10 flex items-center justify-center rounded-lg shadow-lg border transition-all ${drawMode === 'poi' ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`} title="Marcar Ponto"><Flag className="w-5 h-5"/></button>
                              </div>
                              <button type="button" onClick={handleLocateMeInModal} className="absolute bottom-4 right-4 z-[1000] bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl shadow-2xl active:scale-95 transition-all"><LocateFixed className="w-6 h-6" /></button>
                              <MapContainer center={[formData.latitude, formData.longitude]} zoom={15} style={{ height: '100%', width: '100%' }} ref={map => { if(map) modalMapRef.current = map; }}>
                                  <MapResizer />
                                  <DrawingManager drawMode={drawMode} onShapeCreated={handleShapeCreated} />
                                  <LocationSelectorMap center={[formData.latitude, formData.longitude]} radius={formData.radius} shapes={formData.shapes}/>
                              </MapContainer>
                          </div>
                      </Card>

                      {/* 5. CRONOGRAMA OPERACIONAL */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4"/> 5. CRONOGRAMA OPERACIONAL</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Input label="Data" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                              <Input label="Início" type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                              <Input label="Término Previsto" type="time" value={formData.estimated_end_time} onChange={e => setFormData({...formData, estimated_end_time: e.target.value})} />
                          </div>
                      </Card>

                      {/* 6. DESCRIÇÃO / NOTAS OPERACIONAIS */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4"/> 6. DESCRIÇÃO / NOTAS OPERACIONAIS</h4>
                          <textarea className="w-full p-4 border border-slate-300 rounded-2xl text-sm min-h-[120px] outline-none bg-white focus:ring-2 focus:ring-red-500 transition-all" placeholder="Relate detalhes, obstáculos or observações importantes da missão..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </Card>

                      {/* 7. LINK DE TRANSMISSÃO */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Video className="w-4 h-4"/> 7. LINK DE TRANSMISSÃO</h4>
                          <Input placeholder="Link YouTube/RTSP..." value={formData.stream_url} onChange={e => setFormData({...formData, stream_url: e.target.value})} />
                      </Card>

                      {/* 8. INTEGRAÇÃO SARPAS NG (MANUAL) */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4"/> 8. INTEGRAÇÃO SARPAS NG (MANUAL)</h4>
                          <Input label="Protocolo SARPAS" placeholder="Ex: XXXXXX" value={formData.sarpas_protocol} onChange={e => setFormData({...formData, sarpas_protocol: e.target.value})} />
                      </Card>

                      {/* 9. OPERAÇÃO VERÃO - DINÂMICO */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sun className="w-4 h-4"/> 9. OPERAÇÃO VERÃO</h4>
                          <label className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50 transition-colors">
                              <input type="checkbox" className="w-5 h-5 accent-orange-500" checked={formData.is_summer_op} onChange={e => setFormData({...formData, is_summer_op: e.target.checked, summer_city: '', summer_pgv: ''})} />
                              <span className="text-sm font-bold flex items-center gap-2"><Sun className="w-4 h-4 text-orange-500" /> VINCULAR À OPERAÇÃO VERÃO</span>
                          </label>

                          {formData.is_summer_op && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                  <Select label="Cidade Litorânea" required value={formData.summer_city} onChange={e => setFormData({...formData, summer_city: e.target.value, summer_pgv: ''})}>
                                      <option value="">Selecione a cidade...</option>
                                      {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                                  </Select>
                                  <Select label="Posto Guarda-Vidas (PGV)" required value={formData.summer_pgv} onChange={e => setFormData({...formData, summer_pgv: e.target.value})} disabled={!formData.summer_city}>
                                      <option value="">Selecione o posto...</option>
                                      {formData.summer_city && SUMMER_LOCATIONS[formData.summer_city]?.map(pgv => <option key={pgv} value={pgv}>{pgv}</option>)}
                                  </Select>
                              </div>
                          )}
                      </Card>

                      {/* 10. DIÁRIO DE BORDO / MULTIDIAS */}
                      <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4"/> 10. DIÁRIO DE BORDO</h4>
                          <label className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors">
                              <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={formData.is_multi_day} onChange={e => setFormData({...formData, is_multi_day: e.target.checked})} />
                              <span className="text-sm font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /> ATIVAR MODO MULTIDIAS</span>
                          </label>
                          {formData.is_multi_day && (
                              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3 animate-fade-in">
                                  <div className="p-2 bg-blue-600 rounded-lg text-white shadow-md"><FileText className="w-4 h-4" /></div>
                                  <p className="text-[10px] font-bold text-blue-800 leading-tight">O sistema habilitará o lançamento por turnos e controle de diário técnico no Centro Tático desta missão.</p>
                              </div>
                          )}
                      </Card>
                  </form>
                  
                  <div className="p-6 border-t bg-white flex gap-4 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
                      <Button variant="outline" onClick={() => setIsMissionModalOpen(false)} className="h-14 font-black uppercase text-xs rounded-2xl flex-1 border-slate-200">CANCELAR</Button>
                      <Button type="submit" form="mission-form" disabled={loading} className="flex-[2] h-14 bg-red-700 hover:bg-red-800 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-red-100 flex items-center justify-center gap-2">
                          <SaveIcon className="w-5 h-5"/> INICIAR MISSÃO RPA
                      </Button>
                  </div>
              </Card>
          </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .leaflet-container { border-radius: inherit; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
