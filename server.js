import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; 

import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Configuração do Transmissor de Email (Nodemailer)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Envia alerta de checklist vencido/vencendo
 */
async function sendChecklistAlerts() {
  if (!SB_URL || !SB_KEY) return;
  console.log("Iniciando verificação de checklists...");
  
  try {
    // Busca drones e pilotos
    const [dronesRes, pilotsRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/drones?select=*`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }),
      fetch(`${SB_URL}/rest/v1/pilots?select=*`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } })
    ]);
    
    const drones = await dronesRes.json();
    const pilots = await pilotsRes.json();
    
    const now = new Date();
    const alerts = [];

    for (const drone of drones) {
      if (!drone.last_30day_check) continue;
      
      const lastCheck = new Date(drone.last_30day_check);
      const diffDays = (now.getTime() - lastCheck.getTime()) / (1000 * 3600 * 24);
      
      if (diffDays >= 27) {
        const status = diffDays >= 30 ? 'VENCIDO' : 'VENCENDO EM BREVE';
        const unitPilots = pilots.filter(p => p.unit === drone.unit && p.email);
        
        if (unitPilots.length > 0) {
          alerts.push({
            drone: drone.prefix,
            status,
            days: Math.round(diffDays),
            emails: unitPilots.map(p => p.email)
          });
        }
      }
    }

    for (const alert of alerts) {
      const mailOptions = {
        from: `"SYSARP Alerta" <${process.env.SMTP_USER}>`,
        to: alert.emails.join(','),
        subject: `[ALERTA] Checklist ${alert.status} - Drone ${alert.drone}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #b91c1c;">Alerta de Manutenção Preventiva</h2>
            <p>O checklist de 30 dias da aeronave <strong>${alert.drone}</strong> está <strong>${alert.status}</strong>.</p>
            <p>Última verificação realizada há ${alert.days} dias.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">Este é um aviso automático do sistema SYSARP CBMPR. Favor regularizar a situação no painel de gestão de frota.</p>
          </div>
        `
      };
      
      try {
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          await transporter.sendMail(mailOptions);
          console.log(`Email enviado para ${alert.drone}`);
        } else {
          console.log(`[SIMULAÇÃO] Email para ${alert.drone} (SMTP não configurado)`);
        }
      } catch (err) {
        console.error(`Erro ao enviar email para ${alert.drone}:`, err.message);
      }
    }
  } catch (e) {
    console.error("Erro Alertas Checklist:", e.message);
  }
}

// Executa a cada 24 horas
setInterval(sendChecklistAlerts, 24 * 60 * 60 * 1000);

// Endpoint para disparar manualmente (para testes)
app.post('/api/notifications/check-now', async (req, res) => {
  await sendChecklistAlerts();
  res.json({ success: true, message: "Verificação iniciada" });
});

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