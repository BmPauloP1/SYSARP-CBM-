
import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, CircleMarker, Polygon, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { base44 } from "../services/base44Client";
import { tacticalService, TacticalSector, TacticalPOI } from "../services/tacticalService"; 
import { SUMMER_LOCATIONS } from "../types_summer"; 
import OperationDailyLog from "../components/OperationDailyLog";
import { Operation, Drone, Pilot, MISSION_HIERARCHY, MISSION_COLORS, MISSION_LABELS, ORGANIZATION_CHART } from "../types";
import { Button, Input, Select, Badge, Card } from "../components/ui_components";
import { 
  Plus, Clock, User, X, Radio, Plane, 
  Shield, MapPin, LocateFixed, Users, 
  CheckSquare, Phone, Building2, Share2, 
  Pause, Play, Pencil, Ban, CheckCircle, 
  Crosshair, Loader2, Save, FileText, Navigation, AlertTriangle, Map as MapIcon, Info, Youtube, Link as LinkIcon, Sun, Calendar, Zap, Hexagon, MousePointer2, Anchor, Target, Trash2, RotateCcw, Flag
} from "lucide-react";
import { useNavigate } from "react-router-dom"; 

const UNIT_COORDS: Record<string, [number, number]> = {
  "1º BBM": [-25.4397, -49.2719], "2º BBM": [-25.0950, -50.1614], "3º BBM": [-23.3103, -51.1628],
  "4º BBM": [-24.9555, -53.4552], "5º BBM": [-23.4209, -51.9331], "6º BBM": [-25.5348, -49.1921],
  "7º BBM": [-25.2917, -49.2242], "8º BBM": [-25.5149, -48.5224], "9º BBM": [-25.5478, -54.5881],
  "10º BBM": [-26.0779, -53.0515], "11º BBM": [-23.5505, -51.4614], "12º BBM": [-25.3935, -51.4622],
  "13º BBM": [-26.2295, -52.6712], "1ª CIBM": [-24.2464, -51.6835], "2ª CIBM": [-23.7661, -53.3216],
  "3ª CIBM": [-23.2947, -50.0782], "4ª CIBM": [-23.6637, -52.6044], "5ª CIBM": [-23.0841, -52.4633],
  "6ª CIBM": [-25.4674, -50.6514], "BOA": [-25.4031, -49.2321], "GOST": [-25.4621, -49.2483],
  "QCGBM": [-25.4284, -49.2733], "1º CRBM": [-25.4397, -49.2719], "2º CRBM": [-23.3103, -51.1628],
  "3º CRBM": [-24.9555, -53.4552], "4º CRBM": [-23.4209, -51.9331], "5º CRBM": [-25.0950, -50.1614]
};

const getUnitLocationInfo = (unit?: string, crbm?: string) => {
    const searchString = (unit || crbm || "").toUpperCase();
    if (!searchString) return null;
    const sortedKeys = Object.keys(UNIT_COORDS).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        if (searchString.includes(key.toUpperCase())) return { name: key, coords: UNIT_COORDS[key] };
    }
    return null;
};

// Cores táticas para rotação
const TACTICAL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

// Componente para controlar cliques e Geoman no mapa do modal
const LocationSelectorMap = ({ mode, center, radius, onPositionChange, onElementCreated }: any) => {
    const map = useMap();
    
    useEffect(() => { setTimeout(() => map.invalidateSize(), 400) }, [map]);

    // Integração com Geoman para desenho tático
    useEffect(() => {
        if (!map || !map.pm) return;

        // Limpa controles anteriores
        map.pm.disableDraw();

        const drawOptions = {
            snappable: true,
            snapDistance: 20,
            hintlineStyle: { color: '#3b82f6', dashArray: [5, 5] },
            tooltips: true,
            cursorMarker: true,
            finishOn: 'dblclick',
        };

        if (mode === 'polygon') {
            map.pm.enableDraw('Polygon', { ...drawOptions, pathOptions: { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 } });
        } else if (mode === 'line') {
            map.pm.enableDraw('Line', { ...drawOptions, pathOptions: { color: '#f59e0b', weight: 4, dashArray: '5, 10' } });
        } else if (mode === 'poi') {
            map.pm.enableDraw('Marker', drawOptions);
        }

        const handleCreate = (e: any) => {
            const layer = e.layer;
            const geojson = layer.toGeoJSON();
            
            // Passa o elemento criado para o componente pai
            onElementCreated({
                type: e.shape, // 'Polygon', 'Line', 'Marker'
                geojson: geojson
            });
            
            // Remove a layer do Geoman pois renderizamos via React baseado no estado
            map.removeLayer(layer);
        };

        map.on('pm:create', handleCreate);

        return () => {
            map.off('pm:create', handleCreate);
            if (map.pm) map.pm.disableDraw();
        };
    }, [map, mode, onElementCreated]);

    useMapEvents({
        click(e) {
            if (mode === 'pc') {
                // Modo PC: Define o centro da operação
                onPositionChange(e.latlng.lat, e.latlng.lng);
            }
        }
    });

    return (
        <>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {/* Visualização do PC (Ponto de Controle) - Sempre visível */}
            <Circle center={center} radius={radius} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, dashArray: '5, 10', weight: 2 }} />
            <Marker position={center} icon={L.divIcon({ className: '', html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })}>
               <Popup>PC / Ponto Zero</Popup>
            </Marker>
        </>
    );
};

const createTacticalIcon = (bgColor: string, iconType: 'drone' | 'pilot' | 'poi', count: number = 0) => {
    let iconSvg = '';
    
    if (iconType === 'drone') iconSvg = '<path d="M21 16.5c0 .38-.21.71-.53.88l-7.97 4.43c-.16.09-.33.14-.5.14s-.34-.05-.5-.14l-7.97 4.43c-.32-.17-.53-.5-.53-.88v-9c0-.38.21-.71.53-.88l7.97-4.43c.16-.09.33-.14.5-.14s.34.05.5.14l7.97 4.43c.32.17.53.5.53.88v9z"/>';
    else if (iconType === 'poi') iconSvg = '<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>';
    else iconSvg = '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>';

    const size = iconType === 'poi' ? 24 : 32;
    const anchor = size / 2;

    return L.divIcon({
        className: 'tactical-marker',
        html: `<div style="position: relative; background-color: ${bgColor}; width: ${size}px; height: ${size}px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4); border: 2px solid white;"><svg viewBox="0 0 24 24" fill="white" style="width:${size * 0.6}px; height:${size * 0.6}px;">${iconSvg}</svg>${count > 1 ? `<div style="position: absolute; top: -10px; right: -10px; background: #ef4444; color: white; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${count}</div>` : ''}<div style="position: absolute; bottom: -6px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid white;"></div></div>`,
        iconSize: [size, size], iconAnchor: [anchor, size], popupAnchor: [0, -size]
    });
};

const UserLocationLayer = ({ active }: { active: boolean }) => {
    const map = useMap();
    const [pos, setPos] = useState<[number, number] | null>(null);
    useEffect(() => {
        if (!active) { setPos(null); return; }
        map.locate({ setView: true, maxZoom: 15 });
        const handleFound = (e: L.LocationEvent) => setPos([e.latlng.lat, e.latlng.lng]);
        map.on('locationfound', handleFound);
        return () => { map.off('locationfound', handleFound); };
    }, [map, active]);
    if (!pos) return null;
    return (
        <React.Fragment>
            <Circle center={pos} radius={200} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }} />
            <CircleMarker center={pos} radius={8} pathOptions={{ color: 'white', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }} />
        </React.Fragment>
    );
};

export default function OperationManagement() {
  const navigate = useNavigate();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(false);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [mapLayers, setMapLayers] = useState({ gps: false, ops: true, drones: false, pilots: true });
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);

  // Global Tactical Data (for main map)
  const [globalTacticalData, setGlobalTacticalData] = useState<{sectors: TacticalSector[], pois: TacticalPOI[]}>({ sectors: [], pois: [] });

  const [controlModal, setControlModal] = useState<{type: 'pause' | 'cancel' | 'end' | null, op: Operation | null}>({type: null, op: null});
  const [reason, setReason] = useState('');
  const [cancelConfirmed, setCancelConfirmed] = useState(false); // Checkbox state for cancel
  
  // Alterado: flightHours agora é armazenado como string "HH:MM" para input, convertido depois
  const [flightDurationStr, setFlightDurationStr] = useState("00:00");
  const [actionsTaken, setActionsTaken] = useState('');

  // Estados específicos para o Item 4 (Mapa Tático no Modal)
  const [modalMapMode, setModalMapMode] = useState<'pc' | 'polygon' | 'line' | 'poi'>('pc');
  // Armazena elementos temporários antes de salvar
  const [plannedElements, setPlannedElements] = useState<{
      sectors: Partial<TacticalSector>[],
      pois: Partial<TacticalPOI>[]
  }>({ sectors: [], pois: [] });

  // Summer Op States for Modal
  const [summerCity, setSummerCity] = useState("");
  const [summerPgv, setSummerPgv] = useState("");

  // FORM DATA
  const [formData, setFormData] = useState({ 
    id: '', 
    name: '', 
    occurrence_number: '', 
    mission_type: 'diverse' as any, 
    sub_mission_type: '',
    pilot_id: '', 
    observer_name: '',
    drone_id: '', 
    latitude: -25.42, 
    longitude: -49.27, 
    radius: 200, 
    flight_altitude: 60, 
    description: '',
    stream_url: '',
    sarpas_protocol: '',
    is_summer_op: false,
    is_multi_day: false,
    op_crbm: '',
    op_unit: '',
    start_date: new Date().toISOString().split('T')[0],
    start_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
    estimated_end_time: '',
    takeoff_points: [] as {lat: number, lng: number, alt: number}[],
    shapes: null as any
  });

  useEffect(() => { loadData(); }, []);

  // Fetch Global Tactical Data for Active Operations
  useEffect(() => {
    const loadGlobalTactical = async () => {
        let allSectors: TacticalSector[] = [];
        let allPois: TacticalPOI[] = [];
        
        const activeOps = operations.filter(o => o.status === 'active');
        
        for (const op of activeOps) {
            try {
                const s = await tacticalService.getSectors(op.id);
                const p = await tacticalService.getPOIs(op.id);
                allSectors = [...allSectors, ...s];
                allPois = [...allPois, ...p];
            } catch(e) { console.warn("Tactical fetch error", e); }
        }
        setGlobalTacticalData({ sectors: allSectors, pois: allPois });
    };
    
    if(operations.length > 0) loadGlobalTactical();
  }, [operations]);

  const loadData = async () => {
    try {
      const [ops, pils, drns, me] = await Promise.all([
        base44.entities.Operation.list('-created_at'), 
        base44.entities.Pilot.list(), 
        base44.entities.Drone.list(),
        base44.auth.me()
      ]);
      setOperations(ops); setPilots(pils); setDrones(drns); setCurrentUser(me);
    } catch(e) {}
  };

  const handleOpenNewMission = () => {
      setFormData({
          id: '', name: '', occurrence_number: '', 
          mission_type: 'diverse', sub_mission_type: '', pilot_id: '', observer_name: '', drone_id: '', 
          latitude: -25.4284, longitude: -49.2733, radius: 200, 
          flight_altitude: 60, description: '', stream_url: '', sarpas_protocol: '',
          is_summer_op: false, is_multi_day: false, op_crbm: '', op_unit: '',
          start_date: new Date().toISOString().split('T')[0],
          start_time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
          estimated_end_time: '', takeoff_points: [], shapes: null
      });
      setModalMapMode('pc');
      setPlannedElements({ sectors: [], pois: [] });
      setSummerCity("");
      setSummerPgv("");
      setIsMissionModalOpen(true);
  };

  const handleEditMission = async (op: Operation) => {
      // Carregar elementos táticos existentes
      let existingSectors: any[] = [];
      let existingPOIs: any[] = [];
      
      try {
          const [s, p] = await Promise.all([
              tacticalService.getSectors(op.id),
              tacticalService.getPOIs(op.id)
          ]);
          existingSectors = s;
          existingPOIs = p;
      } catch(e) {
          console.warn("Erro ao carregar dados táticos:", e);
      }

      // CORREÇÃO DE BUG DE DATA/HORA:
      // Parsing manual da string ISO para evitar conversão de fuso horário indesejada.
      let sDate = '';
      let sTime = '';
      if (op.start_time) {
          if (op.start_time.includes('T')) {
              const parts = op.start_time.split('T');
              sDate = parts[0];
              // Pega HH:MM sem converter para local
              sTime = parts[1].substring(0, 5); 
          } else {
              // Fallback para datas legadas
              const d = new Date(op.start_time);
              sDate = d.toISOString().split('T')[0];
              sTime = d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
          }
      }

      setFormData({
          id: op.id, 
          name: op.name, 
          occurrence_number: op.occurrence_number,
          mission_type: op.mission_type, 
          sub_mission_type: op.sub_mission_type || '',
          pilot_id: op.pilot_id, 
          observer_name: op.observer_name || '',
          drone_id: op.drone_id, 
          latitude: op.latitude, 
          longitude: op.longitude,
          radius: op.radius, 
          flight_altitude: op.flight_altitude || 60,
          description: op.description || '',
          stream_url: op.stream_url || '',
          sarpas_protocol: op.sarpas_protocol || '',
          is_summer_op: op.is_summer_op || false,
          is_multi_day: op.is_multi_day || false,
          op_crbm: op.op_crbm || '',
          op_unit: op.op_unit || '',
          start_date: sDate,
          start_time: sTime,
          estimated_end_time: op.estimated_end_time || '',
          takeoff_points: Array.isArray(op.takeoff_points) ? op.takeoff_points : [],
          shapes: op.shapes
      });
      
      setPlannedElements({
          sectors: existingSectors,
          pois: existingPOIs
      });

      // Try to parse summer info from fields if marked as summer op
      if (op.is_summer_op) {
          // Heuristic: If city name is in op_unit, use it.
          const foundCity = Object.keys(SUMMER_LOCATIONS).find(c => op.op_unit?.includes(c));
          if (foundCity) {
              setSummerCity(foundCity);
              // Try to find PGV in description or name
              const desc = op.description || '';
              const foundPgv = SUMMER_LOCATIONS[foundCity].find(p => desc.includes(p));
              if (foundPgv) setSummerPgv(foundPgv);
          }
      } else {
          setSummerCity("");
          setSummerPgv("");
      }

      setModalMapMode('pc');
      setIsMissionModalOpen(true);
  };

  // Callback quando o usuário desenha no mapa do modal
  const handleMapElementCreated = (e: { type: string, geojson: any }) => {
      if (e.type === 'Marker') {
          // Criar POI
          const [lng, lat] = e.geojson.geometry.coordinates;
          const newPOI = {
              name: `Ponto ${plannedElements.pois.length + 1}`,
              type: 'interest',
              lat,
              lng,
              description: 'Criado no planejamento'
          } as Partial<TacticalPOI>;
          setPlannedElements(prev => ({ ...prev, pois: [...prev.pois, newPOI] }));
      } else {
          // Criar Setor (Polígono) ou Rota (Linha)
          const isRoute = e.type === 'Line';
          const newSector = {
              name: isRoute ? `Rota ${plannedElements.sectors.length + 1}` : `Área ${plannedElements.sectors.length + 1}`,
              type: isRoute ? 'route' : 'sector',
              color: TACTICAL_COLORS[plannedElements.sectors.length % TACTICAL_COLORS.length],
              geojson: e.geojson.geometry,
              notes: 'Planejado'
          } as Partial<TacticalSector>;
          setPlannedElements(prev => ({ ...prev, sectors: [...prev.sectors, newSector] }));
      }
      setModalMapMode('pc'); // Volta para modo normal após desenhar
  };

  const handleSaveMission = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const finalStartTime = `${formData.start_date}T${formData.start_time}:00`;
          
          // Remove fields that are not columns in the database (start_date)
          // Also remove occurrence_number if it's empty (so DB generates it, or we do it below)
          const { start_date, id, occurrence_number, ...dataToSave } = formData;

          // Summer Logic: Inject city and PGV
          let finalDescription = dataToSave.description;
          let finalUnit = dataToSave.op_unit;
          let finalName = dataToSave.name;

          if (dataToSave.is_summer_op) {
              if (summerCity) finalUnit = summerCity; // Override unit with City
              if (summerPgv) {
                  finalDescription = `${finalDescription || ''}\n[PGV]: ${summerPgv}`.trim();
                  // Optionally prefix name
                  if (!finalName.startsWith("VERÃO:")) finalName = `VERÃO: ${finalName}`;
              }
          }

          const payload = { 
              ...dataToSave, 
              name: finalName,
              description: finalDescription,
              op_unit: finalUnit,
              start_time: finalStartTime
          };
          
          let opId = id;

          if (opId) {
              await base44.entities.Operation.update(opId, payload);
          } else {
              // --- GENERATION LOGIC START ---
              const now = new Date();
              const year = now.getFullYear();
              
              // 1. Unit Code
              let unitSource = payload.op_unit;
              if (!unitSource && payload.pilot_id) {
                  const p = pilots.find(x => x.id === payload.pilot_id);
                  if (p) unitSource = p.unit || p.crbm;
              }
              // Fallback
              if (!unitSource) unitSource = "Geral";

              // Clean: "2º BBM - Ponta Grossa" -> "2BBM"
              // Remove non-alphanumeric, take first part split by '-'
              const unitClean = unitSource.split('-')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

              // 2. Sequence (PER UNIT)
              // Calculate prefix to filter by: YYYY + ARP + UNIT
              const protocolPrefix = `${year}ARP${unitClean}`;
              
              let seq = 1;
              
              // Filter existing operations that match this specific unit/year prefix
              // We use the 'operations' state which contains all current ops
              const unitOps = operations.filter(op => 
                  op.occurrence_number && op.occurrence_number.startsWith(protocolPrefix)
              );

              if (unitOps.length > 0) {
                  // Extract the sequence number (last 5 digits) from each matching op
                  const sequences = unitOps.map(op => {
                      const match = op.occurrence_number.match(/(\d{5})$/);
                      return match ? parseInt(match[1], 10) : 0;
                  });
                  
                  // Find max and increment
                  const maxSeq = Math.max(...sequences);
                  seq = maxSeq + 1;
              }
              
              const seqStr = String(seq).padStart(5, '0');

              // 3. Final Protocol
              const autoProtocol = `${protocolPrefix}${seqStr}`;
              // --- GENERATION LOGIC END ---

              const newOp = await base44.entities.Operation.create({ 
                  ...payload, 
                  occurrence_number: autoProtocol, // Insert generated protocol
                  status: 'active' 
              } as any);
              opId = newOp.id;
              if (formData.drone_id) await base44.entities.Drone.update(formData.drone_id, { status: 'in_operation' });
          }

          // Salvar Elementos Táticos (Setores e POIs) via tacticalService
          // 1. Setores
          for (const sector of plannedElements.sectors) {
              // Se não tem ID, é novo
              if (!(sector as any).id) {
                  await tacticalService.createSector({
                      operation_id: opId,
                      name: sector.name || 'Área Planejada',
                      type: sector.type || 'sector',
                      color: sector.color || '#3b82f6',
                      geojson: sector.geojson
                  });
              }
          }
          // 2. POIs
          for (const poi of plannedElements.pois) {
              if (!(poi as any).id) {
                  await tacticalService.createPOI({
                      operation_id: opId,
                      name: poi.name || 'Ponto',
                      type: poi.type || 'interest',
                      lat: poi.lat!,
                      lng: poi.lng!
                  });
              }
          }

          setIsMissionModalOpen(false);
          loadData();
      } catch(e: any) { 
          console.error(e);
          alert(`Erro ao processar missão: ${e.message || 'Verifique os dados.'}`); 
      }
      finally { setLoading(false); }
  };

  const handleAction = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!controlModal.op) return;
      setLoading(true);
      try {
          const op = controlModal.op;
          if (controlModal.type === 'pause') {
              await base44.entities.Operation.update(op.id, { is_paused: !op.is_paused, notes: `${op.notes || ''}\n[PAUSA]: ${reason}` });
          } else if (controlModal.type === 'cancel') {
              await base44.entities.Operation.update(op.id, { status: 'cancelled', notes: `${op.notes || ''}\nCANCELADA: ${reason}` });
              if (op.drone_id) await base44.entities.Drone.update(op.drone_id, { status: 'available' });
          } else if (controlModal.type === 'end') {
              // Convert HH:MM duration to decimal flight_hours
              let decimalHours = 0;
              if (flightDurationStr) {
                  const [hh, mm] = flightDurationStr.split(':').map(Number);
                  if (!isNaN(hh) && !isNaN(mm)) {
                      decimalHours = hh + (mm / 60);
                  }
              }

              await base44.entities.Operation.update(op.id, { 
                  status: 'completed', 
                  flight_hours: decimalHours, 
                  actions_taken: actionsTaken, 
                  end_time: new Date().toISOString() 
              });
              
              if (op.drone_id) await base44.entities.Drone.update(op.drone_id, { status: 'available' });
          }
          setControlModal({type: null, op: null});
          setReason(''); 
          setFlightDurationStr("00:00"); 
          setActionsTaken('');
          setCancelConfirmed(false);
          loadData();
      } catch(e) { 
          console.error(e);
          alert("Erro ao processar."); 
      }
      finally { setLoading(false); }
  };

  const groupedPilots = useMemo(() => {
    const groups: Record<string, { coords: [number, number], pilots: Pilot[], label: string }> = {};
    pilots.filter(p => p.status === 'active').forEach(p => {
        const info = getUnitLocationInfo(p.unit, p.crbm);
        if (info) {
            if (!groups[info.name]) groups[info.name] = { coords: info.coords, pilots: [], label: info.name };
            groups[info.name].pilots.push(p);
        }
    });
    return groups;
  }, [pilots]);

  const groupedDrones = useMemo(() => {
    const groups: Record<string, { coords: [number, number], drones: Drone[], label: string }> = {};
    drones.forEach(d => {
        const info = getUnitLocationInfo(d.unit, d.crbm);
        if (info) {
            if (!groups[info.name]) groups[info.name] = { coords: info.coords, drones: [], label: info.name };
            groups[info.name].drones.push(d);
        }
    });
    return groups;
  }, [drones]);

  return (
    <div className="flex h-full w-full bg-slate-100 overflow-hidden relative">
      <div className="flex-1 relative z-0">
          <div className="absolute top-1/2 -translate-y-1/2 left-6 z-[1000] flex flex-col items-center bg-white py-4 px-2 rounded-[2.5rem] shadow-2xl border border-slate-200 gap-4 ring-8 ring-black/5">
              <button onClick={() => setMapLayers(p => ({...p, gps: !p.gps}))} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${mapLayers.gps ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}><LocateFixed className="w-6 h-6" /></button>
              <div className="w-8 h-px bg-slate-100" />
              <button onClick={() => setMapLayers(p => ({...p, ops: !p.ops}))} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${mapLayers.ops ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}><Radio className="w-6 h-6" /></button>
              <button onClick={() => setMapLayers(p => ({...p, drones: !p.drones}))} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${mapLayers.drones ? 'bg-[#f97316] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}><Plane className="w-6 h-6" /></button>
              <button onClick={() => setMapLayers(p => ({...p, pilots: !p.pilots}))} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${mapLayers.pilots ? 'bg-[#2563eb] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}><Users className="w-6 h-6" /></button>
          </div>

          <MapContainer center={[-24.8, -51.5]} zoom={7} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <UserLocationLayer active={mapLayers.gps} />
              
              {/* GLOBAL TACTICAL ELEMENTS (Global State Map) */}
              {mapLayers.ops && globalTacticalData.sectors.map(s => (
                  s.type === 'route' ? 
                  <Polyline key={`glob-s-${s.id}`} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 0) as any} pathOptions={{ color: s.color, dashArray: '5, 10', weight: 4 }} /> :
                  <Polygon key={`glob-s-${s.id}`} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillColor: s.color, fillOpacity: 0.15, weight: 2 }} />
              ))}
              {mapLayers.ops && globalTacticalData.pois.map(p => (
                  <Marker key={`glob-p-${p.id}`} position={[p.lat, p.lng]} icon={createTacticalIcon('#10b981', 'poi', 0)} />
              ))}

              {mapLayers.ops && operations.filter(o => o.status === 'active').map(op => {
                  const pilot = pilots.find(p => p.id === op.pilot_id);
                  const drone = drones.find(d => d.id === op.drone_id);
                  return (
                      <React.Fragment key={op.id}>
                          <Marker position={[op.latitude, op.longitude]} icon={L.divIcon({ className: 'op-marker', html: `<div style="background-color: ${MISSION_COLORS[op.mission_type]}; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.5);"></div>`, iconSize: [18, 18] })}>
                            <Popup className="tactical-popup">
                                <div className="min-w-[340px] font-sans">
                                    <div className="p-4 bg-white border-b border-slate-100">
                                        <h4 className="font-black text-slate-900 text-lg uppercase leading-none">{op.name}</h4>
                                        <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase tracking-tighter">#{op.occurrence_number}</p>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="inline-block bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border border-red-100">
                                            {MISSION_HIERARCHY[op.mission_type]?.label}
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                            <div className="flex items-center gap-3 text-sm font-bold text-slate-700 truncate"><User className="w-4 h-4 text-slate-400" /> Piloto: <span className="font-medium text-slate-600">{pilot?.full_name}</span></div>
                                            <div className="flex items-center gap-3 text-sm font-bold text-slate-700 truncate"><Plane className="w-4 h-4 text-slate-400" /> RPA: <span className="font-medium text-slate-600">{drone?.prefix} - {drone?.model}</span></div>
                                            <div className="flex items-start gap-3 text-sm font-bold text-slate-700"><Building2 className="w-4 h-4 text-slate-400 mt-0.5" /><div className="flex flex-col"><div className="text-sm font-bold text-slate-700 uppercase">Área / Unidade</div><div className="text-xs text-slate-500">{op.op_unit || pilot?.unit || 'N/A'}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{op.op_crbm || pilot?.crbm}</div></div></div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-black uppercase pt-3 border-t border-slate-100">
                                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(op.start_time).toLocaleTimeString()}</span>
                                            <span className="flex items-center gap-1.5 text-blue-600"><Navigation className="w-3.5 h-3.5" /> RAIO: {op.radius}M</span>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                          </Marker>
                      </React.Fragment>
                  );
              })}

              {/* POPUPS DE PILOTOS E DRONES */}
              {mapLayers.pilots && (Object.values(groupedPilots) as any[]).map((group, idx) => (
                    <Marker key={`p-g-${idx}`} position={group.coords} icon={createTacticalIcon('#2563eb', 'pilot', group.pilots.length)}>
                        <Popup className="tactical-popup">
                            <div className="min-w-[280px]">
                                <div className="bg-[#2563eb] p-3 text-white font-black text-[10px] uppercase text-center rounded-t-lg">PILOTOS ATIVOS - {group.label}</div>
                                <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
                                    {(group.pilots as Pilot[]).map((p: Pilot) => (
                                        <div key={p.id} className="flex justify-between items-center bg-slate-50 p-2.5 px-3 rounded-xl border border-slate-100 shadow-sm">
                                            <span className="font-bold text-slate-800 text-xs">{p.full_name}</span>
                                            <button onClick={() => window.open(`https://wa.me/55${p.phone.replace(/\D/g,'')}`)} className="text-green-500 hover:scale-110 transition-transform"><Phone className="w-4 h-4 fill-green-500 text-white" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
              ))}
              {mapLayers.drones && (Object.values(groupedDrones) as any[]).map((group, idx) => (
                    <Marker key={`d-g-${idx}`} position={group.coords} icon={createTacticalIcon('#f97316', 'drone', group.drones.length)}>
                         <Popup className="tactical-popup">
                            <div className="min-w-[260px]">
                                <div className="bg-[#f97316] p-3 text-white font-black text-[10px] uppercase text-center rounded-t-lg">AERONAVES - {group.label}</div>
                                <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
                                    {(group.drones as Drone[]).map((d: Drone) => (
                                        <div key={d.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                            <span className="font-black text-slate-800 text-xs">{d.prefix}</span>
                                            <Badge variant="success" className="text-[9px] font-black uppercase px-2">DISPONÍVEL</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
              ))}
          </MapContainer>
      </div>

      {/* PAINEL LATERAL DIREITO - FIEL À IMAGEM */}
      <div className="w-[450px] bg-white flex flex-col shadow-2xl z-10 border-l border-slate-200">
          <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
             <div><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Missões RPA</h2><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Monitoramento Tempo Real</p></div>
             <Button onClick={handleOpenNewMission} className="bg-red-700 hover:bg-red-800 text-white h-11 px-5 font-black text-[11px] uppercase shadow-lg"><Plus className="w-4 h-4 mr-2" /> Nova Missão</Button>
          </div>
          
          <div className="flex p-2 bg-slate-100 mx-6 mt-6 rounded-2xl shrink-0 border border-slate-200">
              <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'active' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Ativas</button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-red-700 shadow-md' : 'text-slate-500'}`}>Histórico</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
              {activeTab === 'active' ? (
                  operations.filter(o => o.status === 'active').map(op => {
                    const pilot = pilots.find(p => p.id === op.pilot_id);
                    return (
                      <Card key={op.id} className="bg-white border-l-[6px] border-l-red-600 shadow-xl p-6 flex flex-col gap-5 relative transition-all">
                          <div className="flex justify-between items-start">
                              <div className="min-w-0 flex-1">
                                  <h4 className="font-black text-slate-900 text-lg uppercase leading-none truncate">{op.name}</h4>
                                  <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase tracking-tighter font-bold">#{op.occurrence_number}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                 {op.is_paused && <Badge className="bg-amber-100 text-amber-700 border-none text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">PAUSADA</Badge>}
                                 <Badge className="bg-green-100 text-green-700 border-none text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm">EM ANDAMENTO</Badge>
                              </div>
                          </div>
                          <div className="space-y-3">
                              <div className="flex items-center gap-3 text-slate-500 font-black text-[11px] uppercase tracking-tighter"><Clock className="w-4 h-4 text-slate-300" /><span>{new Date(op.start_time).toLocaleString('pt-BR')}</span></div>
                              <div className="flex items-center gap-3 text-slate-500 font-black text-[11px] uppercase tracking-tighter"><User className="w-4 h-4 text-slate-300" /><span className="truncate">PIC: {pilot?.full_name}</span></div>
                          </div>
                          <div className="w-full h-px bg-slate-100 my-1" />
                          <div className="flex gap-2.5">
                              <button onClick={() => { const p = pilots.find(x => x.id === op.pilot_id); const d = drones.find(x => x.id === op.drone_id); const t = `🚨 *CCO SYSARP - MISSÃO* 🚨\n\n📌 *Título:* ${op.name}\n🔢 *Prot:* ${op.occurrence_number}\n👤 *PIC:* ${p?.full_name}\n🛡️ *RPA:* ${d?.prefix}\n🕒 *Início:* ${new Date(op.start_time).toLocaleString()}`; window.open(`https://wa.me/?text=${encodeURIComponent(t)}`); }} className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm"><Share2 className="w-5 h-5" /></button>
                              <button onClick={() => { setControlModal({type: 'pause', op}); setReason(''); }} className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors shadow-sm ${op.is_paused ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{op.is_paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}</button>
                              <button onClick={() => handleEditMission(op)} className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"><Pencil className="w-5 h-5" /></button>
                              <button onClick={() => navigate(`/operations/${op.id}/gerenciar`)} className="h-12 flex-1 rounded-xl bg-slate-900 text-white flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest"><Crosshair className="w-5 h-5 text-red-500 animate-pulse" /> CCO TÁTICO</button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-1 pt-2 border-t border-slate-50">
                              <button onClick={() => { setControlModal({type: 'cancel', op}); setReason(''); setCancelConfirmed(false); }} className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-500 font-black text-[11px] uppercase flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"><X className="w-4 h-4" /> Cancelar</button>
                              <button onClick={() => { setControlModal({type: 'end', op}); setFlightDurationStr("00:00"); setActionsTaken(''); }} className="flex-1 h-12 rounded-xl bg-red-600 text-white font-black text-[11px] uppercase flex items-center justify-center gap-2 shadow-xl shadow-red-200 hover:bg-red-700 transition-all"><CheckCircle className="w-4 h-4" /> Encerrar</button>
                          </div>
                      </Card>
                    );
                  })
              ) : (
                  operations.filter(o => o.status !== 'active').map(op => (
                      <Card key={op.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center shadow-sm opacity-80 hover:opacity-100 transition-all"><div className="min-w-0 flex-1"><p className="font-black text-slate-700 text-xs truncate uppercase leading-none">{op.name}</p><p className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase font-bold tracking-tighter">{new Date(op.start_time).toLocaleDateString()} • {op.occurrence_number}</p></div><Badge variant={op.status === 'completed' ? 'success' : 'danger'} className="text-[8px] font-black uppercase px-3 py-1 rounded-lg">{op.status === 'completed' ? 'CONCLUÍDA' : 'CANCELADA'}</Badge></Card>
                  ))
              )}
          </div>
      </div>

      {/* MODAL COMPLETO: LANÇAR OPERAÇÃO RPA (ITENS 1 A 10) */}
      {isMissionModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in">
              <Card className="w-full max-w-4xl h-[92vh] bg-white shadow-2xl rounded-[1.5rem] flex flex-col overflow-hidden border border-slate-200">
                  <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                      <h3 className="text-xl font-black uppercase tracking-tight text-[#1e293b] flex items-center gap-3">
                          <Radio className="w-6 h-6 text-red-600" />
                          {formData.id ? 'Atualizar Missão RPA' : 'Lançar Operação RPA'}
                      </h3>
                      <button onClick={() => setIsMissionModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400"/></button>
                  </div>

                  <form onSubmit={handleSaveMission} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[#f8fafc]">
                      
                      {/* 1. LOTAÇÃO OPERACIONAL */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-3.5 h-3.5"/> 1. Lotação Operacional</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <Select label="CRBM" value={formData.op_crbm} onChange={e => setFormData({...formData, op_crbm: e.target.value, op_unit: ''})} labelClassName="text-[11px] font-bold text-slate-600">
                                  <option value="">Selecione...</option>
                                  {Object.keys(ORGANIZATION_CHART).map(c => <option key={c} value={c}>{c}</option>)}
                              </Select>
                              <Select label="Unidade" value={formData.op_unit} onChange={e => setFormData({...formData, op_unit: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600">
                                  <option value="">Selecione...</option>
                                  {formData.op_crbm && ORGANIZATION_CHART[formData.op_crbm]?.map(u => <option key={u} value={u}>{u}</option>)}
                              </Select>
                          </div>
                      </div>

                      {/* 2. DADOS DA MISSÃO */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Navigation className="w-3.5 h-3.5"/> 2. Dados da Missão</h4>
                          {/* CAMPO DE PROTOCOLO REMOVIDO PARA EVITAR EDIÇÃO MANUAL/VISUALIZAÇÃO PRECOCE */}
                          <Input label="Título da Ocorrência" placeholder="Ex: Incêndio Urbano..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600" />
                          <div className="grid grid-cols-2 gap-4">
                              <Select label="Natureza" value={formData.mission_type} onChange={e => setFormData({...formData, mission_type: e.target.value as any})} labelClassName="text-[11px] font-bold text-slate-600">
                                  {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </Select>
                              <Select label="Subnatureza" value={formData.sub_mission_type} onChange={e => setFormData({...formData, sub_mission_type: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600">
                                  <option value="">Selecione...</option>
                                  {MISSION_HIERARCHY[formData.mission_type]?.subtypes.map(s => <option key={s} value={s}>{s}</option>)}
                              </Select>
                          </div>
                      </div>

                      {/* 3. EQUIPE E AERONAVE */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-3.5 h-3.5"/> 3. Equipe e Aeronave</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <Select label="Piloto (PIC)" required value={formData.pilot_id} onChange={e => setFormData({...formData, pilot_id: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600">
                                  <option value="">Selecione...</option>
                                  {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                              </Select>
                              <Select label="Aeronave (RPA)" required value={formData.drone_id} onChange={e => setFormData({...formData, drone_id: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600">
                                  <option value="">Selecione...</option>
                                  {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                              </Select>
                          </div>
                          <Input label="Observador / Auxiliar" placeholder="Nome do militar de apoio" value={formData.observer_name} onChange={e => setFormData({...formData, observer_name: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600" />
                      </div>

                      {/* 4. LOCALIZAÇÃO (MINI CCO TÁTICO) */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3.5 h-3.5"/> 4. Localização e Mapa Tático</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <Input label="Latitude PC" type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: Number(e.target.value)})} labelClassName="text-[11px] font-bold text-slate-600" />
                              <Input label="Longitude PC" type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: Number(e.target.value)})} labelClassName="text-[11px] font-bold text-slate-600" />
                              <Input label="Raio de Voo (m)" type="number" value={formData.radius} onChange={e => setFormData({...formData, radius: Number(e.target.value)})} labelClassName="text-[11px] font-bold text-slate-600" />
                              <Input label="Altitude Máx (m)" type="number" value={formData.flight_altitude} onChange={e => setFormData({...formData, flight_altitude: Number(e.target.value)})} labelClassName="text-[11px] font-bold text-slate-600" />
                          </div>
                          
                          {/* Botão para Mostrar/Esconder Mapa Tático */}
                          <div className="w-full bg-red-50 border border-red-100 rounded-lg p-2 text-center text-red-700 text-xs font-bold uppercase cursor-default">
                             <Target className="w-3 h-3 inline-block mr-1 mb-0.5" /> Definição de Área Tática
                          </div>

                          {/* CONTAINER DO MAPA */}
                          <div className="h-[350px] w-full rounded-2xl border border-slate-200 overflow-hidden relative">
                              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex bg-white rounded-lg shadow-lg p-1 gap-1 border border-slate-200">
                                  <button type="button" onClick={() => setModalMapMode('pc')} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase flex items-center gap-2 ${modalMapMode === 'pc' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                      <MousePointer2 className="w-3 h-3" /> PC
                                  </button>
                                  <button type="button" onClick={() => setModalMapMode('polygon')} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase flex items-center gap-2 ${modalMapMode === 'polygon' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                      <Hexagon className="w-3 h-3" /> Área
                                  </button>
                                  <button type="button" onClick={() => setModalMapMode('line')} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase flex items-center gap-2 ${modalMapMode === 'line' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                      <Navigation className="w-3 h-3" /> Rota
                                  </button>
                                  <button type="button" onClick={() => setModalMapMode('poi')} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase flex items-center gap-2 ${modalMapMode === 'poi' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                      <Flag className="w-3 h-3" /> Ponto
                                  </button>
                              </div>

                              <div className="absolute bottom-4 left-4 z-[1000]">
                                  <div className="bg-slate-800 text-white text-[10px] px-3 py-2 rounded-lg shadow-xl flex items-center gap-2 border border-slate-700">
                                      <MapPin className="w-3 h-3 text-red-500" />
                                      <div>
                                          <p className="font-bold text-xs uppercase text-slate-300">
                                              Modo: {modalMapMode === 'pc' ? 'Ponto de Controle' : modalMapMode === 'polygon' ? 'Desenhar Área' : modalMapMode === 'line' ? 'Desenhar Rota' : 'Marcar Ponto'}
                                          </p>
                                          <p className="text-[9px] opacity-70">Clique duplo para finalizar desenho.</p>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
                                  {plannedElements.sectors.length > 0 && (
                                      <button type="button" onClick={() => setPlannedElements({sectors: [], pois: []})} className="bg-white p-2 rounded shadow hover:bg-red-50 text-red-600 text-[10px] font-bold flex items-center gap-1">
                                          <Trash2 className="w-3 h-3"/> Limpar Tudo
                                      </button>
                                  )}
                              </div>

                              <MapContainer center={[formData.latitude, formData.longitude]} zoom={14} style={{ height: '100%', width: '100%' }}>
                                  <LocationSelectorMap 
                                      mode={modalMapMode}
                                      center={[formData.latitude, formData.longitude]}
                                      radius={formData.radius}
                                      onPositionChange={(lat: number, lng: number) => setFormData({...formData, latitude: lat, longitude: lng})}
                                      onElementCreated={handleMapElementCreated}
                                  />
                                  
                                  {/* Renderizar Elementos Planejados ou Existentes */}
                                  {plannedElements.sectors.map((s, i) => (
                                      s.type === 'route' 
                                      ? <Polyline key={i} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 0) as any} pathOptions={{ color: s.color, weight: 4, dashArray: '5, 10' }} />
                                      : <Polygon key={i} positions={L.GeoJSON.coordsToLatLngs(s.geojson.coordinates, 1) as any} pathOptions={{ color: s.color, fillOpacity: 0.2 }} />
                                  ))}
                                  {plannedElements.pois.map((p, i) => (
                                      <Marker key={i} position={[p.lat!, p.lng!]} icon={L.divIcon({className: 'custom-poi-marker', html: `<div style="background-color: blue; width: 10px; height: 10px; border-radius: 50%;"></div>`})} />
                                  ))}
                              </MapContainer>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                              <span>Itens Desenhados:</span>
                              <div className="flex gap-3">
                                  <span>Áreas: {plannedElements.sectors.filter(s => s.type !== 'route').length}</span>
                                  <span>Rotas: {plannedElements.sectors.filter(s => s.type === 'route').length}</span>
                                  <span>Pontos: {plannedElements.pois.length}</span>
                              </div>
                          </div>
                      </div>

                      {/* 5. CRONOGRAMA OPERACIONAL */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-3.5 h-3.5"/> 5. Cronograma Operacional</h4>
                          <div className="grid grid-cols-3 gap-4">
                              <Input label="Data" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600" />
                              <Input label="Início" type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600" />
                              <Input label="Término Previsto" type="time" value={formData.estimated_end_time} onChange={e => setFormData({...formData, estimated_end_time: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600" />
                          </div>
                      </div>

                      {/* 6. DESCRIÇÃO / NOTAS */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText className="w-3.5 h-3.5"/> 6. Descrição / Notas Operacionais</h4>
                          <textarea 
                              className="w-full p-4 border border-slate-200 rounded-xl text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-red-600 resize-none bg-white text-slate-900"
                              placeholder="Relate detalhes, obstáculos or observações importantes da missão..." 
                              value={formData.description} 
                              onChange={e => setFormData({...formData, description: e.target.value})} 
                          />
                      </div>

                      {/* 7. LINK DE TRANSMISSÃO */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Youtube className="w-3.5 h-3.5"/> 7. Link de Transmissão</h4>
                          <Input placeholder="Link YouTube (Opcional)" value={formData.stream_url} onChange={e => setFormData({...formData, stream_url: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600" />
                      </div>

                      {/* 8. SARPAS */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative">
                          <div className="absolute top-4 right-6"><Badge className="bg-amber-100 text-amber-700 border-none font-black text-[8px] uppercase px-2 py-0.5"><Zap className="w-2.5 h-2.5 mr-1 inline"/> Em Construção</Badge></div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-blue-600"/> 8. Integração SARPAS NG (Manual)</h4>
                          <Input label="Protocolo SARPAS" placeholder="Ex: XXXXXX" value={formData.sarpas_protocol} onChange={e => setFormData({...formData, sarpas_protocol: e.target.value})} labelClassName="text-[11px] font-bold text-slate-600" />
                      </div>

                      {/* 9. OPERAÇÃO VERÃO (ATUALIZADO COM SELEÇÃO DE CIDADE/PGV) */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sun className="w-3.5 h-3.5 text-orange-500"/> 9. Operação Verão</h4>
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer group">
                              <input type="checkbox" className="w-5 h-5 rounded border-slate-300 accent-red-600" checked={formData.is_summer_op} onChange={e => setFormData({...formData, is_summer_op: e.target.checked})} />
                              <div className="flex items-center gap-2"><Sun className="w-4 h-4 text-orange-500"/><span className="text-xs font-black uppercase text-slate-700 tracking-wider">Vincular à Operação Verão</span></div>
                          </label>
                          {formData.is_summer_op && (
                              <div className="grid grid-cols-2 gap-4 mt-2 p-3 bg-orange-50 border border-orange-100 rounded-lg animate-fade-in">
                                  <Select 
                                      label="Cidade Base" 
                                      value={summerCity} 
                                      onChange={(e) => { setSummerCity(e.target.value); setSummerPgv(''); }}
                                      labelClassName="text-[10px] font-bold text-orange-800 uppercase"
                                      className="bg-white border-orange-200 text-xs"
                                  >
                                      <option value="">Selecione a cidade...</option>
                                      {Object.keys(SUMMER_LOCATIONS).map(city => <option key={city} value={city}>{city}</option>)}
                                  </Select>
                                  <Select 
                                      label="Posto Guarda-Vidas (PGV)" 
                                      value={summerPgv} 
                                      onChange={(e) => setSummerPgv(e.target.value)}
                                      disabled={!summerCity}
                                      labelClassName="text-[10px] font-bold text-orange-800 uppercase"
                                      className="bg-white border-orange-200 text-xs disabled:bg-slate-100"
                                  >
                                      <option value="">Selecione o posto...</option>
                                      {summerCity && SUMMER_LOCATIONS[summerCity]?.map(pgv => <option key={pgv} value={pgv}>{pgv}</option>)}
                                  </Select>
                              </div>
                          )}
                      </div>

                      {/* 10. DIÁRIO DE BORDO (COMPLETO) */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-blue-600"/> 10. Diário de Bordo</h4>
                          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer group">
                              <input type="checkbox" className="w-5 h-5 rounded border-slate-300 accent-blue-600" checked={formData.is_multi_day} onChange={e => setFormData({...formData, is_multi_day: e.target.checked})} />
                              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600"/><span className="text-xs font-black uppercase text-slate-700 tracking-wider">Ativar Modo Multidias</span></div>
                          </label>
                          
                          {formData.is_multi_day && (
                              <div className="mt-4 border-t border-slate-100 pt-4">
                                  {formData.id ? (
                                      <OperationDailyLog 
                                          operationId={formData.id} 
                                          pilots={pilots} 
                                          drones={drones} 
                                          currentUser={currentUser} 
                                      />
                                  ) : (
                                      <div className="p-4 bg-blue-50 text-blue-700 rounded-lg text-center text-xs font-bold border border-blue-100 flex items-center justify-center gap-2">
                                          <Info className="w-4 h-4"/>
                                          Para gerenciar o diário, salve a missão primeiro.
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>

                  </form>

                  <div className="p-8 border-t bg-white flex gap-4 shrink-0">
                      <Button type="button" variant="outline" onClick={() => setIsMissionModalOpen(false)} className="flex-1 h-14 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-slate-200">Cancelar</Button>
                      <Button onClick={handleSaveMission} disabled={loading} className="flex-[2] h-14 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          {formData.id ? 'Atualizar Missão RPA' : 'Iniciar Missão RPA'}
                      </Button>
                  </div>
              </Card>
          </div>
      )}

      {/* MODAL DE PAUSA / CANCELAR / ENCERRAR */}
      {controlModal.type && controlModal.op && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in">
              <Card className={`w-full max-w-md bg-white shadow-2xl rounded-[1.5rem] overflow-hidden ${controlModal.type === 'cancel' ? 'border-none' : (controlModal.type === 'pause' ? 'border-t-[10px] border-orange-500' : 'border-t-[10px] border-red-600')}`}>
                  {/* CANCEL MODAL SPECIFIC DESIGN */}
                  {controlModal.type === 'cancel' ? (
                      <div className="p-6">
                          <div className="flex items-center gap-3 text-red-700 mb-6">
                              <div className="bg-red-100 p-2 rounded-lg">
                                  <AlertTriangle className="w-8 h-8" />
                              </div>
                              <h2 className="text-2xl font-black uppercase tracking-tight">CANCELAR</h2>
                              <button onClick={() => setControlModal({type: null, op: null})} className="ml-auto text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
                                  <X className="w-5 h-5" />
                              </button>
                          </div>
                          
                          <div className="bg-red-50 text-red-900 p-4 rounded-xl mb-6 text-sm border border-red-100 shadow-sm">
                              Deseja cancelar a missão: <strong className="font-black uppercase">{controlModal.op.name}</strong>?
                          </div>

                          <form onSubmit={handleAction} className="space-y-6">
                              <div className="relative">
                                  <textarea 
                                      className="w-full p-4 border border-slate-300 rounded-xl text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none peer pt-6 font-medium text-slate-700" 
                                      placeholder=" " 
                                      required 
                                      value={reason} 
                                      onChange={e => setReason(e.target.value)} 
                                  />
                                  <label className="absolute left-4 top-4 text-slate-400 text-xs font-bold uppercase transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-red-500 pointer-events-none">
                                      Motivo do cancelamento
                                  </label>
                              </div>

                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                  <label className="flex items-center gap-3 cursor-pointer group">
                                      <input 
                                          type="checkbox" 
                                          className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 transition-all cursor-pointer"
                                          checked={cancelConfirmed}
                                          onChange={e => setCancelConfirmed(e.target.checked)}
                                      />
                                      <span className="text-xs font-bold text-slate-600 uppercase group-hover:text-red-700 transition-colors">Estou ciente que esta ação é irreversível.</span>
                                  </label>
                              </div>

                              <div className="flex gap-3 pt-2">
                                  <button 
                                      type="button" 
                                      onClick={() => setControlModal({type: null, op: null})} 
                                      className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 hover:text-slate-700 transition-all"
                                  >
                                      VOLTAR
                                  </button>
                                  <button 
                                      type="submit" 
                                      disabled={loading || !cancelConfirmed} 
                                      className="flex-1 h-12 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                  >
                                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CONFIRMAR'}
                                  </button>
                              </div>
                          </form>
                      </div>
                  ) : (
                      // DEFAULT MODAL FOR PAUSE/END
                      <div className="p-8">
                          <div className="flex justify-between items-center mb-8">
                              <h3 className={`text-2xl font-black uppercase tracking-tight flex items-center gap-3 ${controlModal.type === 'pause' ? 'text-orange-700' : 'text-slate-900'}`}>
                                  {controlModal.type === 'pause' ? <Pause className="w-7 h-7 text-orange-500" /> : <CheckCircle className="w-7 h-7 text-red-600" />}
                                  {controlModal.type === 'pause' ? 'Pausar Missão' : 'Encerrar Missão'}
                              </h3>
                              <button onClick={() => setControlModal({type: null, op: null})} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400"/></button>
                          </div>
                          <form onSubmit={handleAction} className="space-y-6">
                              {controlModal.type === 'pause' && (<div className="bg-orange-50 border border-orange-200 p-5 rounded-3xl text-orange-800 text-sm font-medium leading-relaxed">Você está prestes a pausar a missão: <strong className="font-black">{controlModal.op.name}</strong>.<p className="mt-2 text-xs font-bold text-orange-600">O tempo decorrido durante a pausa não será contabilizado como hora de voo.</p></div>)}
                              {controlModal.type === 'end' ? (
                                  <>
                                      <Input 
                                        label="Tempo Total de Voo (HH:MM)" 
                                        type="text" 
                                        pattern="[0-9]{2}:[0-9]{2}"
                                        placeholder="00:00"
                                        required 
                                        value={flightDurationStr} 
                                        onChange={e => {
                                            // Máscara Simples HH:MM
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.length > 4) val = val.slice(0, 4);
                                            if (val.length > 2) val = val.slice(0, 2) + ':' + val.slice(2);
                                            setFlightDurationStr(val);
                                        }} 
                                        className="h-12 font-black text-lg bg-slate-50 text-center" 
                                      />
                                      <p className="text-[10px] text-slate-400 text-center -mt-4">Ex: 01:30 para 1h 30m voadas</p>
                                      <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 ml-1">Relato de Ações Realizadas</label><textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[140px] outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-600 transition-all resize-none" placeholder="Descreva brevemente o emprego do vetor..." required value={actionsTaken} onChange={e => setActionsTaken(e.target.value)} /></div>
                                  </>
                              ) : (
                                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 ml-1">Motivo desta Ação</label><textarea className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm min-h-[160px] outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all resize-none font-medium" placeholder="Ex: Troca de Bateria, Condições Climáticas..." required value={reason} onChange={e => setReason(e.target.value)} /></div>
                              )}
                              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setControlModal({type: null, op: null})} className="flex-1 h-14 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">Cancelar</button><button type="submit" disabled={loading} className={`flex-1 h-14 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-2xl transition-all ${controlModal.type === 'pause' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-700 hover:bg-red-800'}`}>{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2 inline" />} Confirmar</button></div>
                          </form>
                      </div>
                  )}
              </Card>
          </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .tactical-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .tactical-popup .leaflet-popup-content { margin: 0; width: auto !important; }
        .tactical-popup .leaflet-popup-tip-container { display: none; }
      `}</style>
    </div>
  );
}
