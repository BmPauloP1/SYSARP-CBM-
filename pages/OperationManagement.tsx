
import React, { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { supabase, isConfigured } from "../services/supabase"; 
import { sarpasApi } from "../services/sarpasApi";
import { operationSummerService } from "../services/operationSummerService";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, AroAssessment, MissionType, ConflictNotification } from "../types";
import { SUMMER_LOCATIONS } from "../types_summer";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
import { Plus, Map as MapIcon, Clock, Crosshair, User, Plane, Share2, Pencil, X, CloudRain, Wind, CheckSquare, ShieldCheck, AlertTriangle, Radio, Send, Sun, Users, Eye, History, Activity, Pause, Play, Edit3, Database, Copy, ChevronsRight, ChevronsLeft, ChevronsDown, ChevronsUp, Maximize2, Building2, Landmark, MapPin, Phone, Calendar, Hammer, Layers, MessageCircle } from "lucide-react";
import OperationDailyLog from "../components/OperationDailyLog";

// Imports Geoman
import "@geoman-io/leaflet-geoman-free";

// --- COORDENADAS DAS UNIDADES DO CBMPR (BASE DE DADOS GEOGRÁFICA) ---
// Mapeamento preciso baseado na lista fornecida (Endereços exatos e Cidades Sedes)
const UNIT_GEO: Record<string, [number, number]> = {
  // --- 1º CRBM (CURITIBA E RMC) ---
  "1º CRBM - Curitiba (Sede Regional)": [-25.417336, -49.278911], // R. Nilo Peçanha, 557
  "1º BBM - Curitiba (Portão)": [-25.474580, -49.294240], // Av. Pres. Wenceslau Braz, 3968B
  "6º BBM - São José dos Pinhais": [-25.5347, -49.2063],
  "7º BBM - Colombo": [-25.2917, -49.2242],
  "8º BBM - Paranaguá": [-25.5205, -48.5095],
  
  // Unidades Especializadas (Curitiba)
  "BOA - Batalhão de Operações Aéreas": [-25.5161, -49.1702], // Bacacheri/Afonso Pena
  "GOST - Grupo de Operações de Socorro Tático": [-25.42, -49.28],
  "CCB (QCGBM) - Quartel do Comando Geral": [-25.4146, -49.2720],

  // --- 2º CRBM (LONDRINA / NORTE) ---
  "2º CRBM - Londrina (Sede Regional)": [-23.311580, -51.171220], // R. Silvio Bussadori, 150
  "3º BBM - Londrina": [-23.311580, -51.171220], // Sede junto ao CRBM
  "11º BBM - Apucarana": [-23.5510, -51.4614],
  "1ª CIBM - Ivaiporã": [-24.2464, -51.3181],
  "3ª CIBM - Santo Antônio da Platina": [-23.2974, -50.0759],
  
  // --- 3º CRBM (CASCAVEL / OESTE) ---
  "3º CRBM - Cascavel (Sede Regional)": [-24.956700, -53.457800], // R. Jorge Lacerda, 2202
  "4º BBM - Cascavel": [-24.956700, -53.457800], // Sede junto ao CRBM
  "9º BBM - Foz do Iguaçu": [-25.5469, -54.5882],
  "10º BBM - Francisco Beltrão": [-26.0810, -53.0548],
  "13º BBM - Pato Branco": [-26.2295, -52.6713],

  // --- 4º CRBM (MARINGÁ / NOROESTE) ---
  "4º CRBM - Maringá (Sede Regional)": [-23.418900, -51.938700], // Av. Centenário, 290
  "5º BBM - Maringá": [-23.418900, -51.938700], // Sede junto ao CRBM
  "2ª CIBM - Umuarama": [-23.7661, -53.3206],
  "4ª CIBM - Cianorte": [-23.6528, -52.6073],
  "5ª CIBM - Paranavaí": [-23.0792, -52.4607],

  // --- 5º CRBM (PONTA GROSSA / CAMPOS GERAIS) ---
  "5º CRBM - Ponta Grossa (Sede Regional)": [-25.091600, -50.160800], // Praça Roosevelt, 43
  "2º BBM - Ponta Grossa": [-25.091600, -50.160800], // Sede junto ao CRBM
  "12º BBM - Guarapuava": [-25.3953, -51.4622],
  "6ª CIBM - Irati": [-25.4682, -50.6511]
};

// --- ÍCONES PERSONALIZADOS ---
const createCustomIcon = (type: 'pilot' | 'drone' | 'unit', count: number = 1) => {
  let iconSvg = '';
  let bgColor = '';
  let size: [number, number] = [36, 36];
  let badgeHtml = count > 1 ? `<div class="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow-sm">${count}</div>` : '';

  if (type === 'unit') {
    // Icone de Prédio (Quartel)
    bgColor = 'bg-slate-800';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>`;
  } else if (type === 'pilot') {
    // Icone de Usuário
    bgColor = 'bg-blue-600';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  } else {
    // Icone de Drone (Quadricóptero)
    bgColor = 'bg-orange-600';
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke-width="0" fill="none"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M4.5 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/><path d="M19.5 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/><path d="M4.5 15m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/><path d="M19.5 15m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/><path d="M12 12v-3.5"/><path d="M12 12v3.5"/><path d="M12 12h-3.5"/><path d="M12 12h3.5"/></svg>`;
  }

  const html = `
    <div class="relative flex items-center justify-center w-full h-full shadow-lg rounded-lg border-2 border-white ${bgColor} text-white hover:scale-110 transition-transform">
      ${iconSvg}
      ${badgeHtml}
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'bg-transparent',
    iconSize: size,
    iconAnchor: [size[0]/2, size[1]/2],
    popupAnchor: [0, -size[1]/2]
  });
};

// Fix Leaflet icons for Ops
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const tempIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const isValidCoord = (lat: any, lng: any) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
};

// Componente para sincronizar o mapa quando os inputs manuais mudam
const MapRecenter = ({ lat, lng }: { lat: number, lng: number }) => {
  const map = useMap();
  useEffect(() => {
    if (isValidCoord(lat, lng)) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
};

// ... (KEEPING GEOMAN AND MAP CONTROLLERS) ...
const GeomanController = ({ initialShapes, onUpdate, editable, controllerKey, drawRequest }: any) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !(map as any).pm || !drawRequest) return;
    if (drawRequest === 'Marker') (map as any).pm.enableDraw('Marker', { snappable: true, snapDistance: 20 });
  }, [drawRequest, map]);

  useEffect(() => {
    if (!map || !(map as any).pm) return;
    const pm = (map as any).pm;
    if (editable) {
        pm.addControls({ position: 'topleft', drawCircleMarker: false, drawText: false, rotateMode: false, cutPolygon: false });
    } else {
        pm.removeControls();
    }
    const handleUpdate = () => {
        const layers = (map as any).pm.getGeomanLayers();
        const geojson = { type: 'FeatureCollection', features: layers.map((l: any) => (l as any).toGeoJSON()) };
        onUpdate(geojson);
    };
    map.on('pm:create', (e) => { e.layer.on('pm:edit', handleUpdate); handleUpdate(); });
    map.on('pm:remove', handleUpdate);
    return () => { if(map) { map.off('pm:create'); map.off('pm:remove'); } };
  }, [map, editable]);
  return null;
}

const LocationSelector = ({ onLocationSelect, isSelecting }: { onLocationSelect: (lat: number, lng: number) => void, isSelecting: boolean }) => {
  useMapEvents({
    click(e) {
      if (isSelecting) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const MapController = ({ isPanelCollapsed }: { isPanelCollapsed: boolean }) => {
  const map = useMap();
  useEffect(() => {
    if (map) setTimeout(() => map.invalidateSize(), 300);
  }, [map, isPanelCollapsed]);
  return null;
};

// CAMADA DE RECURSOS (UNIDADES, PILOTOS, DRONES)
const ResourceLayer = ({ 
  pilots, 
  drones, 
  showUnits,
  showPilots,
  showDrones
}: { 
  pilots: Pilot[], 
  drones: Drone[], 
  showUnits: boolean,
  showPilots: boolean,
  showDrones: boolean
}) => {
  
  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
  };

  // Memoize para recalcular apenas quando os dados mudam (Adição/Exclusão)
  const layerContent = useMemo(() => {
    return Object.entries(UNIT_GEO).map(([unitName, coords]) => {
         const [lat, lng] = coords;
         
         // Helper: Matching que prioriza a CIDADE
         const normalizeMatch = (resourceUnit: string | undefined, geoKey: string) => {
             if (!resourceUnit) return false;
             
             const rUnit = resourceUnit.toLowerCase().trim();
             const gKey = geoKey.toLowerCase().trim();
             
             // 1. Match exato (para garantir casos simples)
             if (rUnit === gKey) return true;
             
             // 2. Extração inteligente por CIDADE
             // A chave do mapa (UNIT_GEO) geralmente é: "UNIDADE - CIDADE (DETALHE)"
             // Ex: "10º BBM - Francisco Beltrão"
             const parts = gKey.split(' - ');
             
             if (parts.length >= 2) {
                 const mapDesignator = parts[0].trim(); // ex: "10º bbm"
                 // Pega a parte da cidade, removendo detalhes entre parênteses ex: "curitiba (portão)" -> "curitiba"
                 const mapCity = parts[1].split('(')[0].trim(); 
                 
                 // REGRA DE OURO: Se a unidade do piloto contém o NOME DA CIDADE da chave do mapa, é match.
                 // Isso resolve o problema de "10º BBM - Francisco Beltrão" vs "12º BBM - Guarapuava".
                 if (rUnit.includes(mapCity)) {
                     return true;
                 }
                 
                 // Fallback: Se for unidade de SEDE (sem cidade no nome do piloto), vincula pelo designador
                 // Ex: "Sede Administrativa - 2º CRBM" -> Match em "2º CRBM - Londrina" (Se não achar Londrina no nome)
                 if (rUnit.includes(mapDesignator) && (rUnit.includes('sede') || rUnit.includes('comando') || rUnit.includes('ccb'))) {
                     return true;
                 }
                 
                 // Se não tiver a cidade e não for sede, não dá match (evita duplicidade em Regionais)
                 return false;
             }
             
             // Fallback genérico se a chave do mapa não tiver hífen
             return rUnit.includes(gKey);
         };

         // Filtra pilotos e drones desta unidade específica usando a lógica estrita de cidade
         const unitPilots = pilots.filter(p => normalizeMatch(p.unit, unitName));
         const unitDrones = drones.filter(d => normalizeMatch(d.unit, unitName) && d.status !== 'in_operation');
         
         const hasResources = unitPilots.length > 0 || unitDrones.length > 0;
         
         // Se não deve mostrar unidades e não tem recursos, não renderiza nada
         if (!showUnits && !hasResources) return null;

         // LÓGICA DE POSICIONAMENTO EXATO (STACKING)
         const pilotPos: [number, number] = [lat + 0.0002, lng]; // Ligeiramente acima
         const dronePos: [number, number] = [lat - 0.0002, lng]; // Ligeiramente abaixo

         return (
           <React.Fragment key={unitName}>
             
             {/* 1. MARCADOR DA UNIDADE (QUARTEL) - BASE */}
             {showUnits && (
               <Marker position={coords} icon={createCustomIcon('unit', 1)} zIndexOffset={50}>
                  <Popup>
                     <div className="min-w-[200px]">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-1 mb-2">
                           <Building2 className="w-4 h-4 text-slate-600" />
                           {unitName}
                        </h3>
                        <div className="text-xs text-slate-500">
                           <p>Base Operacional / Administrativa</p>
                           <p className="mt-1">Efetivo: {unitPilots.length} Pilotos</p>
                           <p>Frota: {unitDrones.length} RPAs</p>
                        </div>
                     </div>
                  </Popup>
               </Marker>
             )}

             {/* 2. MARCADOR DE PILOTOS (AGRUPADO) - CAMADA SUPERIOR */}
             {showPilots && unitPilots.length > 0 && (
               <Marker 
                  position={pilotPos} 
                  icon={createCustomIcon('pilot', unitPilots.length)} 
                  zIndexOffset={1000} // Z-index alto para ficar "encima"
               >
                  <Popup>
                     <div className="min-w-[220px]">
                        <h3 className="font-bold text-blue-800 flex items-center gap-2 border-b border-blue-100 pb-1 mb-2">
                           <Users className="w-4 h-4" />
                           Pilotos - {unitName.split(' - ')[0]}
                        </h3>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                           {unitPilots.map(p => (
                              <div key={p.id} className="flex justify-between items-center text-xs bg-slate-50 p-1.5 rounded border border-slate-100">
                                 <div>
                                    <strong className="block text-slate-700">{p.full_name.split(' ')[0]} {p.full_name.split(' ').pop()}</strong>
                                    <span className="text-[10px] text-slate-400">{p.role === 'admin' ? 'Admin' : 'Piloto'}</span>
                                 </div>
                                 {p.phone && (
                                    <button 
                                      onClick={() => handleWhatsApp(p.phone)}
                                      className="bg-green-50 text-green-600 p-1.5 rounded hover:bg-green-100 border border-green-200"
                                      title="Abrir WhatsApp"
                                    >
                                       <MessageCircle className="w-4 h-4" />
                                    </button>
                                 )}
                              </div>
                           ))}
                        </div>
                     </div>
                  </Popup>
               </Marker>
             )}

             {/* 3. MARCADOR DE DRONES (AGRUPADO) - CAMADA INTERMEDIÁRIA */}
             {showDrones && unitDrones.length > 0 && (
               <Marker 
                  position={dronePos} 
                  icon={createCustomIcon('drone', unitDrones.length)} 
                  zIndexOffset={900} 
               >
                  <Popup>
                     <div className="min-w-[200px]">
                        <h3 className="font-bold text-orange-800 flex items-center gap-2 border-b border-orange-100 pb-1 mb-2">
                           <Plane className="w-4 h-4" />
                           Frota - {unitName.split(' - ')[0]}
                        </h3>
                        <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                           {unitDrones.map(d => (
                              <div key={d.id} className="text-xs bg-slate-50 p-1.5 rounded border border-slate-100">
                                 <strong className="block text-slate-700">{d.prefix}</strong>
                                 <span className="text-[10px] text-slate-500">{d.model}</span>
                                 <div className="mt-1">
                                    <Badge variant={d.status === 'available' ? 'success' : 'warning'} className="text-[9px] px-1 py-0">
                                       {d.status === 'available' ? 'Disp.' : 'Manut.'}
                                    </Badge>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </Popup>
               </Marker>
             )}

           </React.Fragment>
         );
      });
  }, [pilots, drones, showUnits, showPilots, showDrones]);

  return <>{layerContent}</>;
};

const ChecklistModal = ({ onConfirm, onCancel }: any) => (
    <div className="fixed inset-0 bg-black/70 z-[2000] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="font-bold text-xl mb-4">Checklist de Decolagem</h2>
            <Button onClick={onConfirm} className="w-full bg-green-600 text-white">Confirmar</Button>
            <Button variant="outline" onClick={onCancel} className="w-full mt-2">Cancelar</Button>
        </div>
    </div>
);

export default function OperationManagement() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState<Operation | null>(null);
  
  // MAP LAYER CONTROLS (INDEPENDENT)
  const [showUnits, setShowUnits] = useState(true);
  const [showPilots, setShowPilots] = useState(true);
  const [showDrones, setShowDrones] = useState(true);

  // TABS FOR EDIT MODE
  const [editTab, setEditTab] = useState<'details' | 'daily_log'>('details');

  const [showChecklist, setShowChecklist] = useState(false); 
  const [loading, setLoading] = useState(false);
  
  // SARPAS state
  const [sendToSarpas, setSendToSarpas] = useState(false); 
  
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isSummerOp, setIsSummerOp] = useState(false);
  const [summerCity, setSummerCity] = useState("");
  const [summerPost, setSummerPost] = useState("");

  const [drawRequest, setDrawRequest] = useState<string | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [geoKey, setGeoKey] = useState(0);

  const initialFormState = {
    name: '',
    pilot_id: '',
    pilot_name: '', 
    second_pilot_id: '',
    second_pilot_name: '', 
    observer_id: '',
    observer_name: '', 
    drone_id: '',
    mission_type: 'sar' as MissionType,
    sub_mission_type: '',
    latitude: -25.2521, 
    longitude: -52.0215,
    radius: 500,
    flight_altitude: 60,
    stream_url: '',
    description: '',
    sarpas_protocol: '', 
    shapes: null as any,
    is_multi_day: false,
    date: new Date().toISOString().split('T')[0], // Novo Campo de Data
    start_time_local: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    end_time_local: new Date(new Date().getTime() + 60*60*1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
  };

  const [formData, setFormData] = useState(initialFormState);

  // Subtipos dinâmicos baseados na missão selecionada
  const currentSubtypes = useMemo(() => {
      return MISSION_HIERARCHY[formData.mission_type]?.subtypes || [];
  }, [formData.mission_type]);

  const [finishData, setFinishData] = useState({
    description: '',
    flight_hours: 0,
  });

  const loadData = async () => {
    try {
      const [ops, pils, drns, me] = await Promise.all([
        base44.entities.Operation.list('-created_at'),
        base44.entities.Pilot.filter({ status: 'active' }),
        base44.entities.Drone.list(),
        base44.auth.me()
      ]);
      
      // Sort pilots alphabetically
      const sortedPilots = pils.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setOperations(ops);
      setPilots(sortedPilots);
      setDrones(drns);
      setCurrentUser(me);
    } catch(e: any) {
      if (e.message && e.message.includes("DB_TABLE_MISSING")) {
         const fixSql = `... (SQL omitido para brevidade) ...`;
         // Apenas admins veem erros de SQL no load
         if (currentUser?.role === 'admin') setSqlError(fixSql);
      }
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); 
    return () => clearInterval(interval);
  }, []);

  // Effect para calcular horas totais ao abrir modal de encerrar
  useEffect(() => {
    const calculateTotalHours = async () => {
      if (isFinishing) {
        try {
          // Busca todos os logs de voo vinculados a essa operação
          const logs = await base44.entities.FlightLog.filter({ operation_id: isFinishing.id });
          let totalFromLogs = logs.reduce((acc, log) => acc + (log.flight_hours || 0), 0);
          
          // Se não houver logs (operação simples), tenta calcular por tempo decorrido
          if (totalFromLogs === 0) {
             const start = new Date(isFinishing.start_time).getTime();
             const end = new Date().getTime();
             
             // Subtrair tempo de pausa se houver
             const pauseDurationMs = (isFinishing.total_pause_duration || 0) * 60 * 1000;
             const diffMs = end - start - pauseDurationMs;
             const hours = diffMs / (1000 * 60 * 60);
             
             if (hours > 0) totalFromLogs = parseFloat(hours.toFixed(1));
          }

          setFinishData({
            description: '',
            flight_hours: totalFromLogs > 0 ? totalFromLogs : 0
          });
        } catch (e) {
          console.error("Erro ao calcular horas automáticas", e);
        }
      }
    };
    calculateTotalHours();
  }, [isFinishing]);

  const handleLocationSelect = (lat: number, lng: number) => {
    // Round to 6 decimal places for precision
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    setFormData(prev => ({ ...prev, latitude: roundedLat, longitude: roundedLng }));
  };

  const handleStartEdit = (op: Operation) => {
    const start = new Date(op.start_time);
    const end = op.end_time ? new Date(op.end_time) : new Date(start.getTime() + 60*60000);
    const safeMissionType = MISSION_HIERARCHY[op.mission_type] ? op.mission_type : 'diverse';

    setFormData({
        name: op.name,
        pilot_id: op.pilot_id || '',
        pilot_name: op.pilot_name || '',
        second_pilot_id: op.second_pilot_id || '',
        second_pilot_name: op.second_pilot_name || '',
        observer_id: op.observer_id || '',
        observer_name: op.observer_name || '',
        drone_id: op.drone_id,
        mission_type: safeMissionType,
        sub_mission_type: op.sub_mission_type || '',
        latitude: op.latitude,
        longitude: op.longitude,
        radius: op.radius,
        flight_altitude: op.flight_altitude || 60,
        stream_url: op.stream_url || '',
        description: op.description || '',
        sarpas_protocol: op.sarpas_protocol || '',
        shapes: op.shapes || null, 
        is_multi_day: op.is_multi_day || false,
        date: start.toISOString().split('T')[0], // Extrai a data
        start_time_local: start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        end_time_local: end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    });
    
    // Restaurar estado da Op. Verão e SARPAS (se existente)
    setIsSummerOp(op.is_summer_op || false);
    setSendToSarpas(false); 

    setIsEditing(op.id);
    setIsCreating(true);
    setIsPanelCollapsed(false);
    setEditTab('details');
    setGeoKey(prev => prev + 1);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setIsEditing(null);
    setFormData(initialFormState);
    setSendToSarpas(false);
    setIsSummerOp(false);
    setSummerCity("");
    setSummerPost("");
    setEditTab('details');
    setGeoKey(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
       performSave();
    } else {
       if (!formData.pilot_name || !formData.drone_id) { alert("Dados obrigatórios faltando"); return; }
       if (isSummerOp && (!summerCity || !summerPost)) { alert("Selecione a cidade e o posto para a Operação Verão."); return; }
       setShowChecklist(true);
    }
  };

  // Função atualizada para usar a data selecionada no formulário
  const combineDateAndTime = (dateStr: string, timeStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Cria data usando componentes locais
    const date = new Date(year, month - 1, day, hours, minutes);
    return date.toISOString();
  };

  const performSave = async () => {
    setLoading(true);
    try {
      const startTimeISO = combineDateAndTime(formData.date, formData.start_time_local);
      const endTimeISO = combineDateAndTime(formData.date, formData.end_time_local);
      const sanitizeUuid = (val: string | undefined) => (!val || val === "") ? null : val;

      let protocol = formData.sarpas_protocol;

      // Construir objeto limpo, sem campos de controle do formulário (como start_time_local, end_time_local)
      const payloadBase = {
          name: formData.name,
          pilot_id: sanitizeUuid(formData.pilot_id),
          pilot_name: formData.pilot_name,
          second_pilot_id: sanitizeUuid(formData.second_pilot_id),
          second_pilot_name: formData.second_pilot_name,
          observer_id: sanitizeUuid(formData.observer_id),
          observer_name: formData.observer_name,
          drone_id: formData.drone_id,
          mission_type: formData.mission_type,
          sub_mission_type: formData.sub_mission_type,
          latitude: formData.latitude,
          longitude: formData.longitude,
          radius: Number(formData.radius),
          flight_altitude: Number(formData.flight_altitude),
          stream_url: formData.stream_url,
          description: formData.description,
          shapes: formData.shapes,
          is_multi_day: formData.is_multi_day,
          is_summer_op: isSummerOp,
          sarpas_protocol: protocol
      };

      let savedOp: Operation;

      if (isEditing) {
        savedOp = await base44.entities.Operation.update(isEditing, {
          ...payloadBase,
          start_time: startTimeISO,
          end_time: endTimeISO
        });
        alert("Ocorrência atualizada!"); 
      } else {
        const occurrenceNumber = `${new Date().getFullYear()}ARP${Math.floor(Math.random()*1000)}`;
        
        savedOp = await base44.entities.Operation.create({
          ...payloadBase,
          pilot_id: sanitizeUuid(formData.pilot_id)!,
          occurrence_number: occurrenceNumber,
          status: 'active',
          start_time: startTimeISO,
          end_time: endTimeISO,
          photos: [],
          aro: null,
        } as any);
        alert("Operação criada!");
      }

      // --- AUTOMAÇÃO PARA OPERAÇÃO MULTIDIAS ---
      if (savedOp.is_multi_day) {
          // Extrai a data baseada na data real de início da operação salva no banco
          const startDate = new Date(savedOp.start_time).toISOString().split('T')[0]; 
          
          try {
              // 1. Verifica se já existe um dia criado para essa data nessa operação
              const existingDays = await base44.entities.OperationDay.filter({
                  operation_id: savedOp.id,
                  date: startDate
              });

              if (existingDays.length === 0) {
                  console.log(`Criando primeiro dia automático para ${startDate}...`);
                  
                  // 2. Cria o Dia
                  const newDay = await base44.entities.OperationDay.create({
                      operation_id: savedOp.id,
                      date: startDate,
                      responsible_pilot_id: savedOp.pilot_id,
                      weather_summary: "Clima inicial",
                      progress_notes: savedOp.description || "Início da operação",
                      status: 'open'
                  } as any);

                  // 3. Vincula o Drone Principal
                  if (savedOp.drone_id) {
                      await base44.entities.OperationDayAsset.create({
                          operation_day_id: newDay.id,
                          drone_id: savedOp.drone_id,
                          status: 'active'
                      } as any);
                  }

                  // 4. Vincula o Piloto Principal
                  if (savedOp.pilot_id) {
                      await base44.entities.OperationDayPilot.create({
                          operation_day_id: newDay.id,
                          pilot_id: savedOp.pilot_id,
                          role: 'pic'
                      } as any);
                  }
                  
                  console.log("Dia automático criado com sucesso.");
              }
          } catch (dayError) {
              console.error("Erro ao criar dia automático:", dayError);
              // Não bloqueia o fluxo principal, apenas loga
          }
      }
      // ----------------------------------------

      // 3. Summer Op Logic
      if (isSummerOp && !isEditing) {
         try {
            await operationSummerService.create({
               pilot_id: savedOp.pilot_id,
               drone_id: savedOp.drone_id,
               mission_type: 'patrulha', 
               location: `${summerCity} - ${summerPost}`,
               date: formData.date, // Usa a data do formulário
               start_time: formData.start_time_local,
               end_time: formData.end_time_local,
               flight_duration: 0, 
               evidence_photos: [],
               evidence_videos: []
            }, savedOp.pilot_id);
         } catch(e) { console.error("Erro ao salvar Op Verão", e); }
      }

      // 4. Update Drone Status
      if (!isEditing && formData.drone_id) {
         await base44.entities.Drone.update(formData.drone_id, { status: 'in_operation' });
      }

      handleCancelForm();
      loadData();
    } catch (error: any) {
      console.error(error);
      const msg = error.message || '';
      
      // FIX: Check for missing columns and ONLY show to admins
      if (msg.includes("is_multi_day") || msg.includes("is_summer_op") || msg.includes("sarpas_protocol")) {
          if (currentUser?.role === 'admin') {
              setSqlError(`
-- ATUALIZAÇÃO NECESSÁRIA NO BANCO DE DADOS
-- Copie e execute este código no SQL Editor do Supabase para habilitar as novas funções.

ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS is_multi_day boolean DEFAULT false;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS is_summer_op boolean DEFAULT false;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS sarpas_protocol text;

-- Atualizar cache do esquema
NOTIFY pgrst, 'reload schema';
              `);
          } else {
              alert("Erro de versão do sistema. Contate o administrador.");
          }
          return;
      }

      if (msg.includes("DB_TABLE_MISSING")) {
          loadData(); 
      } else {
          alert(`Erro ao salvar: ${msg}`);
      }
    } finally {
      setLoading(false);
      setShowChecklist(false);
    }
  };

  const handleFinishOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinishing) return;
    setLoading(true);
    try {
        // Se estiver pausada, finaliza a pausa antes de encerrar
        if (isFinishing.is_paused && isFinishing.last_pause_start) {
            const start = new Date(isFinishing.last_pause_start).getTime();
            const end = new Date().getTime();
            const durationMinutes = (end - start) / 60000;
            const newLog = {
                start: isFinishing.last_pause_start,
                end: new Date().toISOString(),
                reason: 'Encerramento com Pausa Ativa',
                duration: durationMinutes
            };
            isFinishing.total_pause_duration = (isFinishing.total_pause_duration || 0) + durationMinutes;
            isFinishing.pause_logs = [...(isFinishing.pause_logs || []), newLog];
        }

        await base44.entities.Operation.update(isFinishing.id, {
            status: 'completed',
            flight_hours: Number(finishData.flight_hours),
            description: finishData.description ? (isFinishing.description + "\n\n[CONCLUSÃO]: " + finishData.description) : isFinishing.description,
            end_time: new Date().toISOString(),
            is_paused: false, // Ensure it's not paused when completed
            total_pause_duration: isFinishing.total_pause_duration,
            pause_logs: isFinishing.pause_logs
        });
        
        if (isFinishing.drone_id) {
           try {
             await base44.entities.Drone.update(isFinishing.drone_id, { status: 'available' });
           } catch(e) { console.warn("Erro ao liberar drone", e); }
        }

        alert("Operação encerrada com sucesso!");
        setIsFinishing(null);
        loadData();
    } catch (error: any) {
        console.error(error);
        
        if (error.message && error.message.includes("invalid input syntax for type integer")) {
            if (currentUser?.role === 'admin') {
                setSqlError(`
-- CORREÇÃO DE TIPO DE COLUNA
-- O erro indica que uma coluna numérica está configurada como INTEIRO mas recebendo DECIMAIS.
-- Execute para corrigir:

ALTER TABLE public.operations ALTER COLUMN total_pause_duration TYPE float USING total_pause_duration::float;
ALTER TABLE public.operations ALTER COLUMN flight_hours TYPE float USING flight_hours::float;
                `);
            } else {
                alert("Erro de banco de dados (tipo de coluna incorreto). Contate o administrador.");
            }
        } else {
            alert("Erro ao encerrar operação.");
        }
    } finally {
        setLoading(false);
    }
  };

  // --- COMPARTILHAR ---
  const handleShareOp = (op: Operation) => {
      const pilot = pilots.find(p => p.id === op.pilot_id);
      const drone = drones.find(d => d.id === op.drone_id);

      const mapLink = `https://www.google.com/maps?q=${op.latitude},${op.longitude}`;
      const streamText = op.stream_url ? `\n📡 *Transmissão:* ${op.stream_url}` : '';
      const missionLabel = MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type;
      
      const startTime = new Date(op.start_time);
      const endTime = op.end_time 
          ? new Date(op.end_time) 
          : new Date(startTime.getTime() + 2 * 60 * 60 * 1000); 

      const text = `🚨 *SYSARP - SITUAÇÃO OPERACIONAL* 🚨\n\n` +
          `🚁 *Ocorrência:* ${op.name}\n` +
          `🔢 *Protocolo:* ${op.occurrence_number}\n` +
          `📋 *Natureza:* ${missionLabel}\n` +
          `👤 *Piloto:* ${pilot ? pilot.full_name : 'N/A'}\n` +
          `🛸 *Aeronave:* ${drone ? `${drone.model} (${drone.prefix})` : 'N/A'}\n` +
          `📍 *Coord:* ${op.latitude}, ${op.longitude}\n` +
          `🗺️ *Mapa:* ${mapLink}\n` +
          `🕒 *Início:* ${startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n` +
          `🏁 *Término Previsto:* ${endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n` +
          `${streamText}\n\n` +
          `_Enviado via Centro de Comando SYSARP_`;

      const encodedText = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  // --- PAUSAR / RETOMAR ---
  const handleTogglePause = async (op: Operation) => {
      if (!op) return;
      
      try {
          const isPausing = !op.is_paused;
          let updates: Partial<Operation> = {};

          if (isPausing) {
              // INICIAR PAUSA
              updates = {
                  is_paused: true,
                  last_pause_start: new Date().toISOString()
              };
          } else {
              // RETOMAR (FINALIZAR PAUSA) - SOLICITAR MOTIVO
              const reason = window.prompt("Qual o motivo desta pausa?", "Pausa Operacional / Troca de Bateria");
              if (reason === null) return; // Cancelou

              if (op.last_pause_start) {
                  const start = new Date(op.last_pause_start).getTime();
                  const end = new Date().getTime();
                  const durationMinutes = (end - start) / 60000;
                  
                  const newLog = {
                      start: op.last_pause_start,
                      end: new Date().toISOString(),
                      reason: reason || 'Pausa Operacional',
                      duration: durationMinutes
                  };
                  
                  updates = {
                      is_paused: false,
                      last_pause_start: null, // Reset as it needs null to respect type
                      total_pause_duration: (op.total_pause_duration || 0) + durationMinutes,
                      pause_logs: [...(op.pause_logs || []), newLog]
                  } as any;
              } else {
                  // Fallback se não tiver last_pause_start
                  updates = { is_paused: false };
              }
          }

          await base44.entities.Operation.update(op.id, updates);
          loadData(); 
      } catch (e: any) {
          console.error(e);
          
          if (e.message && e.message.includes("invalid input syntax for type integer")) {
              if (currentUser?.role === 'admin') {
                  setSqlError(`
-- CORREÇÃO DE TIPO DE COLUNA
-- O erro indica que uma coluna numérica está configurada como INTEIRO mas recebendo DECIMAIS.
-- Execute para corrigir:

ALTER TABLE public.operations ALTER COLUMN total_pause_duration TYPE float USING total_pause_duration::float;
ALTER TABLE public.operations ALTER COLUMN flight_hours TYPE float USING flight_hours::float;
                  `);
              } else {
                  alert("Erro de banco de dados: Coluna numérica configurada incorretamente. Contate o admin.");
              }
              return;
          }

          // Check for missing column error
          if (e.message && (e.message.includes("is_paused") || e.message.includes("pause_logs"))) {
              if (currentUser?.role === 'admin') {
                  setSqlError(`
-- ATUALIZAÇÃO PARA FUNÇÃO DE PAUSA
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS last_pause_start timestamp with time zone;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS total_pause_duration float DEFAULT 0;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS pause_logs jsonb DEFAULT '[]';

NOTIFY pgrst, 'reload schema';
                  `);
              } else {
                  alert("Funcionalidade indisponível. Contate o administrador.");
              }
          } else {
              alert("Erro ao alterar status de pausa.");
          }
      }
  };

  const activeOps = operations.filter(o => o.status === 'active');
  const displayedOps = activeTab === 'active' ? activeOps : operations.filter(o => o.status === 'completed');

  const copySqlToClipboard = () => {
    if (sqlError) {
      navigator.clipboard.writeText(sqlError);
      alert("Código SQL copiado!");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full relative bg-slate-100 overflow-hidden">
      {showChecklist && <ChecklistModal onConfirm={performSave} onCancel={() => setShowChecklist(false)} />}

      {/* SQL FIX MODAL (Only for Admins) */}
      {sqlError && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
           <Card className="w-full max-w-3xl flex flex-col bg-white border-4 border-red-600 shadow-2xl">
              <div className="p-4 bg-red-600 text-white flex justify-between items-center">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Database className="w-6 h-6" /> Atualização de Banco de Dados</h3>
                 <button onClick={() => setSqlError(null)} className="hover:bg-red-700 p-1 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-slate-700 font-medium">Novas funcionalidades detectadas. Execute este SQL para criar as tabelas ou colunas necessárias.</p>
                 <div className="relative"><pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono border border-slate-700 max-h-64">{sqlError}</pre>
                 <button onClick={copySqlToClipboard} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded"><Copy className="w-4 h-4" /></button></div>
              </div>
           </Card>
        </div>
      )}

      {/* FINISH OPERATION MODAL */}
      {isFinishing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <Card className="w-full max-w-lg bg-white p-6 shadow-2xl border-t-4 border-green-600">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            <CheckSquare className="w-6 h-6 text-green-600" />
                            Encerrar Operação
                        </h2>
                        <p className="text-sm text-slate-500">
                            Finalizar <strong>{isFinishing.name}</strong>
                        </p>
                    </div>
                    <button onClick={() => setIsFinishing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                
                <form onSubmit={handleFinishOperation} className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800 mb-2">
                       <p>ℹ️ As horas de voo foram somadas automaticamente a partir do <strong>Diário Operacional</strong> ou tempo decorrido. Você pode ajustar se necessário.</p>
                    </div>

                    <Input
                        label="Horas Totais de Voo"
                        type="number"
                        step="0.1"
                        value={finishData.flight_hours}
                        onChange={e => setFinishData({...finishData, flight_hours: Number(e.target.value)})}
                        required
                    />
                    <div>
                        <label className="text-sm font-medium text-slate-700">Relatório Final / Observações</label>
                        <textarea
                            className="w-full p-3 border border-slate-300 rounded-lg text-sm h-32 resize-none focus:ring-2 focus:ring-green-500 outline-none"
                            value={finishData.description}
                            onChange={e => setFinishData({...finishData, description: e.target.value})}
                            placeholder="Descreva o desfecho da operação..."
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button type="button" variant="outline" onClick={() => setIsFinishing(null)}>Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-green-600 text-white hover:bg-green-700 shadow-md">
                            {loading ? 'Encerrando...' : 'Confirmar Encerramento'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
      )}

      {/* Mapa (Esquerda) */}
      <div className="flex-1 w-full relative z-0 order-1 lg:order-1 border-b lg:border-r border-slate-200 min-w-0 min-h-0">
        <MapContainer center={[-25.2521, -52.0215]} zoom={8} style={{ height: '100%', width: '100%' }}>
          <MapController isPanelCollapsed={isPanelCollapsed} />
          <TileLayer attribution='OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeomanController initialShapes={formData.shapes} onUpdate={(g:any) => setFormData(p => ({...p, shapes: g}))} editable={isCreating} controllerKey={`geo-${isEditing}-${geoKey}`} drawRequest={drawRequest} />
          <LocationSelector onLocationSelect={handleLocationSelect} isSelecting={isCreating} />
          
          <ResourceLayer 
             pilots={pilots} 
             drones={drones} 
             showUnits={showUnits}
             showPilots={showPilots}
             showDrones={showDrones}
          />

          {isCreating && (
             <MapRecenter lat={formData.latitude} lng={formData.longitude} />
          )}

          {isCreating && isValidCoord(formData.latitude, formData.longitude) && (
             <>
               <Marker position={[formData.latitude, formData.longitude]} icon={tempIcon}>
                  <Popup>
                     <div className="text-center">
                        <strong className="block text-red-600">Nova Operação</strong>
                        <span className="text-xs">Lat: {formData.latitude}<br/>Lng: {formData.longitude}</span>
                     </div>
                  </Popup>
               </Marker>
               <Circle 
                  center={[formData.latitude, formData.longitude]} 
                  radius={Number(formData.radius) || 500} 
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1, dashArray: '5, 5' }} 
               />
             </>
          )}

          {activeOps.map(op => {
             if (!isValidCoord(op.latitude, op.longitude)) return null;
             if (isEditing === op.id) return null;

             const pilot = pilots.find(p => p.id === op.pilot_id);
             const drone = drones.find(d => d.id === op.drone_id);

             return (
               <React.Fragment key={op.id}>
                  <Marker position={[op.latitude, op.longitude]} icon={icon}>
                     <Popup>
                        <div className="p-1 min-w-[200px]">
                            <strong className="text-sm block text-slate-900 border-b pb-1 mb-1">{op.name}</strong>
                            <span className="text-[10px] text-slate-500 block mb-1 font-mono">#{op.occurrence_number}</span>
                            
                            <div className="space-y-1 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                                <div className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span className="font-bold">Piloto:</span> {pilot?.full_name || op.pilot_name || 'N/A'}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Plane className="w-3 h-3 text-slate-400" />
                                    <span className="font-bold">RPA:</span> {drone ? `${drone.prefix} - ${drone.model}` : 'N/A'}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-slate-400" />
                                    <span className="font-bold">Unidade:</span> {pilot?.unit || 'N/A'}
                                </div>
                                {pilot?.crbm && (
                                    <div className="text-[10px] text-slate-500 pl-4">{pilot.crbm}</div>
                                )}
                            </div>
                        </div>
                     </Popup>
                  </Marker>
                  <Circle 
                     center={[op.latitude, op.longitude]} 
                     radius={op.radius || 500} 
                     pathOptions={{ color: op.is_paused ? '#f59e0b' : '#3388ff', fillColor: op.is_paused ? '#f59e0b' : '#3388ff', fillOpacity: 0.1 }} 
                  />
               </React.Fragment>
             )
          })}
        </MapContainer>
        
        {/* Layer Toggle Control (Updated) */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
           <button 
              onClick={() => setShowUnits(!showUnits)} 
              className={`p-2 rounded-lg shadow-md border text-xs font-bold transition-all flex items-center justify-between w-32 ${showUnits ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
           >
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Unidades</span>
              <div className={`w-2 h-2 rounded-full ${showUnits ? 'bg-green-400' : 'bg-slate-300'}`}></div>
           </button>
           
           <button 
              onClick={() => setShowPilots(!showPilots)} 
              className={`p-2 rounded-lg shadow-md border text-xs font-bold transition-all flex items-center justify-between w-32 ${showPilots ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-500 border-slate-200'}`}
           >
              <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Pilotos</span>
              <div className={`w-2 h-2 rounded-full ${showPilots ? 'bg-green-400' : 'bg-slate-300'}`}></div>
           </button>

           <button 
              onClick={() => setShowDrones(!showDrones)} 
              className={`p-2 rounded-lg shadow-md border text-xs font-bold transition-all flex items-center justify-between w-32 ${showDrones ? 'bg-orange-600 text-white border-orange-700' : 'bg-white text-slate-500 border-slate-200'}`}
           >
              <span className="flex items-center gap-2"><Plane className="w-4 h-4" /> Frota</span>
              <div className={`w-2 h-2 rounded-full ${showDrones ? 'bg-green-400' : 'bg-slate-300'}`}></div>
           </button>
        </div>

        {isCreating && (
            <div className="absolute bottom-8 right-8 z-[1000] flex flex-col gap-2">
                <div className="bg-white px-3 py-1 rounded shadow text-xs font-bold text-slate-600 mb-1">
                   Clique no mapa para posicionar
                </div>
            </div>
        )}
      </div>

      {/* Painel Lateral (Direita) */}
      <div className={`bg-white z-10 flex flex-col shadow-xl overflow-hidden order-2 lg:order-2 transition-all duration-300 ease-in-out flex-shrink-0 lg:h-full lg:border-l lg:border-t-0 ${isPanelCollapsed ? 'lg:w-0 lg:border-0' : 'lg:w-[28rem]'} w-full border-t border-slate-200 ${isPanelCollapsed ? 'h-0 border-0' : 'h-[55vh]'}`}>
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full lg:min-w-[28rem]">
            {isCreating ? (
            <>
                <div className="p-4 border-b flex items-center justify-between bg-slate-50 shrink-0">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-lg text-slate-800">{isEditing ? 'Gerenciar Operação' : 'Nova Operação'}</h2>
                        <button onClick={() => setIsPanelCollapsed(true)} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronsRight className="w-5 h-5 hidden lg:block" /></button>
                    </div>
                    <Button variant="outline" onClick={handleCancelForm} size="sm"><X className="w-4 h-4"/></Button>
                </div>

                {isEditing && (
                   <div className="flex border-b border-slate-200 bg-white">
                      <button 
                        onClick={() => setEditTab('details')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${editTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                      >
                         Detalhes Gerais
                      </button>
                      
                      {formData.is_multi_day && (
                        <button 
                            onClick={() => setEditTab('daily_log')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${editTab === 'daily_log' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Diário Operacional
                        </button>
                      )}
                   </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {editTab === 'details' ? (
                        <form id="opForm" onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-3">
                                <Input label="Nome da Operação" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                                <Select label="Aeronave Principal" required value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Select 
                                    label="Natureza da Missão" 
                                    value={formData.mission_type} 
                                    onChange={e => setFormData({...formData, mission_type: e.target.value as MissionType})}
                                >
                                    {Object.entries(MISSION_HIERARCHY).map(([key, value]) => (
                                        <option key={key} value={key}>{value.label}</option>
                                    ))}
                                </Select>
                                {currentSubtypes.length > 0 ? (
                                    <Select
                                        label="Sub-classificação"
                                        value={formData.sub_mission_type}
                                        onChange={e => setFormData({...formData, sub_mission_type: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        {currentSubtypes.map(sub => (
                                            <option key={sub} value={sub}>{sub}</option>
                                        ))}
                                    </Select>
                                ) : (
                                    <Input 
                                        label="Sub-classificação" 
                                        value={formData.sub_mission_type} 
                                        onChange={e => setFormData({...formData, sub_mission_type: e.target.value})}
                                        placeholder="Especifique"
                                    />
                                )}
                            </div>

                            <div className="space-y-3 p-3 bg-slate-50 rounded border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-500 uppercase border-b pb-1 mb-2">Equipe e Responsáveis</h3>
                                <Input 
                                    label="Piloto em Comando (PIC) *" 
                                    list="pilots-list" 
                                    value={formData.pilot_name} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        const found = pilots.find(p => p.full_name === val);
                                        setFormData({...formData, pilot_name: val, pilot_id: found ? found.id : ''});
                                    }}
                                    placeholder="Digite para buscar..."
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input 
                                        label="2º Piloto (Opcional)" 
                                        list="pilots-list"
                                        value={formData.second_pilot_name || ''} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            const found = pilots.find(p => p.full_name === val);
                                            setFormData({...formData, second_pilot_name: val, second_pilot_id: found ? found.id : ''});
                                        }}
                                        placeholder="Nome"
                                    />
                                    <Input 
                                        label="Observador (Opcional)" 
                                        list="pilots-list"
                                        value={formData.observer_name || ''} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            const found = pilots.find(p => p.full_name === val);
                                            setFormData({...formData, observer_name: val, observer_id: found ? found.id : ''});
                                        }}
                                        placeholder="Nome"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Input 
                                   label="Latitude" 
                                   type="number"
                                   step="any"
                                   value={formData.latitude} 
                                   onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value) || 0})}
                                   className="bg-white" 
                                />
                                <Input 
                                   label="Longitude" 
                                   type="number"
                                   step="any"
                                   value={formData.longitude} 
                                   onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value) || 0})}
                                   className="bg-white" 
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <Input 
                                    label="Raio (m)" 
                                    type="number" 
                                    value={formData.radius} 
                                    onChange={e => setFormData({...formData, radius: Number(e.target.value)})}
                                />
                                <Input 
                                    label="Altitude Máx (m)" 
                                    type="number" 
                                    value={formData.flight_altitude} 
                                    onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase border-b pb-1 block">Data e Horário</label>
                                <Input 
                                    label="Data da Ocorrência" 
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    className="bg-white border-blue-200"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input 
                                        label="Início (Local)" 
                                        type="time" 
                                        value={formData.start_time_local} 
                                        onChange={e => setFormData({...formData, start_time_local: e.target.value})}
                                    />
                                    <Input 
                                        label="Término Previsto" 
                                        type="time" 
                                        value={formData.end_time_local} 
                                        onChange={e => setFormData({...formData, end_time_local: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Descrição / Notas</label>
                                <textarea 
                                    className="w-full p-2 border border-slate-300 rounded text-sm h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    placeholder="Detalhes da operação..."
                                />
                            </div>

                            <Input 
                                label="Link de Transmissão (Opcional)" 
                                placeholder="RTMP / YouTube / DroneDeploy"
                                value={formData.stream_url} 
                                onChange={e => setFormData({...formData, stream_url: e.target.value})}
                            />

                            <div className="space-y-4 py-2 border-t border-b border-slate-100 my-2">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                                            <Send className="w-4 h-4 text-blue-600" />
                                            Integração SARPAS
                                        </label>
                                        <Badge variant="warning" className="text-[10px] flex items-center gap-1">
                                            <Hammer className="w-3 h-3" /> Em Construção
                                        </Badge>
                                    </div>
                                    
                                    <Input
                                        label="Protocolo SARPAS (Manual)"
                                        placeholder="Ex: BR-2024-..."
                                        value={formData.sarpas_protocol}
                                        onChange={e => setFormData({...formData, sarpas_protocol: e.target.value})}
                                        className="bg-white"
                                        labelClassName="text-xs text-slate-500 font-normal"
                                    />
                                </div>

                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                    <label className="flex items-center gap-3 cursor-pointer mb-2">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 accent-orange-600"
                                            checked={isSummerOp}
                                            onChange={e => setIsSummerOp(e.target.checked)}
                                        />
                                        <div>
                                            <span className="font-bold text-slate-800 text-sm block flex items-center gap-2">
                                                <Sun className="w-4 h-4 text-orange-600" />
                                                Vincular à Operação Verão
                                            </span>
                                        </div>
                                    </label>
                                    
                                    {isSummerOp && (
                                        <div className="grid grid-cols-2 gap-2 mt-2 animate-fade-in pl-8">
                                            <Select 
                                                value={summerCity} 
                                                onChange={e => { setSummerCity(e.target.value); setSummerPost(""); }}
                                                className="text-xs"
                                            >
                                                <option value="">Selecione a Cidade...</option>
                                                {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                                            </Select>
                                            <Select 
                                                value={summerPost} 
                                                onChange={e => setSummerPost(e.target.value)}
                                                className="text-xs"
                                                disabled={!summerCity}
                                            >
                                                <option value="">Selecione o Posto...</option>
                                                {summerCity && SUMMER_LOCATIONS[summerCity]?.map(post => <option key={post} value={post}>{post}</option>)}
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 accent-blue-600"
                                            checked={formData.is_multi_day}
                                            onChange={e => setFormData({...formData, is_multi_day: e.target.checked})}
                                        />
                                        <div>
                                            <span className="font-bold text-slate-800 text-sm block">A ocorrência vai se estender por mais de um dia?</span>
                                            <span className="text-xs text-slate-500">Habilita a aba "Diário Operacional" após salvar.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-100 flex gap-3">
                                <Button type="button" variant="outline" onClick={handleCancelForm} className="flex-1">Cancelar</Button>
                                <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
                            </div>
                        </form>
                    ) : (
                        <OperationDailyLog operationId={isEditing!} pilots={pilots} drones={drones} currentUser={currentUser} />
                    )}
                </div>
            </>
            ) : (
            <>
                <div className="p-4 border-b flex flex-col gap-4 bg-slate-50 shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-lg text-slate-800">Operações</h2>
                            <button onClick={() => setIsPanelCollapsed(true)} className="p-1 hover:bg-slate-200 rounded text-slate-500 ml-2"><ChevronsRight className="w-5 h-5 hidden lg:block" /></button>
                        </div>
                        <Button onClick={() => { setFormData(initialFormState); setIsCreating(true); setIsPanelCollapsed(false); }} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova</Button>
                    </div>
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                        <button className={`flex-1 py-1.5 text-xs font-bold rounded-md ${activeTab === 'active' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setActiveTab('active')}>Ativas</button>
                        <button className={`flex-1 py-1.5 text-xs font-bold rounded-md ${activeTab === 'history' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setActiveTab('history')}>Histórico</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {displayedOps.map(op => (
                        <div key={op.id} className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow relative border-l-4 ${op.is_paused ? 'border-l-amber-500 bg-amber-50/20' : 'border-l-green-500'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-slate-800 text-sm truncate pr-2">{op.name}</h3>
                                {op.is_paused ? <Badge variant="warning" className="text-[9px] uppercase animate-pulse">Pausada</Badge> : <Badge variant="success" className="text-[10px] uppercase">Ativa</Badge>}
                            </div>
                            <div className="text-xs text-slate-500 space-y-1">
                                <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(op.start_time).toLocaleString()}</div>
                                <div className="flex items-center gap-1"><User className="w-3 h-3" /> {op.pilot_name || 'N/I'}</div>
                            </div>
                            {/* Action Buttons Row */}
                            <div className="mt-3 flex gap-2 border-t pt-2">
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => handleShareOp(op)} title="Compartilhar WhatsApp">
                                    <Share2 className="w-3 h-3" />
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={`h-8 w-8 p-0 ${op.is_paused ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100' : 'border-amber-300 text-amber-600 hover:bg-amber-50'}`} 
                                    onClick={() => handleTogglePause(op)} 
                                    title={op.is_paused ? "Retomar Operação" : "Pausar Operação"}
                                >
                                    {op.is_paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                </Button>

                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleStartEdit(op)} title="Editar"><Pencil className="w-3 h-3" /></Button>
                                <Button size="sm" className="flex-1 h-8 text-xs bg-slate-800 text-white" onClick={() => setIsFinishing(op)}><CheckSquare className="w-3 h-3 mr-1" /> Encerrar</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
            )}
        </div>
      </div>
      <datalist id="pilots-list">{pilots.map(p => <option key={p.id} value={p.full_name} />)}</datalist>
    </div>
  );
}
