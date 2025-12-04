import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Certifique-se de que node-fetch está instalado ou use o fetch nativo do Node 18+

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cloud Run injeta a porta via process.env.PORT. Padrão é 8080.
const PORT = parseInt(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

// Middleware para processar JSON no corpo das requisições
app.use(express.json());

// Serve os arquivos estáticos gerados pelo Vite na pasta dist
app.use(express.static(path.join(__dirname, 'dist')));

// Endpoint de verificação de saúde
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// =============================================================================
// INTEGRAÇÃO SARPAS NG (BACKEND PROXY)
// =============================================================================

const SARPAS_BASE_URL = "https://brutm.xmobots.com/api/brutm";

// Helpers de Formatação
const formatSarpasDate = (dateString) => {
  const dateObj = new Date(dateString);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return {
    day: `${year}-${month}-${day}`,
    hour: `${hours}:${minutes}`
  };
};

const getSarpasOperationType = (missionType) => {
  const specialMissions = [
    'fire', 'sar', 'natural_disaster', 'traffic_accident', 
    'hazmat', 'public_security', 'aph', 'air_support'
  ];
  return specialMissions.includes(missionType) ? "SPECIAL" : "STANDARD";
};

// Rota de Envio de Solicitação
app.post('/api/sarpas/send', async (req, res) => {
  try {
    const { operation, pilot, drone } = req.body;

    // 1. Validações de Entrada (Backend)
    if (!operation || !pilot || !drone) {
      return res.status(400).json({ success: false, error: "Dados incompletos (operation, pilot, drone)" });
    }
    if (!pilot.sarpas_code) {
      return res.status(400).json({ success: false, error: "Piloto sem Código SARPAS" });
    }
    if (!drone.sisant && !drone.uuid) {
      return res.status(400).json({ success: false, error: "Aeronave sem UUID/SISANT" });
    }
    
    const lat = Number(operation.latitude);
    const lng = Number(operation.longitude);
    const altitude = Number(operation.flight_altitude);
    const radius = Number(operation.radius);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: "Coordenadas inválidas" });
    }

    // 2. Preparação de Dados
    const startDate = new Date(operation.start_time || Date.now());
    const endDate = operation.end_time 
      ? new Date(operation.end_time) 
      : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const startFmt = formatSarpasDate(startDate);
    const endFmt = formatSarpasDate(endDate);

    // 3. Construção do Payload (SolicitationDataDTO)
    const payload = {
      data: {
        type: "solicitation",
        attributes: {
          operation: {
            basic_information: {
              name: operation.name || `OP-SYSARP-${Date.now()}`,
              type: getSarpasOperationType(operation.mission_type),
              agree_terms: 1
            },
            aircrafts: [
              {
                id: 0,
                uuid: drone.sisant || drone.uuid
              }
            ],
            flight: {
              pilots: [], // Array vazio pois usamos sarpas_code no flight
              sarpas_code: pilot.sarpas_code,
              type: "VLOS",
              date: {
                start_day: startFmt.day,
                start_hour: startFmt.hour,
                finish_day: endFmt.day,
                finish_hour: endFmt.hour
              },
              area: {
                flight_distance: radius,
                flight_type: "CIRCULAR",
                takeoff_point: [lat, lng], // [Latitude, Longitude]
                landing_point: [lat, lng],
                required_route: {
                  geojson: {
                    type: "Feature",
                    properties: {
                      radius: radius,
                      upperLimit: altitude,
                      lowerLimit: 0
                    },
                    geometry: {
                      type: "Point",
                      coordinates: [lng, lat] // GeoJSON padrão: [Longitude, Latitude]
                    }
                  }
                }
              },
              communication: {
                ats_call_type: "TEL",
                rpa_call_type: "TEL",
                rps: [
                  {
                    name: (pilot.full_name || "Piloto").substring(0, 40),
                    lat: String(lat),
                    lng: String(lng),
                    contact_info: pilot.phone || "N/A",
                    radius: radius
                  }
                ]
              },
              observations: (operation.description || "Operação Bombeiros - SYSARP").substring(0, 200),
              documents: []
            }
          }
        }
      }
    };

    // 4. Token de Autenticação (Variável de Ambiente)
    const token = process.env.SARPAS_TOKEN;
    
    if (!token) {
      console.error("[SARPAS] Token não configurado no servidor");
      return res.status(500).json({ success: false, error: "Erro de configuração do servidor (Token ausente)" });
    }

    console.log("[SARPAS] Enviando payload para endpoint externo...");

    // 5. Envio para API Externa
    const response = await fetch(`${SARPAS_BASE_URL}/sarpas/solicitation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[SARPAS] Erro na resposta:", responseData);
      const errorDetail = responseData.errors?.[0]?.detail || responseData.message || "Erro desconhecido no SARPAS";
      return res.status(response.status).json({ 
        success: false, 
        error: `SARPAS Recusou: ${errorDetail}`,
        details: responseData
      });
    }

    // 6. Extração do Protocolo
    const protocol = responseData?.data?.attributes?.protocol;

    if (!protocol) {
      console.error("[SARPAS] Resposta sem protocolo:", responseData);
      return res.status(502).json({ success: false, error: "Resposta inválida do SARPAS (sem protocolo)" });
    }

    console.log(`[SARPAS] Sucesso! Protocolo: ${protocol}`);

    return res.status(200).json({
      success: true,
      protocol: protocol,
      raw: responseData
    });

  } catch (error) {
    console.error("[SARPAS] Erro interno:", error);
    return res.status(500).json({ success: false, error: "Erro interno no servidor SYSARP" });
  }
});

// =============================================================================

// Roteamento SPA: Qualquer rota não encontrada retorna o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});