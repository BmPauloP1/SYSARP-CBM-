import React, { useState } from 'react';
import { operationSummerService } from '../services/operationSummerService';
import { base44 } from '../services/base44Client';
import { Card, Button, Input } from '../components/ui_components';
import { FileText, Download, Sun, Calendar } from 'lucide-react';
import { MISSION_HIERARCHY, MissionType, SYSARP_LOGO } from '../types';
import { jsPDF } from 'jspdf';

// Helper to load image data for PDF
const getImageData = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (url.startsWith('data:')) { resolve(url); return; }
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error("Canvas context error"));
      }
    };
    img.onerror = () => resolve("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
    img.src = url;
  });
};

export default function OperationSummerReport() {
  const [loading, setLoading] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const generatePDF = async () => {
    setLoading(true);
    try {
      const [allFlights, pilots, drones] = await Promise.all([
        operationSummerService.list(),
        base44.entities.Pilot.list(),
        base44.entities.Drone.list()
      ]);

      // 1. Filtrar voos pelo período selecionado
      let filteredFlights = allFlights;
      if (dateStart) {
        const start = new Date(dateStart + 'T00:00:00');
        filteredFlights = filteredFlights.filter(f => new Date(f.date) >= start);
      }
      if (dateEnd) {
        const end = new Date(dateEnd + 'T23:59:59');
        filteredFlights = filteredFlights.filter(f => new Date(f.date) <= end);
      }
      
      if (filteredFlights.length === 0) {
        alert("Nenhum voo encontrado para o período selecionado.");
        setLoading(false);
        return;
      }

      // 2. Agregar dados para estatísticas
      const totalFlights = filteredFlights.length;
      const totalHours = filteredFlights.reduce((acc, f) => acc + (f.flight_duration || 0), 0) / 60;
      
      const statsByMission = filteredFlights.reduce<Record<string, { flights: number, hours: number }>>((acc, f) => {
        const mission = f.mission_type;
        if (!acc[mission]) acc[mission] = { flights: 0, hours: 0 };
        acc[mission].flights++;
        acc[mission].hours += (f.flight_duration || 0) / 60;
        return acc;
      }, {});

      const statsByLocation = filteredFlights.reduce<Record<string, { flights: number, hours: number }>>((acc, f) => {
        const location = f.location;
        if (!acc[location]) acc[location] = { flights: 0, hours: 0 };
        acc[location].flights++;
        acc[location].hours += (f.flight_duration || 0) / 60;
        return acc;
      }, {});
      
      const statsByDrone = filteredFlights.reduce<Record<string, { flights: number, hours: number }>>((acc, f) => {
        const droneId = f.drone_id;
        if (!acc[droneId]) acc[droneId] = { flights: 0, hours: 0 };
        acc[droneId].flights++;
        acc[droneId].hours += (f.flight_duration || 0) / 60;
        return acc;
      }, {});

      const statsByPilot = filteredFlights.reduce<Record<string, { flights: number, hours: number }>>((acc, f) => {
        const pilotId = f.pilot_id;
        if (!acc[pilotId]) acc[pilotId] = { flights: 0, hours: 0 };
        acc[pilotId].flights++;
        acc[pilotId].hours += (f.flight_duration || 0) / 60;
        return acc;
      }, {});

      const mostFrequentMission = Object.entries(statsByMission).sort((a, b) => b[1].flights - a[1].flights)[0];

      // 3. Gerar o PDF com jspdf e jspdf-autotable
      // @FIX: Use modern dynamic import syntax to prevent type conflicts.
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const logoData = await getImageData(SYSARP_LOGO);
      let startY = 40;

      // Header
      try { doc.addImage(logoData, "PNG", 14, 10, 20, 20); } catch(e) {}
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO CONSOLIDADO - OPERAÇÃO VERÃO", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${dateStart ? new Date(dateStart+'T12:00:00').toLocaleDateString() : 'Início'} a ${dateEnd ? new Date(dateEnd+'T12:00:00').toLocaleDateString() : 'Fim'}`, pageWidth / 2, 26, { align: "center" });

      // Resumo Executivo
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("1. RESUMO EXECUTIVO (KPIs)", 14, startY);
      startY += 8;
      autoTable(doc, {
        startY,
        body: [
          ['Total de Voos', totalFlights.toString()],
          ['Total de Horas Voadas', `${totalHours.toFixed(1)} h`],
          ['Duração Média por Voo', `${(totalHours * 60 / totalFlights).toFixed(1)} min`],
          ['Missão Mais Frequente', `${MISSION_HIERARCHY[mostFrequentMission[0] as MissionType]?.label} (${mostFrequentMission[1].flights} voos)`],
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold' } }
      });
      startY = (doc as any).lastAutoTable.finalY + 12;
      
      // Análise por Missão
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("2. ANÁLISE POR TIPO DE MISSÃO", 14, startY);
      startY += 8;
      autoTable(doc, {
        startY,
        head: [['Missão', 'Nº de Voos', '% do Total', 'Horas Voadas']],
        body: Object.entries(statsByMission).sort((a, b) => b[1].flights - a[1].flights).map(([key, val]) => [
          MISSION_HIERARCHY[key as MissionType]?.label || key,
          val.flights,
          `${(val.flights / totalFlights * 100).toFixed(1)}%`,
          val.hours.toFixed(1)
        ]),
        theme: 'striped', headStyles: { fillColor: [41, 51, 61] }
      });
      startY = (doc as any).lastAutoTable.finalY + 12;

      // Análise por Localidade
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("3. ANÁLISE POR LOCALIDADE", 14, startY);
      startY += 8;
      autoTable(doc, {
        startY,
        head: [['Local (Posto / Cidade)', 'Nº de Voos', 'Horas Voadas']],
        body: Object.entries(statsByLocation).sort((a,b) => b[1].flights - a[1].flights).slice(0, 15).map(([key, val]) => [key, val.flights, val.hours.toFixed(1)]),
        theme: 'striped', headStyles: { fillColor: [41, 51, 61] }
      });
      startY = (doc as any).lastAutoTable.finalY + 12;
      
      doc.addPage();
      startY = 20;

      // Análise por Aeronave
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("4. ANÁLISE DE EMPREGO DA FROTA", 14, startY);
      startY += 8;
      autoTable(doc, {
        startY,
        head: [['Aeronave (Prefixo)', 'Modelo', 'Nº de Voos', 'Horas Voadas']],
        body: Object.entries(statsByDrone).sort((a,b) => b[1].hours - a[1].hours).map(([key, val]) => {
          const drone = drones.find(d => d.id === key);
          return [drone?.prefix || 'N/A', drone?.model || 'Desconhecido', val.flights, val.hours.toFixed(1)];
        }),
        theme: 'striped', headStyles: { fillColor: [41, 51, 61] }
      });
      startY = (doc as any).lastAutoTable.finalY + 12;

      // Análise por Piloto
      doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text("5. ANÁLISE DE EFETIVO EMPREGADO", 14, startY);
      startY += 8;
      autoTable(doc, {
        startY,
        head: [['Piloto', 'Nº de Voos', 'Horas Voadas']],
        body: Object.entries(statsByPilot).sort((a,b) => b[1].hours - a[1].hours).map(([key, val]) => {
          const pilot = pilots.find(p => p.id === key);
          return [pilot?.full_name || 'N/A', val.flights, val.hours.toFixed(1)];
        }),
        theme: 'striped', headStyles: { fillColor: [41, 51, 61] }
      });
      startY = (doc as any).lastAutoTable.finalY + 12;

      // Log completo de voos
      if(filteredFlights.length > 0) {
        doc.addPage();
        startY = 20;
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("6. LOG COMPLETO DE VOOS NO PERÍODO", 14, startY);
        startY += 8;
        autoTable(doc, {
          startY,
          head: [['Data', 'Local', 'Missão', 'Piloto', 'Drone', 'Duração']],
          body: filteredFlights.map(f => {
            const pilot = pilots.find(p => p.id === f.pilot_id)?.full_name || 'N/A';
            const drone = drones.find(d => d.id === f.drone_id)?.prefix || 'N/A';
            return [ new Date(f.date+'T12:00:00').toLocaleDateString(), f.location, MISSION_HIERARCHY[f.mission_type as MissionType]?.label, pilot, drone, `${f.flight_duration}m` ];
          }),
          theme: 'grid', headStyles: { fillColor: [100, 116, 139] }, styles: { fontSize: 8 }
        });
      }
      
      // Footer
      // @FIX: Correctly call `doc.internal.getNumberOfPages()` to get the page count.
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`SYSARP - Relatório Operação Verão - Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: "center" });
      }

      doc.save(`Relatorio_Op_Verao_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (e) {
      console.error(e);
      alert("Erro ao gerar relatório. Verifique o console para mais detalhes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 flex items-center justify-center h-full bg-slate-100">
      <Card className="p-6 md:p-10 text-center space-y-6 max-w-2xl w-full shadow-xl border-t-8 border-orange-500">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600">
          <FileText className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Relatório Consolidado</h1>
          <p className="text-slate-500 mt-2">Gere um documento PDF completo com análises e estatísticas da Operação Verão.</p>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
           <h3 className="text-sm font-bold text-slate-700 flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              Selecione o Período do Relatório
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Data de Início" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              <Input label="Data de Fim" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
           </div>
           <p className="text-xs text-slate-400">Deixe em branco para incluir todos os registros.</p>
        </div>

        <div className="flex justify-center gap-4 pt-4">
          <Button onClick={generatePDF} disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white px-8 h-12 text-base md:text-lg shadow-lg shadow-orange-200">
            <Download className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            {loading ? "Gerando Documento..." : "Baixar Relatório PDF"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
