
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Porta padrão para serviços como Render/Railway ou local 8080
const PORT = parseInt(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

// Configurações do Supabase (Prioriza ENV, usa as suas chaves como fallback de segurança)
const SB_URL = process.env.VITE_SUPABASE_URL || "https://hcnlrzzwwcbhkxfcolgw.supabase.co";
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjbmxyenp3d2NiaGt4ZmNvbGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjI2MjUsImV4cCI6MjA3OTk5ODYyNX0.bbfDQA8VHebBMizyJGeP1GentnEiEka1nvFdR7fgQwo";

// Middleware
app.use(express.json({ limit: '10mb' }));

// Configuração de CORS para permitir requisições do APK e do Frontend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve arquivos estáticos do Vite (se estiver rodando em modo produção unificado)
app.use(express.static(path.join(__dirname, 'dist')));

/**
 * Atualiza o inventário (Ciclos de Bateria) baseado na telemetria do APK
 */
async function syncInventory(batteryInfo) {
  if (!SB_URL || !SB_KEY || !batteryInfo.sn) return;
  try {
    // Busca o material no almoxarifado pelo Serial Number
    const res = await fetch(`${SB_URL}/rest/v1/materials?serial_number=eq.${batteryInfo.sn}&select=id,type`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    const materials = await res.json();
    
    if (materials && materials.length > 0 && materials[0].type === 'battery') {
      const matId = materials[0].id;
      // Calcula saúde baseada em 200 ciclos padrão
      const health = Math.max(0, Math.round(100 - (batteryInfo.cycles / 200 * 100)));
      
      console.log(`[SYNC] Atualizando bateria SN: ${batteryInfo.sn} para ${batteryInfo.cycles} ciclos.`);
      
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
    console.error(`[ERROR SYNC] Falha na bateria ${batteryInfo.sn}:`, e.message); 
  }
}

/**
 * Endpoint de Telemetria (O APK SYSARP Link envia os dados para cá)
 */
app.post('/api/telemetry/stream', async (req, res) => {
  try {
    const packets = Array.isArray(req.body) ? req.body : [req.body];
    if (packets.length === 0) return res.status(400).send('Corpo da requisição vazio');

    const last = packets[packets.length - 1];
    
    console.log(`[TELEMETRY] Recebido pacote do drone: ${last.drone_sn || 'N/A'} - Piloto: ${last.pilot_id || 'N/A'}`);

    // Persiste o status em tempo real no Supabase
    if (last.drone_sn && SB_URL) {
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
        console.error(`[DB ERROR] Supabase rejeitou pacote: ${errorText}`);
      }

      // Sincroniza ciclos de bateria com o inventário se houver dados
      if (last.batteries && last.batteries.length > 0) {
        for (const bat of last.batteries) {
          await syncInventory(bat);
        }
      }
    }

    res.status(200).json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(`[CRITICAL ERROR]`, err.message);
    res.status(500).send(err.message);
  }
});

// Endpoint de verificação de saúde
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'online', 
    supabase_connected: !!SB_URL,
    timestamp: new Date().toISOString()
  });
});

// Fallback para o SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`
  🚁 SYSARP TELEMETRY SERVER
  ---------------------------
  Status: Ativo e escutando
  Porta: ${PORT}
  Host: ${HOST}
  Supabase Target: ${SB_URL}
  Endpoint: http://${HOST}:${PORT}/api/telemetry/stream
  ---------------------------
  `);
});
