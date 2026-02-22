import { base44 } from './base44Client';
import { Operation, OperationPendency, Pilot } from '../types';

class PendencyService {
    async createPendency(operationId: string, reopenedById: string, assignedToId: string, reason: string): Promise<OperationPendency> {
        // 1. Altera o status da operação para 'active'
        const { data: updatedOp, error: opError } = await base44.entities.Operation.update(operationId, { status: 'active' });
        if (opError) throw new Error(`Erro ao reativar operação: ${opError.message}`);

        // 2. Cria o registro de pendência
        const pendencyData = {
            operation_id: operationId,
            reopened_by_id: reopenedById,
            assigned_to_id: assignedToId,
            reason: reason,
            status: 'pending' as const,
        };
        const { data: newPendency, error: pendencyError } = await base44.entities.OperationPendency.create(pendencyData);
        if (pendencyError) {
            // Rollback: Se a criação da pendência falhar, reverte o status da operação
            await base44.entities.Operation.update(operationId, { status: 'completed' });
            throw new Error(`Erro ao criar pendência: ${pendencyError.message}`);
        }

        return newPendency as OperationPendency;
    }

    async listMyPendencies(userId: string): Promise<OperationPendency[]> {
        const { data, error } = await base44.entities.OperationPendency.filter({ assigned_to_id: userId, status: 'pending' }, '-created_at');
        if (error) {
            console.error("Erro ao buscar pendências:", error);
            return [];
        }
        return data as OperationPendency[];
    }

    async resolvePendency(pendencyId: string, notes: string): Promise<OperationPendency> {
        const { data, error } = await base44.entities.OperationPendency.update(pendencyId, {
            status: 'resolved',
            resolution_notes: notes,
            resolved_at: new Date().toISOString(),
        });
        if (error) throw new Error(`Erro ao resolver pendência: ${error.message}`);
        return data as OperationPendency;
    }
}

export const pendencyService = new PendencyService();
