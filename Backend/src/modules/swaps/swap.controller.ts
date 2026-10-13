import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { SwapStatus, ShiftStatus } from '@prisma/client';

export class SwapController {
  /**
   * Requests a shift swap.
   * Adheres strictly to SWAP-001, AUTHZ-002, and AUDIT-001.
   */
  static async requestSwap(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const { shiftAssignmentId, reason, targetMembershipId } = req.body;

      if (!shiftAssignmentId || typeof shiftAssignmentId !== 'string') {
        res.status(400).json({
          error: 'BadRequest',
          message: 'shiftAssignmentId is required.',
        });
        return;
      }

      // Recheck the assignment in the database
      const assignment = await prisma.shiftAssignment.findUnique({
        where: { id: shiftAssignmentId },
        include: {
          shift: true,
          membership: true,
          swapRequests: {
            where: { status: SwapStatus.PENDING },
          },
        },
      });

      if (!assignment) {
        res.status(404).json({
          error: 'NotFound',
          message: 'Shift assignment not found.',
        });
        return;
      }

      // Check cross-business isolation
      if (assignment.shift.businessId !== membership.businessId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Assignment belongs to a different business.',
        });
        return;
      }

      // Check ownership: must be assigned to the requesting member
      if (assignment.membershipId !== membership.membershipId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only request swaps for your own assigned shifts.',
        });
        return;
      }

      const now = new Date();

      // SWAP-001: Shift has already started
      if (assignment.shift.startTime <= now) {
        res.status(400).json({
          error: 'InvalidSwapRequest',
          message: 'Cannot request a swap for a shift that has already started.',
        });
        return;
      }

      // SWAP-001: Shift is cancelled
      if (assignment.shift.status === ShiftStatus.CANCELLED) {
        res.status(400).json({
          error: 'InvalidSwapRequest',
          message: 'Cannot request a swap for a cancelled shift.',
        });
        return;
      }

      // SWAP-001: Another pending swap exists for the same assignment
      if (assignment.swapRequests.length > 0) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Another pending swap request already exists for this shift assignment.',
        });
        return;
      }

      // Verify target membership if provided (SWAP-002)
      if (targetMembershipId) {
        const targetMember = await prisma.membership.findFirst({
          where: {
            id: targetMembershipId,
            businessId: membership.businessId,
            status: 'ACTIVE',
          },
        });

        if (!targetMember) {
          res.status(400).json({
            error: 'InvalidTarget',
            message: 'Target staff member must be active in the same business.',
          });
          return;
        }

        if (targetMember.id === membership.membershipId) {
          res.status(400).json({
            error: 'InvalidTarget',
            message: 'Cannot swap a shift with yourself.',
          });
          return;
        }
      }

      // Create swap request and audit record inside transaction
      const swap = await prisma.$transaction(async (tx) => {
        const newSwap = await tx.swapRequest.create({
          data: {
            businessId: membership.businessId,
            shiftAssignmentId,
            requesterMembershipId: membership.membershipId,
            targetMembershipId: targetMembershipId || null,
            status: SwapStatus.PENDING,
            reason: reason ? String(reason).trim() : null,
          },
        });

        await tx.auditLog.create({
          data: {
            businessId: membership.businessId,
            userId: req.user!.id,
            action: 'SWAP_REQUESTED',
            resource: 'SwapRequest',
            resourceId: newSwap.id,
            metadata: {
              shiftId: assignment.shiftId,
              shiftAssignmentId,
              reason: reason || null,
            },
          },
        });

        return newSwap;
      });

      res.status(201).json({
        message: 'Shift swap request submitted successfully.',
        swapRequest: swap,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to submit swap request: ' + err.message,
      });
    }
  }

  /**
   * Retrieves all swap requests for the business.
   */
  static async getSwaps(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;

      const swaps = await prisma.swapRequest.findMany({
        where: { businessId: membership.businessId },
        include: {
          shiftAssignment: {
            include: {
              shift: true,
            },
          },
          requesterMembership: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          targetMembership: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ swaps });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch swaps: ' + err.message,
      });
    }
  }
}
