import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "../services/base44Client";
import { Drone, Pilot, DroneChecklist, ChecklistItemState, DRONE_CHECKLIST_TEMPLATE, SYSARP_LOGO, Maintenance, ORGANIZATION_CHART } from "../types";
import { Card, Button, Badge, DroneIcon, Input, Select } from "../components/ui_components";
import { Plus, AlertTriangle, X, Save, Activity, Pencil, RotateCcw, ClipboardCheck, CheckCircle, Printer, FileText, Trash2, Box, MapPin, Zap, Filter, RefreshCcw, Search, RefreshCw } from "lucide-react";
import DroneInventoryModal from './DroneInventoryModal';

// Generate HARPIA 01 to 100
const PREFIX_OPTIONS = Array.from({ length: 100 }, (_, i) => 
  `HARPIA ${String(i + 1).padStart(2, '0')}`
);

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
        reject(new Error("Canvas error"));
      }
    };
    img.onerror = () => resolve("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
    img.src = url;
  });
};

export default function DroneManagement() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [currentUser, setCurrentUser] = useState<Pilot | null>(null);
  
  // Catalog State
  const [catalog, setCatalog] = useState<Record<string, string[]>>({});

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCrbm, setFilterCrbm] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Create/Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); 

  const [newDroneData, setNewDroneData] = useState<Omit<Partial<Drone>, 'payloads'> & { payloads?: string | string[] }>({
    prefix: "HARPIA 01",
    brand: "",
    model: "",
    status: "available",
    payloads: [],
    total_flight_hours: 0,
    crbm: "",
    unit: ""
  });
  
  // Custom Input States
  const [isNewBrand, setIsNewBrand] = useState(false);
  const [isNewModel, setIsNewModel] = useState(false);
  const [customBrand, setCustomBrand] = useState("");
  const [customModel, setCustomModel] = useState("");

  // Maintenance Modal State
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [maintReason, setMaintReason] = useState("");
  const [maintPilot, setMaintPilot] = useState("");
  const [loading, setLoading] = useState(false);

  // Checklist Modal State
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [currentChecklistDrone, setCurrentChecklistDrone] = useState<Drone | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemState[]>([]);
  const [checklistNotes, setChecklistNotes] = useState("");
  const [checklistPilotId, setChecklistPilotId] = useState("");

  // NOVO: Inventory Modal State
  const [inventoryDrone, setInventoryDrone] = useState<Drone | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // SQL Fix Modal State
  const [sqlError, setSqlError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [d, p, cat, me] = await Promise.all([
        base44.entities.Drone.list(),
        base44.entities.Pilot.filter({ status: 'active' }),
        base44.system.getCatalog(),
        base44.auth.me()
      ]);

      // Ordenar por Prefixo (HARPIA 01, 02...) de forma sequencial
      const sortedDrones = d.sort((a, b) => 
        a.prefix.localeCompare(b.prefix, undefined, { numeric: true, sensitivity: 'base' })
      );

      setDrones(sortedDrones);
      setPilots(p);
      setCatalog(cat);
      setCurrentUser(me);
    } catch (e: any) {
      if (e.message !== "Não autenticado" && !e.message?.includes("Failed to fetch")) {
         console.error("Erro ao carregar dados", e);
      }
    }
  };
  
  // --- FILTERING LOGIC ---
  const filteredDrones = useMemo(() => {
    return drones.filter(drone => {
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = (
        drone.prefix?.toLowerCase().includes(searchLower) ||
        drone.model?.toLowerCase().includes(searchLower) ||
        drone.serial_number?.toLowerCase().includes(searchLower) ||
        drone.sisant?.toLowerCase().includes(searchLower)
      );

      const matchesCrbm = filterCrbm === "all" || drone.crbm === filterCrbm;
      const matchesUnit = filterUnit === "all" || drone.unit === filterUnit;
      const matchesStatus = filterStatus === "all" || drone.status === filterStatus;

      return matchesSearch && matchesCrbm && matchesUnit && matchesStatus;
    });
  }, [drones, searchTerm, filterCrbm, filterUnit, filterStatus]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterCrbm("all");
    setFilterUnit("all");
    setFilterStatus("all");
  };

  // --- REPORTING LOGIC ---
  const handleExportReport = async () => {
    if (filteredDrones.length === 0) {
        alert("Nenhuma aeronave na lista para exportar.");
        return;
    }
    setGeneratingPdf(true);
    try {
        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
        const autoTableModule = await import('jspdf-autotable');
        const autoTable = autoTableModule.default;

        const doc = new jsPDF();
        const logoData = await getImageData(SYSARP_LOGO);

        // Header
        try { doc.addImage(logoData, "PNG", 14, 10, 20, 20); } catch(e) {}
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("RELATÓRIO DE FROTA - AERONAVES RPA", 105, 20, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("CORPO DE BOMBEIROS MILITAR DO PARANÁ", 105, 26, { align: "center" });
        
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 35);

        const tableBody = filteredDrones.map(d => {
            const checklist = getChecklistStatus(d.last_30day_check);
            return [
                d.prefix,
                d.model,
                d.serial_number || 'N/A',
                `${d.unit || 'N/A'}\n${d.crbm || ''}`,
                d.status.replace('_', ' ').toUpperCase(),
                d.total_flight_hours?.toFixed(1) || '0.0',
                checklist.label
            ];
        });

        autoTable(doc, {
            startY: 45,
            head: [['Prefixo', 'Modelo', 'Nº de Série', 'Lotação', 'Status', 'Horas Voo', 'Checklist']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28], textColor: 255, fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2, valign: 'middle' },
            columnStyles: {
                3: { cellWidth: 50 },
            }
        });

        doc.save(`Relatorio_Frota_SYSARP_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (e) {
        console.error(e);
        alert("Erro ao gerar relatório PDF.");
    } finally {
        setGeneratingPdf(false);
    }
  };

  // Helper to check if a prefix is already taken by ANOTHER drone
  const isPrefixTaken = (prefix: string) => {
    const found = drones.find(d => d.prefix === prefix);
    if (!found) return false; // No drone has this prefix
    if (editingId && found.id === editingId) return false; // Current drone owns it
    return true; // Taken by someone else
  };

  const handleEditDrone = (drone: Drone) => {
    setNewDroneData({
      ...drone,
      payloads: Array.isArray(drone.payloads) ? drone.payloads : [],
      crbm: drone.crbm || "",
      unit: drone.unit || ""
    });
    setEditingId(drone.id);
    setIsCreateModalOpen(true);
    setIsNewBrand(false);
    setIsNewModel(false);
  };

  const handleDeleteDrone = async (droneId: string) => {
    // Segurança: apenas admin
    if (!currentUser || currentUser.role !== 'admin') {
      alert("Apenas administradores podem excluir aeronaves.");
      return;
    }
  
    // Confirmação
    const confirmed = window.confirm(
      "ATENÇÃO: Tem certeza que deseja excluir esta aeronave permanentemente?\n\n" +
      "Esta ação não pode ser desfeita e pode afetar o histórico de voos."
    );
    if (!confirmed) return;
  
    // Evita múltiplos cliques na mesma aeronave
    if (deletingId === droneId) return;
  
    setDeletingId(droneId);
    try {
      await base44.entities.Drone.delete(droneId);
  
      // Atualiza UI localmente: remove drone da lista
      setDrones(prev => prev.filter(d => d.id !== droneId));
  
      alert("Aeronave excluída com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir aeronave:", error);
      alert("Erro ao excluir aeronave. Verifique o console para mais detalhes.");
      // Fallback
      loadData();
    } finally {
      setDeletingId(null);
    }
  };
  
  const handleSyncStatus = async () => {
    if (!confirm("Isso irá verificar todas as aeronaves 'Em Operação' e liberá-las se não estiverem vinculadas a nenhuma ocorrência ativa. Deseja continuar?")) {
        return;
    }

    setLoading(true);
    try {
        // 1. Get all active operations
        const activeOps = await base44.entities.Operation.filter({ status: 'active' });

        // 2. Create a Set of all drone IDs that are legitimately in use
        const inUseDroneIds = new Set<string>();
        for (const op of activeOps) {
            if (op.drone_id) {
                inUseDroneIds.add(op.drone_id);
            }
            // If it's a multi-day op, we also need to check its daily assets
            if (op.is_multi_day) {
                const days = await base44.entities.OperationDay.filter({ operation_id: op.id });
                for (const day of days) {
                    const assets = await base44.entities.OperationDayAsset.filter({ operation_day_id: day.id });
                    assets.forEach(asset => inUseDroneIds.add(asset.drone_id));
                }
            }
        }

        // 3. Get all drones currently marked as 'in_operation'
        const busyDrones = await base44.entities.Drone.filter({ status: 'in_operation' });

        // 4. Find the drones that are 'in_operation' but NOT in our 'inUse' set
        const dronesToRelease = busyDrones.filter(d => !inUseDroneIds.has(d.id));

        if (dronesToRelease.length === 0) {
            alert("Nenhuma inconsistência encontrada. Todas as aeronaves 'Em Operação' estão vinculadas a ocorrências ativas.");
            return;
        }

        // 5. Release the inconsistent drones
        const releasePromises = dronesToRelease.map(drone =>
            base44.entities.Drone.update(drone.id, { status: 'available' })
        );
        await Promise.all(releasePromises);

        alert(`${dronesToRelease.length} aeronave(s) com status inconsistente foram liberadas com sucesso! A página será recarregada.`);
        loadData(); // Reload data to reflect changes

    } catch (error) {
        console.error("Erro ao sincronizar status:", error);
        alert("Ocorreu um erro durante a sincronização. Verifique o console.");
    } finally {
        setLoading(false);
    }
  };

  const handleSaveDrone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Validate Prefix Uniqueness
      if (newDroneData.prefix && isPrefixTaken(newDroneData.prefix)) {
        alert(`O prefixo ${newDroneData.prefix} já está em uso por outra aeronave. Por favor, escolha outro.`);
        setLoading(false);
        return;
      }

      let finalBrand = newDroneData.brand;
      let finalModel = newDroneData.model;

      if (isNewBrand) {
         if (!customBrand.trim()) { alert("Digite o nome do novo fabricante."); setLoading(false); return; }
         finalBrand = customBrand.trim();
      }
      
      if (isNewModel) {
         if (!customModel.trim()) { alert("Digite o nome do novo modelo."); setLoading(false); return; }
         finalModel = customModel.trim();
      }

      if (isNewBrand || isNewModel) {
        const updatedCatalog = { ...catalog };
        if (!updatedCatalog[finalBrand!]) updatedCatalog[finalBrand!] = [];
        if (!updatedCatalog[finalBrand!].includes(finalModel!)) updatedCatalog[finalBrand!].push(finalModel!);
        await base44.system.updateCatalog(updatedCatalog);
        setCatalog(updatedCatalog);
      }

      // Safe handling of payloads array
      let finalPayloads: string[] = [];
      if (Array.isArray(newDroneData.payloads)) {
        finalPayloads = newDroneData.payloads;
      } else if (typeof newDroneData.payloads === 'string') {
        finalPayloads = (newDroneData.payloads as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      const payloadToSave = {
        ...newDroneData,
        brand: finalBrand,
        model: finalModel,
        weight: Number(newDroneData.weight) || 0,
        max_flight_time: Number(newDroneData.max_flight_time) || 30,
        max_range: Number(newDroneData.max_range) || 5000,
        max_altitude: Number(newDroneData.max_altitude) || 120,
        total_flight_hours: Number(newDroneData.total_flight_hours) || 0,
        payloads: finalPayloads,
        // Ensures last_30day_check is never undefined/null on creation to match Schema expectations
        last_30day_check: newDroneData.last_30day_check || new Date().toISOString()
      };

      if (editingId) {
        await base44.entities.Drone.update(editingId, payloadToSave);
        alert("Aeronave atualizada com sucesso!");
      } else {
        await base44.entities.Drone.create(payloadToSave as any);
        alert("Aeronave cadastrada com sucesso!");
      }

      closeModal();
      loadData();
    } catch (error: any) {
      console.error(error);
      const msg = error.message || '';
      if (msg.includes("Falta a coluna") || msg.includes("crbm")) {
          // Check for admin before setting SQL error
          if (currentUser?.role === 'admin') {
              setSqlError("ALTER TABLE public.drones ADD COLUMN IF NOT EXISTS crbm text;\nALTER TABLE public.drones ADD COLUMN IF NOT EXISTS unit text;");
          } else {
              alert("Erro de banco de dados. Contate o administrador.");
          }
      } else {
          alert(msg || "Erro ao salvar aeronave");
      }
    } finally {
      setLoading(false);
    }
  };

  const copySqlToClipboard = () => {
    if (sqlError) {
      navigator.clipboard.writeText(sqlError);
      alert("Código SQL copiado!");
    }
  };

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setEditingId(null);
    setNewDroneData({ prefix: "HARPIA 01", brand: "", model: "", status: "available", payloads: [], total_flight_hours: 0, crbm: "", unit: "" });
    setIsNewBrand(false);
    setIsNewModel(false);
    setCustomBrand("");
    setCustomModel("");
  };

  const handleSendToMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrone) return;
    setLoading(true);

    try {
      await base44.entities.Drone.update(selectedDrone.id, { status: 'maintenance' });
      
      await base44.entities.Maintenance.create({
        drone_id: selectedDrone.id,
        maintenance_type: 'corrective',
        description: `ENVIADO VIA GESTÃO DE FROTA: ${maintReason}`,
        technician: 'A definir',
        pilot_id: maintPilot || undefined,
        maintenance_date: new Date().toISOString().split('T')[0],
        maintenance_time: new Date().toLocaleTimeString(),
        next_maintenance_date: new Date().toISOString().split('T')[0],
        status: 'scheduled',
        cost: 0,
        in_flight_incident: false,
      } as any);

      alert(`${selectedDrone.prefix} enviado para manutenção.`);
      setSelectedDrone(null);
      setMaintReason("");
      setMaintPilot("");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  };

  // --- 7 DAY CHECKLIST FUNCTIONS ---

  const openChecklistModal = (drone: Drone) => {
    setCurrentChecklistDrone(drone);
    
    // Initialize checklist items from template
    const initialItems: ChecklistItemState[] = [];
    Object.entries(DRONE_CHECKLIST_TEMPLATE).forEach(([category, items]) => {
      (items as string[]).forEach(item => {
        initialItems.push({ category, name: item, checked: false });
      });
    });
    
    setChecklistItems(initialItems);
    setChecklistNotes("");
    setChecklistPilotId(currentUser?.id || "");
    setIsChecklistModalOpen(true);
  };

  const toggleChecklistItem = (index: number) => {
    const newItems = [...checklistItems];
    newItems[index].checked = !newItems[index].checked;
    setChecklistItems(newItems);
  };

  const handleSaveChecklist = async () => {
    if (!currentChecklistDrone) return;
    
    const unchecked = checklistItems.filter(i => !i.checked);
    const status = unchecked.length === 0 ? 'approved' : 'rejected';
    
    if (status === 'rejected' && !checklistNotes.trim()) {
      alert("Existem itens não verificados. Por favor, justifique nas observações.");
      return;
    }

    setLoading(true);
    try {
      await base44.entities.DroneChecklist.create({
        drone_id: currentChecklistDrone.id,
        pilot_id: checklistPilotId,
        date: new Date().toISOString(),
        items: checklistItems,
        status: status,
        notes: checklistNotes
      } as any);

      if (status === 'approved') {
        await base44.entities.Drone.update(currentChecklistDrone.id, {
          last_30day_check: new Date().toISOString()
        });
        alert("Checklist semanal (7 dias) realizado com sucesso! Validade renovada.");
      } else {
        alert("Checklist registrado como REPROVADO. Aeronave deve passar por inspeção.");
      }

      setIsChecklistModalOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar checklist.");
    } finally {
      setLoading(false);
    }
  };

  // --- GENERATE TECHNICAL REPORT ---

  const handleDownloadDroneReport = async (drone: Drone) => {
    setLoading(true);
    try {
      const [maintenances, checklists] = await Promise.all([
        base44.entities.Maintenance.filter({ drone_id: drone.id }),
        base44.entities.DroneChecklist.filter({ drone_id: drone.id })
      ]);
      
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;

      const doc = new jsPDF();
      const logoData = await getImageData(SYSARP_LOGO);
      
      // Header
      try { doc.addImage(logoData, "PNG", 14, 10, 20, 20); } catch(e) {}
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DA AERONAVE", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text("CORPO DE BOMBEIROS MILITAR DO PARANÁ", 105, 26, { align: "center" });
      
      // Drone Info
      doc.setFillColor(200, 200, 200);
      doc.rect(14, 35, 182, 8, 'F');
      doc.text("IDENTIFICAÇÃO E STATUS", 16, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let y = 50;
      doc.text(`Prefixo: ${drone.prefix}`, 14, y);
      doc.text(`Modelo: ${drone.brand} ${drone.model}`, 80, y);
      doc.text(`SISANT: ${drone.sisant}`, 150, y);
      
      y += 7;
      doc.text(`Serial: ${drone.serial_number}`, 14, y);
      doc.text(`Horas Totais: ${drone.total_flight_hours.toFixed(1)}h`, 80, y);
      
      if (drone.unit) {
          y += 7;
          doc.text(`Lotação: ${drone.unit}`, 14, y);
          doc.text(`Regional: ${drone.crbm || ''}`, 80, y);
      }
      
      const tbo = getTBOStatus(drone.total_flight_hours);
      doc.text(`TBO (50h): ${tbo.remaining.toFixed(1)}h restantes`, 150, y);

      // Maintenance History
      y += 15;
      doc.setFont("helvetica", "bold");
      doc.text("HISTÓRICO DE MANUTENÇÃO", 14, y);
      
      if (maintenances.length > 0) {
        autoTable(doc, {
          startY: y + 2,
          head: [['Data', 'Tipo', 'Descrição', 'Técnico', 'Custo']],
          body: maintenances.slice(0, 10).map((m: Maintenance) => [
             new Date(m.maintenance_date).toLocaleDateString(),
             m.maintenance_type.toUpperCase(),
             m.description,
             m.technician,
             `R$ ${m.cost.toFixed(2)}`
          ]),
          theme: 'grid',
          styles: { fontSize: 8 }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFont("helvetica", "italic");
        doc.text("Nenhum registro de manutenção encontrado.", 14, y + 8);
        y += 15;
      }

      // Checklist History
      doc.setFont("helvetica", "bold");
      doc.text("ÚLTIMOS CHECKLISTS (7 DIAS)", 14, y);

      if (checklists.length > 0) {
        // Sort by date desc
        const sortedChecks = checklists.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        autoTable(doc, {
          startY: y + 2,
          head: [['Data', 'Piloto ID', 'Status', 'Notas']],
          body: sortedChecks.slice(0, 10).map((c: any) => [
             new Date(c.date).toLocaleDateString(),
             // Ideally fetch pilot name, but ID serves for log
             c.pilot_id,
             c.status === 'approved' ? 'APROVADO' : 'REPROVADO',
             c.notes || '-'
          ]),
          theme: 'grid',
          styles: { fontSize: 8 }
        });
      } else {
         doc.setFont("helvetica", "italic");
         doc.text("Nenhum checklist registrado.", 14, y + 8);
      }

      doc.save(`Relatorio_${drone.prefix.replace(/\s/g, '_')}.pdf`);

    } catch (e) {
      console.error(e);
      alert("Erro ao gerar ficha técnica.");
    } finally {
      setLoading(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <Badge variant="success">Disponível</Badge>;
      case 'in_operation': return <Badge variant="danger">Em Operação</Badge>;
      case 'maintenance': return <Badge variant="warning">Manutenção</Badge>;
      default: return <Badge>Desconhecido</Badge>;
    }
  };

  // TBO Calculation Helper
  const getTBOStatus = (totalHours: number) => {
    const cycle = 50;
    const hoursInCycle = totalHours % cycle;
    const percentage = (hoursInCycle / cycle) * 100;
    const remaining = cycle - hoursInCycle;
    
    let color = "bg-green-500";
    if (percentage > 70) color = "bg-yellow-500";
    if (percentage > 90) color = "bg-red-500";

    return { percentage, remaining, color };
  };

  // 7 Day Checklist Helper (Updated Logic)
  const getChecklistStatus = (lastCheck?: string) => {
    const CYCLE_DAYS = 7;
    const CYCLE_MS = CYCLE_DAYS * 24 * 60 * 60 * 1000;

    if (!lastCheck) {
        return { 
            daysLeft: 0, 
            percentage: 0, // Bar empty (or full red depending on UI preference)
            color: "text-red-600", 
            barColor: "bg-red-600",
            bg: "bg-red-100", 
            label: "Vencido" 
        };
    }

    const last = new Date(lastCheck).getTime();
    const now = new Date().getTime();
    const elapsed = now - last;
    const remainingMs = CYCLE_MS - elapsed;
    
    // Days left (rounded up so 25h left shows 2 days)
    const daysLeft = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    // Percentage of time remaining (100% = freshly checked, 0% = expired)
    let percentage = (remainingMs / CYCLE_MS) * 100;
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    if (remainingMs <= 0) {
        return { 
            daysLeft: 0, 
            percentage: 0,
            color: "text-red-600", 
            barColor: "bg-red-600",
            bg: "bg-red-100", 
            label: `Vencido há ${Math.abs(daysLeft)} dias` 
        };
    }
    
    if (daysLeft <= 2) {
        return { 
            daysLeft, 
            percentage,
            color: "text-amber-600", 
            barColor: "bg-amber-500",
            bg: "bg-amber-100", 
            label: `Vence em ${daysLeft} dias` 
        };
    }
    
    return { 
        daysLeft, 
        percentage,
        color: "text-green-600", 
        barColor: "bg-green-500",
        bg: "bg-green-100", 
        label: `${daysLeft} dias restantes` 
    };
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      <div className="flex-shrink-0 bg-white border-b border-slate-200 p-4 md:p-6 shadow-sm z-10 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <DroneIcon className="w-8 h-8 text-slate-700" />
                Gestão de Frota
            </h1>
            {currentUser?.role === 'admin' && (
              <div className="flex gap-2 w-full md:w-auto">
                <Button onClick={handleSyncStatus} disabled={loading} variant="outline" className="h-10 text-sm flex-1 md:flex-initial bg-white">
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Sincronizar Status
                </Button>
                <Button onClick={() => setIsCreateModalOpen(true)} className="h-10 text-sm flex-1 md:flex-initial">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Aeronave
                </Button>
              </div>
            )}
        </div>
        
        {/* FILTERS BAR */}
        <Card className="p-4 bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase">
                <Filter className="w-3 h-3" /> Filtros de Frota
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-1">
                    <Input
                      placeholder="Buscar por Prefixo, Modelo..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-10 text-sm bg-white"
                    />
                </div>
                <div className="lg:col-span-1">
                    <Select 
                       value={filterCrbm} 
                       onChange={e => { setFilterCrbm(e.target.value); setFilterUnit("all"); }}
                       className="h-10 text-sm bg-white"
                    >
                        <option value="all">Todos os CRBMs</option>
                        {Object.keys(ORGANIZATION_CHART).map(crbm => <option key={crbm} value={crbm}>{crbm}</option>)}
                    </Select>
                </div>
                <div className="lg:col-span-1">
                    <Select 
                       value={filterUnit} 
                       onChange={e => setFilterUnit(e.target.value)}
                       disabled={filterCrbm === "all"}
                       className="h-10 text-sm bg-white disabled:bg-slate-100"
                    >
                        <option value="all">Todas as Unidades</option>
                        {filterCrbm !== "all" && ORGANIZATION_CHART[filterCrbm as keyof typeof ORGANIZATION_CHART]?.map((unit: string) => <option key={unit} value={unit}>{unit}</option>)}
                    </Select>
                </div>
                <div className="lg:col-span-1">
                    <Select 
                       value={filterStatus} 
                       onChange={e => setFilterStatus(e.target.value)}
                       className="h-10 text-sm bg-white"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="available">Disponível</option>
                        <option value="in_operation">Em Operação</option>
                        <option value="maintenance">Manutenção</option>
                    </Select>
                </div>
                <div className="lg:col-span-1 flex gap-2">
                    <Button onClick={handleResetFilters} variant="outline" className="h-10 bg-white" title="Limpar Filtros">
                        <RefreshCcw className="w-4 h-4" />
                    </Button>
                    <Button onClick={handleExportReport} disabled={generatingPdf} className="h-10 flex-1 bg-slate-800 text-white hover:bg-slate-900">
                        <FileText className="w-4 h-4 mr-2" />
                        {generatingPdf ? 'Gerando...' : 'Relatório'}
                    </Button>
                </div>
            </div>
        </Card>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
            {filteredDrones.length > 0 ? filteredDrones.map((drone) => {
              const tbo = getTBOStatus(drone.total_flight_hours || 0);
              const checklist = getChecklistStatus(drone.last_30day_check);
              const isFT = drone.unit?.includes("FORÇA TAREFA") || drone.unit?.includes("FT");

              return (
                <Card key={drone.id} className={`flex flex-col h-full overflow-hidden hover:shadow-lg transition-shadow relative ${isFT ? 'ring-2 ring-orange-500' : ''}`}>
                  {isFT && (
                      <div className="absolute top-0 right-0 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg z-10 flex items-center gap-1 shadow-md">
                          <Zap className="w-3 h-3" /> FORÇA TAREFA
                      </div>
                  )}
                  
                  <div className="bg-slate-900 p-4 flex justify-between items-start pt-6">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-slate-800 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <DroneIcon className="w-8 h-8 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-base md:text-lg break-words leading-tight">{drone.prefix}</h3>
                        <p className="text-xs text-slate-400 font-medium break-words whitespace-normal leading-tight mt-0.5">{drone.brand} {drone.model}</p>
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 flex flex-col items-end gap-2">
                      {getStatusBadge(drone.status)}
                      {currentUser?.role === 'admin' && (
                         <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeleteDrone(drone.id); 
                            }}
                            disabled={deletingId === drone.id}
                            aria-disabled={deletingId === drone.id}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors
                              ${deletingId === drone.id ? 'opacity-60 cursor-not-allowed bg-red-900/30 text-red-200 border-red-900/30' : 'bg-red-950/50 border border-red-900/50 text-red-400 hover:text-red-200 hover:bg-red-900'}`}
                            title="Excluir Aeronave"
                         >
                            <Trash2 className="w-3 h-3" /> 
                            {deletingId === drone.id ? '...' : 'Excluir'}
                         </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4 flex-1 flex flex-col">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">SISANT</p>
                        <p className="font-medium text-slate-900 break-all text-xs md:text-sm">{drone.sisant}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Validade</p>
                        <p className="font-medium text-amber-700 text-xs md:text-sm">{new Date(drone.sisant_expiry_date).toLocaleDateString()}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Nº DE SÉRIE</p>
                        <p className="font-medium text-slate-900 break-all text-xs md:text-sm">{drone.serial_number}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1"><MapPin className="w-3 h-3"/> Localização / Emprego</p>
                        <p className="font-medium text-blue-900 text-xs md:text-sm truncate" title={drone.unit || drone.crbm || 'Não Atribuído'}>
                          {drone.unit || (drone.crbm ? `${drone.crbm}` : 'Não Atribuído')}
                        </p>
                      </div>
                    </div>

                    {/* 7-DAY CHECKLIST WITH PROGRESS BAR */}
                    <div className={`p-2 rounded-lg border ${checklist.color === 'text-red-600' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                       <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className={`w-4 h-4 ${checklist.color}`} />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Checklist 7 Dias</span>
                          </div>
                          <button 
                            onClick={() => openChecklistModal(drone)}
                            className="p-1 hover:bg-white rounded-full transition-colors text-blue-600"
                            title="Realizar Checklist (Renovar)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                       </div>
                       
                       {/* Barra de Progresso do Checklist */}
                       <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                          <div 
                            className={`h-full ${checklist.barColor} transition-all duration-500`} 
                            style={{ width: `${checklist.percentage}%` }}
                          ></div>
                       </div>

                       <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${checklist.color}`}>{checklist.label}</span>
                          {checklist.daysLeft < 2 && (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                          )}
                       </div>
                    </div>

                    {/* TBO / Maintenance Health Bar */}
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Manutenção (TBO)
                         </span>
                         <span className="text-[10px] font-bold text-slate-700">{tbo.remaining.toFixed(1)}h rest.</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${tbo.color} transition-all duration-500`} style={{ width: `${tbo.percentage}%` }}></div>
                      </div>
                      <div className="mt-1 flex justify-between">
                         <span className="text-[9px] text-slate-400">Total Voo: {drone.total_flight_hours?.toFixed(1) || 0}h</span>
                      </div>
                    </div>

                    {/* --- STACKED BUTTONS FOR MOBILE/TABLET --- */}
                    <div className="space-y-2">
                        <Button 
                          onClick={() => setInventoryDrone(drone)}
                          variant="outline" 
                          className="w-full h-8 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                        >
                          <Box className="w-3 h-3 mr-1.5" /> Almoxarifado
                        </Button>

                        <Button 
                          onClick={() => handleDownloadDroneReport(drone)}
                          variant="outline" 
                          className="w-full h-8 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        >
                          <FileText className="w-3 h-3 mr-1.5" /> Relatório
                        </Button>
                    </div>

                    <div className="pt-2 flex gap-2 mt-auto border-t border-slate-100">
                      {currentUser?.role === 'admin' && (
                        <Button 
                          variant="outline" 
                          className="px-2 h-9 border-slate-300 text-slate-600 hover:bg-slate-100 min-w-[36px]"
                          onClick={() => handleEditDrone(drone)}
                          title="Editar Informações"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      {drone.status !== 'maintenance' ? (
                        <Button 
                          variant="danger" 
                          className="flex-1 text-xs h-9 bg-red-600 hover:bg-red-700 text-white border-none"
                          onClick={() => setSelectedDrone(drone)}
                        >
                          Manutenção
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          className="flex-1 text-xs h-9 bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                          onClick={() => {
                              if(confirm("Liberar aeronave da manutenção?")) {
                                  base44.entities.Drone.update(drone.id, { status: 'available' }).then(loadData);
                              }
                          }}
                        >
                          Liberar
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            }) : (
              <div className="sm:col-span-2 lg:col-span-3 2xl:col-span-4 p-8 text-center text-slate-500 italic bg-white rounded-xl border border-dashed">
                  Nenhuma aeronave encontrada para os filtros selecionados.
              </div>
            )}
        </div>
      </div>
      
      {inventoryDrone && (
        <DroneInventoryModal
          drone={inventoryDrone}
          drones={drones}
          onClose={() => setInventoryDrone(null)}
        />
      )}

      {/* --- MODAL DE MANUTENÇÃO (Corrigido: Adicionado) --- */}
      {selectedDrone && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-white shadow-xl animate-fade-in">
            <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Enviar para Manutenção
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              A aeronave <strong>{selectedDrone.prefix}</strong> ficará indisponível para operações até que a manutenção seja concluída.
            </p>
            
            <form onSubmit={handleSendToMaintenance} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Motivo / Problema Identificado</label>
                <textarea 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-24 focus:ring-2 focus:ring-red-500 outline-none resize-none bg-white"
                  placeholder="Descreva o defeito ou motivo..."
                  required
                  value={maintReason}
                  onChange={e => setMaintReason(e.target.value)}
                />
              </div>
              
              <Select 
                label="Piloto Responsável (Relator)" 
                value={maintPilot} 
                onChange={e => setMaintPilot(e.target.value)}
              >
                <option value="">Selecione...</option>
                {pilots.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedDrone(null)}>Cancelar</Button>
                <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                  {loading ? 'Processando...' : 'Confirmar Envio'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* --- MODAL DE CHECKLIST 7 DIAS (Corrigido: Adicionado) --- */}
      {isChecklistModalOpen && currentChecklistDrone && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl p-0 shadow-xl animate-fade-in flex flex-col max-h-[90vh] bg-white">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  Checklist Semanal (7 Dias)
                </h2>
                <p className="text-xs text-slate-500">{currentChecklistDrone.prefix} - {currentChecklistDrone.model}</p>
              </div>
              <button onClick={() => setIsChecklistModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Checklist Items */}
              {Object.keys(DRONE_CHECKLIST_TEMPLATE).map((category) => {
                 // Filtra itens para esta categoria com base no estado atual
                 const catItems = checklistItems.map((item, idx) => ({ ...item, originalIdx: idx })).filter(i => i.category === category);
                 if (catItems.length === 0) return null;

                 return (
                   <div key={category} className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-700 uppercase bg-slate-100 px-2 py-1 rounded">{category}</h3>
                      <div className="space-y-1 pl-2">
                        {catItems.map((item) => (
                          <label key={item.originalIdx} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                             <input 
                               type="checkbox" 
                               className="mt-1 w-4 h-4 accent-blue-600 rounded"
                               checked={item.checked}
                               onChange={() => toggleChecklistItem(item.originalIdx)}
                             />
                             <span className={`text-sm ${item.checked ? 'text-slate-700' : 'text-slate-500'}`}>{item.name}</span>
                          </label>
                        ))}
                      </div>
                   </div>
                 )
              })}

              <div className="space-y-2 pt-4 border-t border-slate-100">
                 <label className="text-sm font-medium text-slate-700">Observações / Pendências</label>
                 <textarea 
                    className="w-full p-3 border border-slate-300 rounded-lg text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white"
                    placeholder="Alguma anomalia encontrada? Descreva aqui."
                    value={checklistNotes}
                    onChange={e => setChecklistNotes(e.target.value)}
                 />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
               <Button variant="outline" onClick={() => setIsChecklistModalOpen(false)}>Cancelar</Button>
               <Button onClick={handleSaveChecklist} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Salvando...' : 'Finalizar Checklist'}
               </Button>
            </div>
          </Card>
        </div>
      )}
      
      {/* Create/Edit Drone Modal */}
      {isCreateModalOpen && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <DroneIcon className="w-6 h-6 text-blue-600" />
                {editingId ? 'Editar Aeronave' : 'Cadastrar Nova Aeronave'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDrone} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select 
                  label="Prefixo Operacional" 
                  required 
                  value={newDroneData.prefix} 
                  onChange={e => setNewDroneData({...newDroneData, prefix: e.target.value})}
                >
                   {PREFIX_OPTIONS.map(p => {
                     const isTaken = isPrefixTaken(p);
                     return (
                       <option key={p} value={p} disabled={isTaken}>
                         {p} {isTaken ? '(EM USO)' : ''}
                       </option>
                     );
                   })}
                </Select>

                <Input 
                  label="Número de Série" 
                  required 
                  placeholder="Ex: 1581F4..."
                  value={newDroneData.serial_number || ''} 
                  onChange={e => setNewDroneData({...newDroneData, serial_number: e.target.value})}
                />
              </div>

              {/* LOCATION ASSIGNMENT SECTION */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase flex items-center gap-2">
                   <MapPin className="w-4 h-4" /> Localização / Emprego
                </h3>
                <div className="grid grid-cols-2 gap-4">
                   <Select 
                      label="Comando Regional (CRBM)" 
                      value={newDroneData.crbm || ''} 
                      onChange={e => setNewDroneData({...newDroneData, crbm: e.target.value, unit: ''})}
                   >
                      <option value="">Selecione...</option>
                      {Object.keys(ORGANIZATION_CHART).map(crbm => (
                         <option key={crbm} value={crbm}>{crbm}</option>
                      ))}
                   </Select>
                   
                   <Select 
                      label="Unidade (BBM/CIBM/FT/GOST)" 
                      value={newDroneData.unit || ''} 
                      onChange={e => setNewDroneData({...newDroneData, unit: e.target.value})}
                      disabled={!newDroneData.crbm}
                   >
                      <option value="">Selecione...</option>
                      {newDroneData.crbm && ORGANIZATION_CHART[newDroneData.crbm as keyof typeof ORGANIZATION_CHART]?.map((unit: string) => (
                         <option key={unit} value={unit}>{unit}</option>
                      ))}
                   </Select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase">Dados do Fabricante</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* BRAND SELECTOR */}
                  <div>
                    {!isNewBrand ? (
                      <Select 
                        label="Fabricante" 
                        required 
                        value={newDroneData.brand || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          setIsNewBrand(false);
                          const resetState = { model: '', weight: undefined, max_flight_time: undefined, max_range: undefined, max_altitude: undefined, payloads: [] };
                          if (val === 'NEW_BRAND') {
                            setIsNewBrand(true);
                            setNewDroneData(prev => ({...prev, ...resetState, brand: ''}));
                          } else {
                            setNewDroneData(prev => ({...prev, ...resetState, brand: val}));
                          }
                        }}
                      >
                        <option value="">Selecione...</option>
                        {Object.keys(catalog).map(brand => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                        <option value="NEW_BRAND" className="font-bold text-yellow-400 bg-slate-800">+ Adicionar Novo...</option>
                      </Select>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Novo Fabricante</label>
                        <div className="flex gap-2">
                          <Input 
                            value={customBrand}
                            onChange={e => setCustomBrand(e.target.value)}
                            placeholder="Digite o nome..."
                            className="flex-1"
                          />
                          <Button type="button" variant="danger" className="px-3" onClick={() => { setIsNewBrand(false); setCustomBrand(''); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MODEL SELECTOR */}
                  <div>
                    <Select 
                      label="Modelo" 
                      required 
                      value={newDroneData.model || ''} 
                      disabled={(!newDroneData.brand && !isNewBrand)}
                      onChange={e => {
                          const val = e.target.value;
                          setIsNewModel(false);
                          if (val === 'NEW_MODEL') {
                            setIsNewModel(true);
                            setNewDroneData(prev => ({ ...prev, model: '', weight: undefined, max_flight_time: undefined, max_range: undefined, max_altitude: undefined, payloads: [] }));
                          } else {
                            setNewDroneData(prev => {
                              if (!editingId) {
                                const existingDrone = drones.find(d => d.brand === prev.brand && d.model === val);
                                if (existingDrone) {
                                  // Match found, populate
                                  return {
                                    ...prev, model: val,
                                    weight: existingDrone.weight,
                                    max_flight_time: existingDrone.max_flight_time,
                                    max_range: existingDrone.max_range,
                                    max_altitude: existingDrone.max_altitude,
                                    payloads: existingDrone.payloads || [],
                                  };
                                } else {
                                  // No match found, so clear specs
                                  return {
                                    ...prev, model: val,
                                    weight: undefined, max_flight_time: undefined, max_range: undefined, max_altitude: undefined, payloads: []
                                  };
                                }
                              }
                              // Is editing, just update model
                              return { ...prev, model: val };
                            });
                          }
                      }}
                    >
                      <option value="">Selecione...</option>
                      {newDroneData.brand && catalog[newDroneData.brand]?.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                      {(newDroneData.brand || isNewBrand) && (
                        <option value="NEW_MODEL" className="font-bold text-yellow-400 bg-slate-800">+ Adicionar Novo...</option>
                      )}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase">Regularização (SISANT)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Número SISANT" 
                    placeholder="PP-00000000"
                    required
                    value={newDroneData.sisant || ''} 
                    onChange={e => setNewDroneData({...newDroneData, sisant: e.target.value})}
                  />
                  <Input 
                    label="Validade do SISANT" 
                    type="date"
                    required
                    value={newDroneData.sisant_expiry_date || ''} 
                    onChange={e => setNewDroneData({...newDroneData, sisant_expiry_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input 
                  label="Peso (g)" 
                  type="number" 
                  placeholder="Ex: 920"
                  required
                  value={newDroneData.weight || ''} 
                  onChange={e => setNewDroneData({...newDroneData, weight: Number(e.target.value)})}
                />
                 <Input 
                  label="Autonomia (min)" 
                  type="number" 
                  placeholder="Ex: 30"
                  required
                  value={newDroneData.max_flight_time || ''} 
                  onChange={e => setNewDroneData({...newDroneData, max_flight_time: Number(e.target.value)})}
                />
                <Input 
                  label="Alcance (m)" 
                  type="number" 
                  placeholder="Ex: 5000"
                  required
                  value={newDroneData.max_range || ''} 
                  onChange={e => setNewDroneData({...newDroneData, max_range: Number(e.target.value)})}
                />
                <Input 
                  label="Alt. Máx (m AGL)" 
                  type="number" 
                  placeholder="Ex: 120"
                  required
                  value={newDroneData.max_altitude || ''} 
                  onChange={e => setNewDroneData({...newDroneData, max_altitude: Number(e.target.value)})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Payloads (Câmeras/Sensores)" 
                  placeholder="Ex: Thermal, RGB, Lidar"
                  value={Array.isArray(newDroneData.payloads) ? newDroneData.payloads.join(', ') : (newDroneData.payloads || '')} 
                  onChange={e => setNewDroneData({...newDroneData, payloads: e.target.value})}
                />
                <Input 
                  label="Horas de Voo Iniciais" 
                  type="number"
                  placeholder="0"
                  value={newDroneData.total_flight_hours || ''} 
                  onChange={e => setNewDroneData({...newDroneData, total_flight_hours: Number(e.target.value)})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? "Salvando..." : (editingId ? "Atualizar Aeronave" : "Cadastrar Aeronave")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}