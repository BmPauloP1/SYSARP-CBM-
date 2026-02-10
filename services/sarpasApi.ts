
import { Operation, Drone, Pilot } from "../types";

// =============================================================================
// SERVIÇO FRONTEND (Cliente HTTP) - DESATIVADO TEMPORARIAMENTE
// =============================================================================

// CHAVE DE ATIVAÇÃO DA INTEGRAÇÃO (Setar para TRUE para ativar em produção)
const IS_INTEGRATION_ACTIVE = false;

export const sarpasApi = {
  
  /**
   * Envia a solicitação para o Backend Proxy.
   * Interceptado para evitar erros de 'Failed to fetch'.
   */
  submitFlightRequest: async (
    operation: Partial<Operation>,
    pilot: Pilot,
    drone: Drone
  ): Promise<string> => {
    
    // Interceptação imediata para evitar requisições de rede
    if (!IS_INTEGRATION_ACTIVE) {
      console.warn("[SARPAS] Integração inativa por configuração.");
      throw new Error("A integração automática com o SARPAS-NG está desativada. Por favor, registre o voo manualmente no Portal do DECEA e insira o protocolo no campo correspondente da missão.");
    }

    // Se um dia for reativado, este código será executado
    try {
      const response = await fetch('/api/sarpas/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, pilot, drone })
      });

      if (!response.ok) throw new Error(`Erro de rede: ${response.status}`);

      const data = await response.json();
      return data.protocol || "";
    } catch (error: any) {
      throw new Error("Não foi possível conectar ao servidor de integração SARPAS.");
    }
  },

  checkStatus: async (protocol: string): Promise<any> => {
    return { status: "UNKNOWN", message: "Integração inativa." };
  }
};
