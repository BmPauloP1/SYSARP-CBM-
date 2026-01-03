import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "../services/base44Client";
import { Operation, MISSION_HIERARCHY, MISSION_COLORS, MissionType } from "../types";
import { Card, Button, Input, Select, Badge } from "../components/ui_components";
import { FileText, Download, Filter, Search, Calendar, Map as MapIcon, RefreshCcw } from "lucide-react";

/**
 * Helper function to validate coordinates before rendering markers.
 */
const isValidCoord = (lat: any, lng: any) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return !isNaN(nLat) && !isNaN(nLng) && nLat !== 0 && nLng !== 0;
};

/**
 * Controller to handle map resizing and lifecycle issues with Leaflet.
 */
const MapController = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (map && map.getContainer()) map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

export default function Reports() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMission, setFilterMission] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Operation.list("-created_at");
      setOperations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filtered operations based on UI inputs.
   */
  const filteredOps = useMemo(() => {
    return operations.filter(op => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = op.name.toLowerCase().includes(searchLower) || 
                           op.occurrence_number.toLowerCase().includes(searchLower);
      
      const matchesMission = filterMission === "all" || op.mission_type === filterMission;
      const matchesStatus = filterStatus === "all" || op.status === filterStatus;
      
      let matchesDate = true;
      if (dateStart) matchesDate = matchesDate && new Date(op.start_time) >= new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setDate(end.getDate() + 1);
        // Fix: Changed 'matchDate' to 'matchesDate' to resolve the "Cannot find name 'matchDate'" error.
        matchesDate = matchesDate && new Date(op.start_time) < end;
      }

      return matchesSearch && matchesMission && matchesStatus && matchesDate;
    });
  }, [operations, searchTerm, filterMission, filterStatus, dateStart, dateEnd]);

  /**
   * Generates map markers for the filtered operations.
   */
  const mapMarkers = useMemo(() => {
    const displayOps = filteredOps.slice(0, 1000);

    return displayOps.map(op => {
      const lat = Number(op.latitude);
      const lng = Number(op.longitude);
      // Fix: Check coordinate validity before rendering
      if (!isValidCoord(lat, lng)) return null;
      
      return (
        <CircleMarker 
          key={`report-marker-${op.id}`}
          center={[lat, lng]}
          pathOptions={{ 
              color: MISSION_COLORS[op.mission_type] || 'gray',
              fillColor: MISSION_COLORS[op.mission_type] || 'gray',
              fillOpacity: 0.6,
              weight: 1
          }}
          radius={12}
        >
          <Popup>
              <div className="text-xs">
                <strong>{op.name}</strong><br/>
                {MISSION_HIERARCHY[op.mission_type]?.label}<br/>
                {op.sub_mission_type && <i>{op.sub_mission_type}<br/></i>}
                {new Date(op.start_time).toLocaleDateString()}
              </div>
          </Popup>
        </CircleMarker>
      );
    });
  }, [filteredOps]);

  /**
   * Exports the filtered results as a PDF table.
   */
  const handleExportPDF = async () => {
    setGeneratingPdf(true);
    try {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        
        doc.text("Relatório Geral de Operações - SYSARP", 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

        const tableData = filteredOps.map(op => [
            op.occurrence_number,
            op.name,
            MISSION_HIERARCHY[op.mission_type]?.label || op.mission_type,
            new Date(op.start_time).toLocaleDateString(),
            op.status.toUpperCase()
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Nº Ocorrência', 'Nome', 'Natureza', 'Data Início', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] }
        });

        doc.save(`Relatorio_Operacoes_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
        console.error(e);
        alert("Erro ao exportar PDF.");
    } finally {
        setGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-slate-200 p-4 md:p-6 shadow-sm z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-8 h-8 text-slate-700" />
                Relatórios Operacionais
            </h1>
            <Button onClick={handleExportPDF} disabled={generatingPdf} className="w-full md:w-auto h-10">
                <Download className="w-4 h-4 mr-2" />
                {generatingPdf ? 'Gerando...' : 'Exportar PDF'}
            </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <Card className="p-4 bg-white shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Input label="Busca" placeholder="Nome ou Protocolo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <Select label="Natureza" value={filterMission} onChange={e => setFilterMission(e.target.value)}>
                    <option value="all">Todas</option>
                    {Object.entries(MISSION_HIERARCHY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
                <Select label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="active">Ativas</option>
                    <option value="completed">Concluídas</option>
                    <option value="cancelled">Canceladas</option>
                </Select>
                <Input label="Início" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                <Input label="Fim" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            <Card className="lg:col-span-2 overflow-hidden relative border-0 shadow-md">
                <MapContainer center={[-25.2521, -52.0215]} zoom={7} style={{ height: '100%', width: '100%' }}>
                    <MapController />
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {mapMarkers}
                </MapContainer>
            </Card>

            <Card className="flex flex-col overflow-hidden shadow-md">
                <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                    <span>Resultados ({filteredOps.length})</span>
                    <button onClick={loadData} className="text-slate-400 hover:text-slate-600"><RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {filteredOps.map(op => (
                        <div key={op.id} className="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-sm text-slate-800 truncate pr-2">{op.name}</h4>
                                <Badge variant={op.status === 'active' ? 'success' : op.status === 'completed' ? 'default' : 'danger'}>
                                    {op.status.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                                {MISSION_HIERARCHY[op.mission_type]?.label} • {new Date(op.start_time).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                    {filteredOps.length === 0 && <div className="text-center py-8 text-slate-400 italic">Nenhum resultado encontrado.</div>}
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
}
