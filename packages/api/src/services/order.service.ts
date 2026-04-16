import { UserRole, OrderStatus } from '@dineflow/prisma';
import { prisma } from '../db/prisma';

const TRANSITIONS: Record<string, string[]> = {
  NEW: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'READY', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export async function transitionOrderStatus(payload: {
  orderId: string;
  tenantId: string;
  expectedVersion: number;
  newStatus: OrderStatus;
  actorId: string;
  actorType: 'USER' | 'CUSTOMER' | 'SYSTEM';
  deviceId?: string;
  reasonCode?: string;
  metadata?: any;
  statusPatch?: {
    acceptedAt?: Date | null;
    preparingAt?: Date | null;
    readyAt?: Date | null;
    servedAt?: Date | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
    cancellationReason?: string | null;
  };
}) {
  return await prisma.$transaction(async (tx) => {
    const currentOrder = await tx.order.findFirst({
      where: {
        id: payload.orderId,
        tenantId: payload.tenantId,
      },
    });

    if (!currentOrder) {
      throw new Error('ORDER_NOT_FOUND');
    }

    if (!TRANSITIONS[currentOrder.status]?.includes(payload.newStatus)) {
      throw new Error(`INVALID_TRANSITION: Cannot transition from ${currentOrder.status} to ${payload.newStatus}`);
    }

    let updatedOrder;
    try {
      const statusPatch = payload.statusPatch || {};
      updatedOrder = await tx.order.update({
        where: { 
          id: payload.orderId, 
          // Enforce OCC by requiring exact version match
          version: payload.expectedVersion 
        },
        data: { 
          status: payload.newStatus, 
          version: { increment: 1 },
          acceptedAt: statusPatch.acceptedAt,
          preparingAt: statusPatch.preparingAt,
          readyAt: statusPatch.readyAt,
          servedAt: statusPatch.servedAt,
          completedAt: statusPatch.completedAt,
          cancelledAt: statusPatch.cancelledAt,
          cancellationReason: statusPatch.cancellationReason,
        },
        select: {
          id: true,
          status: true,
          version: true,
          tenantId: true,
          diningSessionId: true,
          orderNumber: true,
          orderType: true,
          customerName: true,
          customerPhone: true,
          createdAt: true,
          updatedAt: true,
          acceptedAt: true,
          preparingAt: true,
          readyAt: true,
          servedAt: true,
          completedAt: true,
          cancelledAt: true,
          cancellationReason: true,
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              totalPrice: true,
              specialNote: true,
              selectedModifiers: true,
            }
          },
          table: {
            select: { 
              id: true, 
              name: true, 
              zone: { select: { id: true, name: true } } 
            }
          },
          diningSession: {
            select: { 
              id: true, 
              sessionStatus: true
            }
          }
        }
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new ConflictError('OCC_COLLISION');
      }
      throw error;
    }

    await tx.orderAuditLog.create({
      data: {
        tenantId: payload.tenantId,
        orderId: payload.orderId,
        previousStatus: currentOrder.status,
        newStatus: payload.newStatus as any,
        actorType: payload.actorType as any,
        actorId: payload.actorId,
        deviceId: payload.deviceId,
        reasonCode: payload.reasonCode,
        metadata: payload.metadata ? JSON.parse(JSON.stringify(payload.metadata)) : undefined
      }
    });

    return updatedOrder;
  });
}
