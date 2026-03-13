import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Triangle, MoveRight, X, Check, Car, User, Dog, Microscope, AlertTriangle, Building2 } from 'lucide-react';
import { tacticalService } from '../../services/tacticalService';
import { useParams } from 'react-router-dom';

export interface POI {
  id: string;
  lat: number;
  lng: number;
  type: 'vehicle' | 'ground_team' | 'k9' | 'evidence' | 'hazard' | 'command_post' | 'interest' | 'victim' | 'base' | 'footprints' | 'obstacle';
  name: string;
}

export interface Sector {
  id: string;
  positions: [number, number][];
  type: 'setor' | 'risco' | 'busca' | 'zone';
  name: string;
}

export interface Route {
  id: string;
  positions: [number, number][];
  type: 'patrulhamento' | 'deslocamento';
  name: string;
}

interface TacticalDrawControlsProps {
  onRefresh?: () => void;
  onPoiPlacement?: (lat: number, lng: number) => void;
}

const TacticalDrawControls: React.FC<TacticalDrawControlsProps> = ({ onRefresh, onPoiPlacement }) => {
  const map = useMap();
  const { id: operationId } = useParams<{ id: string }>();
  const [activeMode, setActiveMode] = useState<'none' | 'poi' | 'sector' | 'route'>('none');
  const [selectedPoiType, setSelectedPoiType] = useState<string>('Ponto');
  const [showPoiMenu, setShowPoiMenu] = useState(false);
  
  // State for the naming popup
  const [pendingDrawing, setPendingDrawing] = useState<{
    layer: L.Layer;
    type: 'sector' | 'route';
  } | null>(null);
  const [drawingMetadata, setDrawingMetadata] = useState({ name: '', type: '' });
  const controlRef = useRef<HTMLDivElement>(null);

  // Initialize Geoman on the map if not already done
  useEffect(() => {
    if (!map) return;
    const m = map as any;

    // Configure Geoman
    if (m.pm) {
      m.pm.setGlobalOptions({
        allowSelfIntersection: false,
        snappable: true,
      });
      m.pm.setLang('pt_br');
    }

    const handleCreate = (e: any) => {
      const { layer, shape } = e;
      
      if (shape === 'Polygon' || shape === 'Rectangle') {
        setPendingDrawing({ layer, type: 'sector' });
        setDrawingMetadata({ name: '', type: 'setor' });
      } else if (shape === 'Line') {
        setPendingDrawing({ layer, type: 'route' });
        setDrawingMetadata({ name: '', type: 'patrulhamento' });
      }
    };

    map.on('pm:create', handleCreate);

    return () => {
      map.off('pm:create', handleCreate);
    };
  }, [map]);

  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  // Handle POI placement
  const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
    if (activeMode === 'poi' && operationId) {
      if (onPoiPlacement) {
        onPoiPlacement(e.latlng.lat, e.latlng.lng);
        setActiveMode('none');
        map.getContainer().style.cursor = '';
      }
    }
  }, [activeMode, map, operationId, onPoiPlacement]);

  useEffect(() => {
    if (activeMode === 'poi') {
      map.on('click', handleMapClick);
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.off('click', handleMapClick);
      map.getContainer().style.cursor = '';
    }
    return () => {
      map.off('click', handleMapClick);
    };
  }, [activeMode, handleMapClick, map]);

  const startDrawSector = () => {
    console.log("startDrawSector clicked");
    const m = map as any;
    if (m.pm) {
      console.log("Geoman found, enabling draw");
      m.pm.disableDraw();
      setActiveMode('sector');
      m.pm.enableDraw('Polygon', { snappable: true, cursorMarker: true });
    } else {
      console.error("Geoman (pm) não encontrado no mapa");
    }
  };

  const startDrawRoute = () => {
    console.log("startDrawRoute clicked");
    const m = map as any;
    if (m.pm) {
      console.log("Geoman found, enabling draw");
      m.pm.disableDraw();
      setActiveMode('route');
      m.pm.enableDraw('Line', { snappable: true, cursorMarker: true });
    } else {
      console.error("Geoman (pm) não encontrado no mapa");
    }
  };

  const cancelDrawing = () => {
    if (pendingDrawing) {
      pendingDrawing.layer.remove();
      setPendingDrawing(null);
    }
    setActiveMode('none');
    const m = map as any;
    if (m.pm) {
      m.pm.disableDraw();
    }
  };

  const saveDrawing = async () => {
    if (!pendingDrawing || !operationId) return;

    try {
      if (pendingDrawing.type === 'sector') {
        const geojson = (pendingDrawing.layer as L.Polygon).toGeoJSON();
        await tacticalService.createSector({
          operation_id: operationId,
          name: drawingMetadata.name || 'Setor sem nome',
          type: drawingMetadata.type as any,
          color: drawingMetadata.type === 'risco' ? '#ef4444' : (drawingMetadata.type === 'busca' ? '#f59e0b' : '#3b82f6'),
          geojson: geojson.geometry,
        });
      } else {
        const geojson = (pendingDrawing.layer as L.Polyline).toGeoJSON();
        // Routes are also saved as sectors with type 'route' in this schema usually, 
        // or we can use a specific type if the service supports it.
        // Looking at tacticalService, it seems sectors can have different types.
        await tacticalService.createSector({
          operation_id: operationId,
          name: drawingMetadata.name || 'Rota sem nome',
          type: 'route', // or drawingMetadata.type
          color: drawingMetadata.type === 'patrulhamento' ? '#10b981' : '#8b5cf6',
          geojson: geojson.geometry,
        });
      }

      pendingDrawing.layer.remove();
      setPendingDrawing(null);
      setActiveMode('none');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Erro ao salvar desenho:", err);
      alert("Erro ao salvar no banco de dados.");
    }
  };

  return (
    <>
      {/* Floating Controls */}
      <div ref={controlRef} className="leaflet-bottom leaflet-left mb-6 ml-6 flex flex-col gap-3 z-[1000] pointer-events-auto">
        {/* POI Submenu */}
        {showPoiMenu && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-3 mb-2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex justify-between items-center mb-1 px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de POI</span>
              <button onClick={() => setShowPoiMenu(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'vehicle', icon: <Car size={16} />, label: 'Viatura' },
                  { id: 'ground_team', icon: <User size={16} />, label: 'Equipe Solo' },
                  { id: 'k9', icon: <Dog size={16} />, label: 'Equipe K9' },
                  { id: 'evidence', icon: <Microscope size={16} />, label: 'Vestígios' },
                  { id: 'hazard', icon: <AlertTriangle size={16} />, label: 'Área Risco' },
                  { id: 'command_post', icon: <Building2 size={16} />, label: 'Posto Comando' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedPoiType(item.id as any);
                      setActiveMode('poi');
                      setShowPoiMenu(false);
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 text-slate-700 text-sm transition-colors cursor-pointer"
                  >
                    <span className="text-slate-500">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Main Buttons */}
        <div className="flex flex-col gap-3 items-start">
          <button
            onClick={() => {
              setActiveMode('poi');
              setShowPoiMenu(false);
              map.getContainer().style.cursor = 'crosshair';
            }}
            title="Ponto de Interesse"
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 cursor-pointer pointer-events-auto ${
              activeMode === 'poi' ? 'bg-indigo-600 text-white ring-4 ring-indigo-200' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin size={24} />
          </button>

          <button
            onClick={startDrawSector}
            title="Setor / Área"
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 cursor-pointer pointer-events-auto ${
              activeMode === 'sector' ? 'bg-blue-600 text-white ring-4 ring-blue-200' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Triangle size={24} />
          </button>

          <button
            onClick={startDrawRoute}
            title="Rota"
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 cursor-pointer pointer-events-auto ${
              activeMode === 'route' ? 'bg-emerald-600 text-white ring-4 ring-emerald-200' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MoveRight size={24} />
          </button>
        </div>
      </div>

      {/* Metadata Modal (Overlay) */}
      {pendingDrawing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Detalhes do {pendingDrawing.type === 'sector' ? 'Setor' : 'Rota'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                  <input
                    type="text"
                    autoFocus
                    value={drawingMetadata.name}
                    onChange={(e) => setDrawingMetadata(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={`Ex: Setor Alpha, Rota de Fuga...`}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select
                    value={drawingMetadata.type}
                    onChange={(e) => setDrawingMetadata(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  >
                    {pendingDrawing.type === 'sector' ? (
                      <>
                        <option value="setor">Setor Operacional</option>
                        <option value="risco">Área de Risco</option>
                        <option value="busca">Área de Busca</option>
                      </>
                    ) : (
                      <>
                        <option value="patrulhamento">Rota de Patrulhamento</option>
                        <option value="deslocamento">Rota de Deslocamento</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex gap-3 justify-end">
              <button
                onClick={cancelDrawing}
                className="px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <X size={18} /> Cancelar
              </button>
              <button
                onClick={saveDrawing}
                className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check size={18} /> Salvar no Mapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Mode Indicator (Top Center) */}
      {activeMode !== 'none' && !pendingDrawing && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-medium">
            {activeMode === 'poi' && `Clique no mapa para posicionar: ${selectedPoiType}`}
            {activeMode === 'sector' && 'Desenhe o polígono no mapa. Clique no primeiro ponto para fechar.'}
            {activeMode === 'route' && 'Desenhe a rota no mapa. Clique no último ponto para finalizar.'}
          </span>
          <button 
            onClick={() => {
              setActiveMode('none');
              if ((map as any).pm) (map as any).pm.disableDraw();
            }}
            className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
};

export default TacticalDrawControls;
