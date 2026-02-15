
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Porta dinâmica para produção (Vercel/Render/Railway) ou local 8080
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Configurações do Supabase fornecidas
const SB_URL = "https://hcnlrzzwwcbhkxfcolgw.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjbmxyenp3d2NiaGt4ZmNvbGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjI2MjUsImV4cCI6MjA3OTk5ODYyNX0.bbfDQA8VHebBMizyJGeP1GentnEiEka1nvFdR7fgQwo";

// Middleware para processar JSON pesado (telemetria em lote)
app.use(express.json({ limit: '20mb' }));

// Configuração de CORS para permitir que o APK e o Web se comuniquem sem restrições
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve arquivos estáticos do frontend (pasta dist do Vite)
app.use(express.static(path.join(__dirname, 'dist')));

/**
 * Sincroniza ciclos de vida da bateria no almoxarifado técnico
 */
async function syncInventory(batteryInfo) {
  if (!batteryInfo.sn) return;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/materials?serial_number=eq.${batteryInfo.sn}&select=id,type`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    const materials = await res.json();
    
    if (materials && materials.length > 0 && materials[0].type === 'battery') {
      const matId = materials[0].id;
      const health = Math.max(0, Math.round(100 - (batteryInfo.cycles / 200 * 100)));
      
      console.log(`[SYNC] Bateria detectada: ${batteryInfo.sn} | Ciclos: ${batteryInfo.cycles}`);
      
      await fetch(`${SB_URL}/rest/v1/battery_stats?material_id=eq.${matId}`, {
        method: 'PATCH',
        headers: { 
          'apikey': SB_KEY, 
          'Authorization': `Bearer ${SB_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          cycles: batteryInfo.cycles, 
          health_percent: health,
          voltage_v: batteryInfo.voltage,
          updated_at: new Date().toISOString()
        })
      });
    }
  } catch (e) { 
    console.error(`[ERROR SYNC] Falha no inventário:`, e.message); 
  }
}

/**
 * Endpoint de Telemetria (Recebe dados do APK SYSARP Link)
 */
app.post('/api/telemetry/stream', async (req, res) => {
  try {
    const packets = Array.isArray(req.body) ? req.body : [req.body];
    if (packets.length === 0) return res.status(400).send('Dados ausentes');

    const last = packets[packets.length - 1];
    
    console.log(`[LIVE] Drone: ${last.drone_sn} | Alt: ${last.altitude}m | Bat: ${last.battery_percent}%`);

    // Atualiza tabela live no Supabase
    if (last.drone_sn) {
      const dbResponse = await fetch(`${SB_URL}/rest/v1/drone_live_status`, {
        method: 'POST',
        headers: { 
          'apikey': SB_KEY, 
          'Authorization': `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' 
        },
        body: JSON.stringify({
          drone_sn: last.drone_sn,
          pilot_id: last.pilot_id,
          latitude: last.latitude,
          longitude: last.longitude,
          altitude: last.altitude,
          battery_percent: last.battery_percent,
          batteries: last.batteries || [],
          system_status: last.system_status,
          last_update: new Date().toISOString()
        })
      });

      if (!dbResponse.ok) {
        const errorText = await dbResponse.text();
        console.error(`[DB ERROR] Falha no Supabase: ${errorText}`);
      }

      // Sincroniza hardware se houver dados de bateria
      if (last.batteries && last.batteries.length > 0) {
        for (const bat of last.batteries) {
          await syncInventory(bat);
        }
      }
    }

    res.status(200).json({ status: 'received', count: packets.length });
  } catch (err) {
    console.error(`[CRITICAL ERROR]`, err.message);
    res.status(500).send(err.message);
  }
});

// Rota de saúde para o monitoramento de produção
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'online', 
    target_supabase: SB_URL,
    uptime: process.uptime()
  });
});

// Fallback para o React (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`
  🚁 SYSARP BACKEND - PRODUÇÃO
  --------------------------------------------------
  Endpoint Telemetria: https://sysarp-cbm.vercel.app/api/telemetry/stream
  Destino Supabase: ${SB_URL}
  --------------------------------------------------
  `);
});
