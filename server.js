import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

/**
 * Atualiza o inventário (Ciclos de Bateria)
 */
async function syncInventory(batteryInfo) {
  if (!SB_URL || !SB_KEY || !batteryInfo.sn) return;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/materials?serial_number=eq.${batteryInfo.sn}&select=id,type`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    const materials = await res.json();
    
    if (materials?.[0]?.type === 'battery') {
      const matId = materials[0].id;
      // Atualiza ciclos e recalcula saúde (base 200 ciclos)
      const health = Math.max(0, Math.round(100 - (batteryInfo.cycles / 200 * 100)));
      
      await fetch(`${SB_URL}/rest/v1/battery_stats?material_id=eq.${matId}`, {
        method: 'PATCH',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cycles: batteryInfo.cycles, 
          health_percent: health,
          voltage_v: batteryInfo.voltage
        })
      });
    }
  } catch (e) { console.error("Erro Inventário:", e.message); }
}

/**
 * Endpoint de Telemetria (O APK envia para cá)
 * No Vercel, este endpoint deve ser configurado no vercel.json ou pasta /api
 */
app.post('/api/telemetry/stream', async (req, res) => {
  try {
    const packets = Array.isArray(req.body) ? req.body : [req.body];
    if (packets.length === 0) return res.status(400).send('Vazio');

    const last = packets[packets.length - 1];
    
    // Persiste o status LIVE no Supabase (Para o Vercel não esquecer)
    if (last.drone_sn && SB_URL) {
      await fetch(`${SB_URL}/rest/v1/drone_live_status?drone_sn=eq.${last.drone_sn}`, {
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
          batteries: last.batteries,
          system_status: last.system_status,
          last_update: new Date().toISOString()
        })
      });

      // Sincroniza hardware
      for (const bat of (last.batteries || [])) {
        await syncInventory(bat);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, HOST, () => {
  console.log(`SYSARP Server: http://${HOST}:${PORT}`);
});