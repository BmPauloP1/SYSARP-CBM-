import { Operation, Drone, Pilot } from "../types";

// =============================================================================
// SERVIÇO FRONTEND (Cliente HTTP)
// Este arquivo roda no navegador e comunica com o backend local (/api/sarpas/send)
// =============================================================================

interface SolicitationResponse {
  success: boolean;
  protocol?: string;
  error?: string;
  raw?: any;
}

export const sarpasApi = {
  
  /**
   * Envia a solicitação para o Backend Proxy (/api/sarpas/send).
   * O Backend (server.js) se encarrega de montar o payload complexo do Swagger,
   * autenticar com o Token seguro e realizar a chamada HTTPS real para a XMobots.
   */
  submitFlightRequest: async (
    operation: Partial<Operation>,
    pilot: Pilot,
    drone: Drone
  ): Promise<string> => {
    
    // 1. Validações de Pré-requisitos (Client-Side Fail Fast)
    if (!pilot.sarpas_code || pilot.sarpas_code.length < 3) {
      throw new Error("O piloto selecionado não possui um Código SARPAS válido cadastrado.");
    }

    if (!drone.sisant || drone.sisant.length < 5) {
      throw new Error("A aeronave selecionada não possui cadastro SISANT válido.");
    }

    // Garante que são números
    const lat = Number(operation.latitude);
    const lng = Number(operation.longitude);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      throw new Error("Coordenadas geográficas da operação são inválidas ou ausentes.");
    }

    // 2. Envio para o Backend (Proxy Seguro)
    console.log("[SARPAS CLIENT] Iniciando envio via Backend (/api/sarpas/send)...");

    try {
      // Usa o endpoint local /api que o Vite redireciona para o server.js (porta 8080)
      const response = await fetch('/api/sarpas/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation,
          pilot,
          drone
        })
      });

      // Tratamento de Erros de Rede / Servidor Down
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("[SARPAS CLIENT] Resposta inválida do backend:", text);
          throw new Error(`Erro de comunicação com o servidor local (Status ${response.status}). Verifique se o backend está rodando.`);
      }

      const data: SolicitationResponse = await response.json();

      if (!response.ok || !data.success) {
        console.error("[SARPAS CLIENT] Erro retornado:", data);
        throw new Error(data.error || "O servidor rejeitou a solicitação.");
      }

      if (!data.protocol) {
        throw new Error("A operação foi aceita, mas o protocolo não foi retornado.");
      }

      console.log(`[SARPAS CLIENT] Sucesso! Protocolo Oficial: ${data.protocol}`);
      return data.protocol;

    } catch (error: any) {
      console.error("[SARPAS CLIENT] Falha no fluxo:", error);
      
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
         throw new Error("Não foi possível conectar ao servidor local (Backend). Verifique a conexão.");
      }
      
      throw error;
    }
  },

  /**
   * Consulta status via Backend (placeholder por enquanto)
   */
  checkStatus: async (protocol: string): Promise<any> => {
    return { status: "UNKNOWN", message: "Verifique no painel oficial do SARPAS" };
  }
};