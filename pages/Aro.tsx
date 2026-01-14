
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "../services/base44Client";
import { Operation, ARO_SCENARIOS, AroItem, AroAssessment, Drone, Pilot, DroneDocument, SYSARP_LOGO } from "../types";
import { Card, Button, Badge, Select, Input } from "../components/ui_components";
import { CloudRain, Wind, FileText, Globe, ExternalLink, Map, AlertTriangle, Navigation, Thermometer, Eye, CheckCircle, AlertOctagon, Save, Radio, Plus, X, MapPin, Shield, LocateFixed, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";

const getRiskColor = (code: string) => {
    const red = ["5A", "5B", "5C", "4A", "4B", "3A"];
    const orange = ["5D", "4C", "3B", "2A", "2B"];
    const yellow = ["5E", "4D", "4E", "3C", "3D", "2C", "1A", "1B"];
    if (red.includes(code)) return "bg-red-600 text-white";
    if (orange.includes(code)) return "bg-orange-500 text-white";
    if (yellow.includes(code)) return "bg-yellow-400 text-black";
    return "bg-green-500 text-white";
};

const matrixData = {
  severidade: ['Catastrófico (A)', 'Crítico (B)', 'Significativo (C)', 'Pequeno (D)', 'Insignificante (E)'],
  probabilidade: ['Frequente (5)', 'Ocasional (4)', 'Remoto (3)', 'Improvável (2)', 'Muito Improvável (1)'],
  risks: [
    ['5A', '5B', '5C', '5D', '5E'],
    ['4A', '4B', '4C', '4D', '4E'],
    ['3A', '3B', '3C', '3D', '3E'],
    ['2A', '2B', '2C', '2D', '2E'],
    ['1A', '1B', '1C', '1D', '1E']
  ]
};

const DEFAULT_ITEMS: AroItem[] = ARO_SCENARIOS.map((desc, idx) => {
  const isScenario8 = idx + 1 === 8;
  return {
    scenario_id: idx + 1,
    description: desc,
    probability: isScenario8 ? 5 : 1,
    severity: isScenario8 ? 'A' : 'E',
    risk_code: isScenario8 ? '5A' : '1E',
    mitigation: isScenario8 ? 'Prevencao a eventos, risco de laser, luzes' : '',
    authorization_level: isScenario8 ? 'Comando Superior / DECEA' : ''
  };
});

// Helper para carregar imagem
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

// Componente de Mapa para Modal Preventivo
const PreventiveMapController = ({ center, setCenter }: { center: [number, number], setCenter: (c: [number, number]) => void }) => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => map.invalidateSize(), 300);
    }, [map]);

    useEffect(() => {
        // Fly to center when it changes programmatically (e.g. GPS button)
        map.flyTo(center, map.getZoom(), { duration: 1.5 });
    }, [center, map]);

    useEffect(() => {
        map.on('click', (e) => {
            setCenter([e.latlng.lat, e.latlng.lng]);
        });
        return () => { map.off('click'); };
    }, [map, setCenter]);

    return null;
};

export default function Aro() {
  const [activeOps, setActiveOps] = useState<Operation[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string>("");
  const [items, setItems] = useState<AroItem[]>(DEFAULT_ITEMS);
  const [accepted, setAccepted] = useState(false);
  const [rubric, setRubric] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados para ARO Preventiva (Modal)
  const [isPreventiveModalOpen, setIsPreventiveModalOpen] = useState(false);
  const [prevForm, setPrevForm] = useState({
      drone_id: "",
      validity_date: new Date().toISOString().split('T')[0],
      radius: 500,
      center: [-25.4284, -49.2733] as [number, number], // Default Curitiba
      type: "Treinamento / Manutenção"
  });
  const [prevItems, setPrevItems] = useState<AroItem[]>(DEFAULT_ITEMS);
  const [prevAccepted, setPrevAccepted] = useState(false);
  const [prevRubric, setPrevRubric] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
     const loadData = async () => {
         const [ops, drn, me] = await Promise.all([
             base44.entities.Operation.filter({ status: 'active' }),
             base44.entities.Drone.list(),
             base44.auth.me()
         ]);
         setActiveOps(ops);
         setDrones(drn);
         setCurrentUser(me);
         if(me) {
             setPrevRubric(me.full_name); // Auto-fill rubric for preventive
         }
     };
     loadData();
  }, []);

  // Efeito para carregar dados do ARO se a operação já tiver um salvo
  useEffect(() => {
    if (selectedOpId) {
        const op = activeOps.find(o => o.id === selectedOpId);
        if (op && op.aro) {
            setItems(op.aro.items);
            setAccepted(op.aro.declaration_accepted);
            setRubric(op.aro.rubric || "");
        } else {
            // Reset se não tiver ARO
            setItems(DEFAULT_ITEMS);
            setAccepted(false);
            setRubric("");
        }
    }
  }, [selectedOpId, activeOps]);

  const links = [
    { name: "AISWEB", url: "https://aisweb.decea.mil.br/", icon: Map },
    { name: "REDEMET", url: "https://www.redemet.aer.mil.br/", icon: CloudRain },
    { name: "SARPAS", url: "https://sarpas.decea.mil.br/", icon: Navigation },
  ];

  const handleUpdate = (idx: number, field: keyof AroItem, value: any) => {
    const newItems = [...items];
    const item = newItems[idx];
    // @ts-ignore
    item[field] = value;
    if (field === 'probability' || field === 'severity') {
      item.risk_code = `${item.probability}${item.severity}`;
    }
    setItems(newItems);
  };

  const handleUpdatePreventive = (idx: number, field: keyof AroItem, value: any) => {
    const newItems = [...prevItems];
    const item = newItems[idx];
    // @ts-ignore
    item[field] = value;
    if (field === 'probability' || field === 'severity') {
      item.risk_code = `${item.probability}${item.severity}`;
    }
    setPrevItems(newItems);
  };
  
  const handleSaveAro = async () => {
    if (!selectedOpId) {
        alert("Por favor, vincule o A.R.O. a uma operação ativa.");
        return;
    }
    if (!accepted) {
        alert("Você deve aceitar a declaração de responsabilidade.");
        return;
    }
    setLoading(true);
    try {
        const aroAssessment: AroAssessment = {
            items,
            declaration_accepted: accepted,
            rubric: rubric || "Assinado Digitalmente",
            created_at: new Date().toISOString()
        };
        await base44.entities.Operation.update(selectedOpId, { aro: aroAssessment });
        alert(`A.R.O. salvo com sucesso para a operação selecionada!`);
        
        // Atualiza a lista local para refletir a mudança
        const ops = await base44.entities.Operation.filter({ status: 'active' });
        setActiveOps(ops);

    } catch (e) {
        console.error("Erro ao salvar ARO", e);
        alert("Falha ao salvar o A.R.O.");
    } finally {
        setLoading(false);
    }
  };

  const handleLocateMe = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!navigator.geolocation) {
          alert("Geolocalização não suportada pelo seu navegador.");
          return;
      }

      setIsLocating(true);

      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setPrevForm(prev => ({
                  ...prev,
                  center: [pos.coords.latitude, pos.coords.longitude]
              }));
              setIsLocating(false);
          },
          (err) => {
              console.error(err);
              alert(`Erro ao obter localização: ${err.message}. Verifique se o GPS está ativado e permissão concedida.`);
              setIsLocating(false);
          },
          { 
              enableHighAccuracy: true, 
              timeout: 20000, 
              maximumAge: 0 
          }
      );
  };

  const handleSavePreventive = async () => {
      if (!prevForm.drone_id) { alert("Selecione uma aeronave."); return; }
      if (!prevAccepted) { alert("Aceite os termos de responsabilidade."); return; }
      
      setLoading(true);
      try {
          const { default: jsPDF } = await import('jspdf');
          const { default: autoTable } = await import('jspdf-autotable');
          
          const doc = new jsPDF();
          const logoData = await getImageData(SYSARP_LOGO);
          const drone = drones.find(d => d.id === prevForm.drone_id);
          const pageWidth = doc.internal.pageSize.width;

          // Header
          try { doc.addImage(logoData, "PNG", 14, 10, 20, 20); } catch(e) {}
          doc.setFontSize(14); doc.setFont("helvetica", "bold");
          doc.text("AVALIAÇÃO DE RISCO OPERACIONAL - PREVENTIVA", pageWidth/2, 20, { align: "center" });
          doc.setFontSize(10);
          doc.text("CORPO DE BOMBEIROS MILITAR DO PARANÁ", pageWidth/2, 26, { align: "center" });

          // Info
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("DADOS GERAIS", 14, 40);
          
          autoTable(doc, {
              startY: 42,
              body: [
                  ['Tipo de ARO', prevForm.type],
                  ['Validade', new Date(prevForm.validity_date).toLocaleDateString()],
                  ['Aeronave', `${drone?.prefix} - ${drone?.model}`],
                  ['Piloto Resp.', prevRubric],
                  ['Coordenadas', `${prevForm.center[0].toFixed(5)}, ${prevForm.center[1].toFixed(5)}`],
                  ['Raio de Operação', `${prevForm.radius} metros`]
              ],
              theme: 'grid',
              styles: { fontSize: 9 },
              columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
          });

          // Matrix
          let startY = (doc as any).lastAutoTable.finalY + 10;
          doc.text("MATRIZ DE RISCO", 14, startY);
          
          const tableData = prevItems.map(item => [
              item.description,
              `${item.probability} (${['Muito Imp.', 'Improvável', 'Remoto', 'Ocasional', 'Frequente'][item.probability-1]})`,
              `${item.severity} (${['Catastrófico', 'Crítico', 'Significativo', 'Pequeno', 'Insignificante'][['A','B','C','D','E'].indexOf(item.severity)]})`,
              item.risk_code,
              item.mitigation || '-',
              item.authorization_level || '-'
          ]);

          autoTable(doc, {
              startY: startY + 2,
              head: [['Cenário', 'Prob.', 'Sev.', 'Risco', 'Mitigação', 'Auth']],
              body: tableData,
              theme: 'grid',
              headStyles: { fillColor: [41, 51, 61], fontSize: 8 },
              styles: { fontSize: 7, cellPadding: 2 }
          });

          // Signature
          startY = (doc as any).lastAutoTable.finalY + 20;
          doc.setFont("helvetica", "normal");
          doc.text("Declaro estar ciente dos riscos e das medidas mitigadoras necessárias.", 14, startY);
          doc.text(`Assinado digitalmente por: ${prevRubric}`, 14, startY + 10);
          doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, startY + 16);

          // Convert PDF to Blob and Upload
          const pdfBlob = doc.output('blob');
          const pdfFile = new File([pdfBlob], `ARO_PREV_${drone?.prefix.replace(/\s/g,'_')}_${Date.now()}.pdf`, { type: 'application/pdf' });
          
          const { url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
          
          // Update Drone Documents
          const currentDocs = drone?.documents || {};
          // Ensure array
          const existingAros = Array.isArray(currentDocs.aro) ? currentDocs.aro : [];
          
          const newDoc: DroneDocument = {
              name: `ARO PREV - ${prevForm.type} - ${new Date().toLocaleDateString()}`,
              url: url,
              uploaded_at: new Date().toISOString()
          };

          await base44.entities.Drone.update(drone!.id, {
              documents: {
                  ...currentDocs,
                  aro: [...existingAros, newDoc]
              }
          });

          alert("A.R.O. Preventiva salva e vinculada à pasta digital da aeronave com sucesso!");
          setIsPreventiveModalOpen(false);
          // Reset form basics but keep sensible defaults
          setPrevForm(p => ({...p, type: "Treinamento / Manutenção"}));

      } catch (e) {
          console.error(e);
          alert("Erro ao salvar ARO preventiva.");
      } finally {
          setLoading(false);
      }
  };


  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 h-full overflow-y-auto pb-20">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900">
             <AlertOctagon className="w-8 h-8 text-red-700"/> Avaliação de Risco Operacional
          </h1>
          <div className="flex flex-wrap gap-2 self-start md:self-center">
             {links.map(l => (
                <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                   <l.icon className="w-3 h-3 text-slate-500"/> {l.name}
                </a>
             ))}
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-9 space-y-6">
             <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                    <div className="flex-1 w-full">
                        <label className="font-bold text-blue-900 block mb-2">Vincular A.R.O. à Operação Ativa</label>
                        <Select value={selectedOpId} onChange={e => setSelectedOpId(e.target.value)} className="bg-white">
                           <option value="">Selecione uma operação...</option>
                           {activeOps.map(op => <option key={op.id} value={op.id}>{op.name} (#{op.occurrence_number}) {op.aro ? '✅ (Já possui ARO)' : ''}</option>)}
                        </Select>
                    </div>
                    <Button onClick={() => setIsPreventiveModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap h-11">
                        <Plus className="w-4 h-4 mr-2" /> Nova A.R.O. Preventiva
                    </Button>
                </div>
             </Card>

             <Card className="p-4 overflow-x-auto">
                <h3 className="font-bold mb-3 text-sm uppercase text-slate-500">Matriz de Classificação do Grau de Risco</h3>
                <div className="min-w-[600px]">
                   <div className="grid grid-cols-6 gap-1 text-[11px] text-center font-bold">
                      <div className="p-2 border-r border-b border-slate-200 bg-slate-50">Prob. \ Sev.</div>
                      {matrixData.severidade.map(s => <div key={s} className="bg-slate-100 p-2 border-b border-slate-200">{s}</div>)}
                      {matrixData.probabilidade.map((p, pIndex) => (
                         <React.Fragment key={p}>
                           <div className="bg-slate-100 p-2 border-r border-slate-200 self-center">{p}</div>
                           {matrixData.risks[pIndex].map(risk => (
                              <div key={risk} className={`p-2 font-mono flex items-center justify-center rounded-sm ${getRiskColor(risk)}`}>{risk}</div>
                           ))}
                         </React.Fragment>
                      ))}
                   </div>
                </div>
             </Card>

             <div className="space-y-4">
                {items.map((item, idx) => (
                   <Card key={idx} className={`p-4 ${item.scenario_id === 8 ? 'bg-red-50 border-red-200' : ''}`}>
                      <div className="flex justify-between items-start mb-3">
                         <span className="font-bold text-sm text-slate-800">{item.description}</span>
                         <Badge className={getRiskColor(item.risk_code)}>{item.risk_code}</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                         <div className="grid grid-cols-2 gap-3 md:col-span-4">
                             <div>
                                <label className="text-[10px] font-bold text-slate-500 block">Probabilidade</label>
                                <Select 
                                  className="w-full text-sm p-1.5"
                                  value={item.probability} 
                                  disabled={item.scenario_id === 8}
                                  onChange={e => handleUpdate(idx, 'probability', Number(e.target.value))}
                                >
                                   {[5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                                </Select>
                             </div>
                             <div>
                                <label className="text-[10px] font-bold text-slate-500 block">Severidade</label>
                                <Select 
                                  className="w-full text-sm p-1.5"
                                  value={item.severity}
                                  disabled={item.scenario_id === 8}
                                  onChange={e => handleUpdate(idx, 'severity', e.target.value)}
                                >
                                   {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
                                </Select>
                             </div>
                         </div>
                         
                         <div className="md:col-span-3">
                           <Input 
                             label="Nível de Autorização"
                             className="text-sm p-1.5"
                             labelClassName="text-[10px] font-bold text-slate-500"
                             value={item.authorization_level || ''} 
                             onChange={e => handleUpdate(idx, 'authorization_level', e.target.value)} 
                             placeholder="Ex: Oficial de Dia"
                           />
                         </div>
                         <div className="md:col-span-5">
                            <Input
                              label="Medidas Mitigadoras"
                              className="text-sm p-1.5"
                              labelClassName="text-[10px] font-bold text-slate-500"
                              value={item.mitigation} 
                              disabled={item.scenario_id === 8}
                              onChange={e => handleUpdate(idx, 'mitigation', e.target.value)} 
                              placeholder={item.scenario_id === 8 ? "PROIBIDO" : "Ações preventivas/corretivas..."}
                            />
                         </div>
                      </div>
                   </Card>
                ))}
             </div>

             <Card className="p-6">
                <h3 className="font-bold mb-3">Declaração de Responsabilidade</h3>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm text-yellow-900 space-y-3">
                    <p>Declaro para os devidos fins que conheço e cumpro as legislações e regulamentações aplicáveis, em especial as listadas neste documento, assim como conheço as consequências do seu descumprimento.</p>
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                        <input type="checkbox" className="w-4 h-4 accent-sysarp-primary" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
                        Li e aceito os termos.
                    </label>
                </div>
                 <div className="mt-4">
                     <Input label="Rúbrica do Responsável" placeholder="Digite seu nome ou matrícula" value={rubric} onChange={e => setRubric(e.target.value)} />
                 </div>
                 <Button onClick={handleSaveAro} disabled={loading || !accepted} className="w-full mt-4 h-12 text-lg">
                    <Save className="w-5 h-5 mr-2"/>
                    {loading ? "Salvando A.R.O..." : "Salvar e Vincular à Operação"}
                 </Button>
             </Card>

          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-6">
             <Card className="p-4 bg-slate-900 text-white">
                <h3 className="font-bold flex items-center gap-2 mb-3 border-b border-slate-700 pb-2"><CloudRain className="w-4 h-4 text-blue-400"/> Meteorologia Local</h3>
                 <div className="text-center p-4">
                   <div className="text-4xl font-bold">22ºC</div>
                   <div className="text-xs text-slate-400">Parcialmente Nublado</div>
                   <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-800 p-2 rounded">
                         <p className="text-slate-400 text-[10px]">Vento</p>
                         <p>08 KT</p>
                      </div>
                      <div className="bg-slate-800 p-2 rounded">
                         <p className="text-slate-400 text-[10px]">Teto</p>
                         <p>SCT030</p>
                      </div>
                       <div className="bg-slate-800 p-2 rounded">
                         <p className="text-slate-400 text-[10px]">Visib.</p>
                         <p>10KM+</p>
                      </div>
                   </div>
                </div>
             </Card>
             <Card className="p-4 bg-yellow-50 border-yellow-200">
                <h3 className="font-bold text-yellow-800 flex items-center gap-2 mb-3 border-b border-yellow-200 pb-2"><AlertTriangle className="w-4 h-4"/> NOTAMs Ativos</h3>
                <div className="text-xs text-slate-700 space-y-3 max-h-60 overflow-y-auto">
                   <p><strong>D0456/24:</strong> OBST MOVEL (GUINDASTE) VIOLANDO SFC A 5KM DO AD...</p>
                   <p><strong>A1234/24:</strong> PISTA 15/33 FECHADA PARA POUSO E DECOLAGEM...</p>
                </div>
             </Card>
          </div>
       </div>

       {/* MODAL DE ARO PREVENTIVA */}
       {isPreventiveModalOpen && (
           <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4">
               <Card className="w-full max-w-4xl h-[90vh] bg-white flex flex-col overflow-hidden animate-fade-in shadow-2xl">
                   <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                       <h2 className="text-lg font-bold flex items-center gap-2">
                           <Shield className="w-5 h-5 text-green-400" />
                           Nova A.R.O. Preventiva
                       </h2>
                       <button onClick={() => setIsPreventiveModalOpen(false)} className="hover:bg-white/10 p-2 rounded transition-colors"><X className="w-5 h-5"/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                       
                       {/* SEÇÃO 1: DADOS BÁSICOS */}
                       <Card className="p-4 border border-slate-200">
                           <h3 className="text-sm font-bold text-slate-700 uppercase mb-3 border-b pb-1">Configuração da Missão</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <Select label="Aeronave" required value={prevForm.drone_id} onChange={e => setPrevForm({...prevForm, drone_id: e.target.value})}>
                                   <option value="">Selecione a aeronave...</option>
                                   {drones.map(d => <option key={d.id} value={d.id}>{d.prefix} - {d.model}</option>)}
                               </Select>
                               <Input label="Tipo de Atividade" value={prevForm.type} onChange={e => setPrevForm({...prevForm, type: e.target.value})} placeholder="Ex: Treinamento / Vistoria" />
                               <Input label="Data de Validade" type="date" value={prevForm.validity_date} onChange={e => setPrevForm({...prevForm, validity_date: e.target.value})} />
                               <Input label="Piloto Responsável" value={prevRubric} onChange={e => setPrevRubric(e.target.value)} disabled />
                           </div>
                       </Card>

                       {/* SEÇÃO 2: MAPA */}
                       <Card className="p-0 border border-slate-200 overflow-hidden h-[400px] relative flex flex-col">
                           <div className="absolute top-2 left-14 right-2 z-[1000] bg-white/90 backdrop-blur p-2 rounded shadow flex gap-4 items-center">
                               <span className="text-xs font-bold text-slate-700"><MapPin className="w-3 h-3 inline mr-1"/>Definir Área</span>
                               
                               <button 
                                   onClick={handleLocateMe}
                                   className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded shadow-sm transition-colors"
                                   title="Usar minha localização atual"
                               >
                                   {isLocating ? <Loader2 className="w-4 h-4 animate-spin"/> : <LocateFixed className="w-4 h-4"/>}
                               </button>

                               <div className="flex items-center gap-2 flex-1">
                                   <span className="text-xs">Raio: {prevForm.radius}m</span>
                                   <input 
                                     type="range" 
                                     min="50" 
                                     max="2000" 
                                     step="50" 
                                     value={prevForm.radius} 
                                     onChange={e => setPrevForm({...prevForm, radius: Number(e.target.value)})} 
                                     className="w-full accent-blue-600"
                                   />
                               </div>
                               <div className="text-[10px] text-slate-500 font-mono hidden md:block">
                                   Lat: {prevForm.center[0].toFixed(4)}, Lng: {prevForm.center[1].toFixed(4)}
                               </div>
                           </div>
                           <MapContainer center={prevForm.center} zoom={13} style={{ height: '100%', width: '100%' }}>
                               <PreventiveMapController center={prevForm.center} setCenter={(c) => setPrevForm({...prevForm, center: c})} />
                               <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                               <Marker position={prevForm.center} />
                               <Circle center={prevForm.center} radius={prevForm.radius} pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }} />
                           </MapContainer>
                       </Card>

                       {/* SEÇÃO 3: MATRIZ DE RISCO */}
                       <Card className="p-4 border border-slate-200">
                           <h3 className="text-sm font-bold text-slate-700 uppercase mb-3 border-b pb-1">Análise de Risco</h3>
                           <div className="space-y-4">
                               {prevItems.map((item, idx) => (
                                   <div key={idx} className={`p-3 rounded border ${item.scenario_id === 8 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                                       <div className="flex justify-between mb-2">
                                           <span className="font-bold text-xs text-slate-800">{item.description}</span>
                                           <Badge className={getRiskColor(item.risk_code)}>{item.risk_code}</Badge>
                                       </div>
                                       <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
                                           <div className="md:col-span-2">
                                               <label className="block text-slate-500 mb-1">Probabilidade</label>
                                               <select className="w-full p-1 border rounded bg-white text-slate-900" value={item.probability} disabled={item.scenario_id === 8} onChange={e => handleUpdatePreventive(idx, 'probability', Number(e.target.value))}>
                                                   {[5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
                                               </select>
                                           </div>
                                           <div className="md:col-span-2">
                                               <label className="block text-slate-500 mb-1">Severidade</label>
                                               <select className="w-full p-1 border rounded bg-white text-slate-900" value={item.severity} disabled={item.scenario_id === 8} onChange={e => handleUpdatePreventive(idx, 'severity', e.target.value)}>
                                                   {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
                                               </select>
                                           </div>
                                           <div className="md:col-span-4">
                                               <label className="block text-slate-500 mb-1">Mitigação</label>
                                               <input className="w-full p-1 border rounded bg-white text-slate-900" value={item.mitigation} disabled={item.scenario_id === 8} onChange={e => handleUpdatePreventive(idx, 'mitigation', e.target.value)} placeholder="Ações..." />
                                           </div>
                                           <div className="md:col-span-4">
                                               <label className="block text-slate-500 mb-1">Autorização</label>
                                               <input className="w-full p-1 border rounded bg-white text-slate-900" value={item.authorization_level || ''} onChange={e => handleUpdatePreventive(idx, 'authorization_level', e.target.value)} placeholder="Nível req." />
                                           </div>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       </Card>

                       {/* FOOTER */}
                       <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900">
                           <label className="flex items-center gap-2 cursor-pointer font-bold">
                               <input type="checkbox" className="w-4 h-4 accent-green-600" checked={prevAccepted} onChange={e => setPrevAccepted(e.target.checked)} />
                               Declaro ciência das normas e responsabilidade sobre a operação.
                           </label>
                       </div>

                   </div>

                   <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
                       <Button variant="outline" onClick={() => setIsPreventiveModalOpen(false)}>Cancelar</Button>
                       <Button onClick={handleSavePreventive} disabled={loading || !prevAccepted} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
                           {loading ? 'Salvando...' : 'Gerar e Salvar na Frota'}
                       </Button>
                   </div>
               </Card>
           </div>
       )}
    </div>
  );
}
