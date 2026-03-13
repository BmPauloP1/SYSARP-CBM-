import { base44 } from './base44Client';
import { Operation, OperationPendency, Pilot } from '../types';

class PendencyService {
    async createPendency(operationId: string, reopenedById: string, assignedToId: string, reason: string): Promise<OperationPendency> {
        try {
            // 1. Altera o status da operação para 'active'
            const updatedOp = await base44.entities.Operation.update(operationId, { status: 'active' });

            // 2. Cria o registro de pendência
            const pendencyData = {
                operation_id: operationId,
                reopened_by_id: reopenedById,
                assigned_to_id: assignedToId,
                reason: reason,
                status: 'pending' as const,
            };
            
            try {
                const newPendency = await base44.entities.OperationPendency.create(pendencyData);
                return newPendency as OperationPendency;
            } catch (pendencyError: any) {
                // Rollback: Se a criação da pendência falhar, reverte o status da operação
                await base44.entities.Operation.update(operationId, { status: 'completed' });
                throw new Error(`Erro ao criar pendência: ${pendencyError.message}`);
            }
        } catch (opError: any) {
            throw new Error(`Erro ao reativar operação: ${opError.message}`);
        }
    }

    async listMyPendencies(userId: string): Promise<OperationPendency[]> {
        try {
            const data = await base44.entities.OperationPendency.filter({ assigned_to_id: userId, status: 'pending' });
            return data as OperationPendency[];
        } catch (error) {
            console.error("Erro ao buscar pendências:", error);
            return [];
        }
    }

    async resolvePendency(pendencyId: string, notes: string): Promise<OperationPendency> {
        try {
            const data = await base44.entities.OperationPendency.update(pendencyId, {
                status: 'resolved',
                resolution_notes: notes,
                resolved_at: new Date().toISOString(),
            });
            return data as OperationPendency;
        } catch (error: any) {
            throw new Error(`Erro ao resolver pendência: ${error.message}`);
        }
    }
}

export const pendencyService = new PendencyService();
