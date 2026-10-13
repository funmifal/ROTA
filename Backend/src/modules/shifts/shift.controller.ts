import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { ShiftStatus, MembershipRole } from '@prisma/client';

export class ShiftController {
  /**
   * Retrieves upcoming published shifts for the business and current user.
   * Scoped strictly by business membership (AUTHZ-002, AUTHZ-003).
   */
  static async getUpcomingShifts(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const now = new Date();

      // Retrieve shifts starting from now onwards (or active today)
      const shifts = await prisma.shift.findMany({
        where: {
          businessId: membership.businessId,
          status: ShiftStatus.PUBLISHED,
          endTime: {
            gte: now,
          },
        },
        include: {
          department: true,
          location: true,
          assignments: {
            include: {
              membership: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              swapRequests: {
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      // Format response with explicit assignment and swap status for the authenticated user
      const formattedShifts = shifts.map((shift) => {
        const myAssignment = shift.assignments.find(
          (a) => a.membershipId === membership.membershipId
        );
        const isAssignedToMe = Boolean(myAssignment);
        const activeSwap = myAssignment?.swapRequests.find(
          (s) => s.status === 'PENDING'
        );

        return {
          id: shift.id,
          businessId: shift.businessId,
          title: shift.title || 'General Shift',
          startTime: shift.startTime.toISOString(),
          endTime: shift.endTime.toISOString(),
          breakMinutes: shift.breakMinutes,
          status: shift.status,
          notes: shift.notes,
          department: shift.department?.name || null,
          location: shift.location?.name || null,
          isAssignedToMe,
          myAssignmentId: myAssignment?.id || null,
          assignedStaffCount: shift.assignments.length,
          swapStatus: activeSwap ? activeSwap.status : null,
          swapRequestId: activeSwap ? activeSwap.id : null,
          canRequestSwap: isAssignedToMe && !activeSwap && new Date(shift.startTime) > now,
        };
      });

      res.status(200).json({
        shifts: formattedShifts,
        serverTime: now.toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to fetch upcoming shifts: ' + err.message,
      });
    }
  }

  /**
   * Helper endpoint to seed realistic upcoming shifts for testing offline view and swaps.
   */
  static async seedUpcomingShifts(req: Request, res: Response): Promise<void> {
    try {
      const membership = req.membership!;
      const now = new Date();

      // Check if shifts already exist
      const existing = await prisma.shift.count({
        where: {
          businessId: membership.businessId,
          endTime: { gte: now },
        },
      });

      if (existing > 0) {
        res.status(200).json({
          message: 'Upcoming shifts already exist for this business.',
          count: existing,
        });
        return;
      }

      // Create 3 sample upcoming shifts
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(17, 0, 0, 0);

      const dayAfter = new Date(now);
      dayAfter.setDate(dayAfter.getDate() + 2);
      dayAfter.setHours(14, 0, 0, 0);
      const dayAfterEnd = new Date(dayAfter);
      dayAfterEnd.setHours(22, 0, 0, 0);

      const weekend = new Date(now);
      weekend.setDate(weekend.getDate() + 4);
      weekend.setHours(10, 0, 0, 0);
      const weekendEnd = new Date(weekend);
      weekendEnd.setHours(18, 0, 0, 0);

      const shiftConfigs = [
        {
          title: 'Morning Service Shift',
          startTime: tomorrow,
          endTime: tomorrowEnd,
          breakMinutes: 45,
          notes: 'Opening duties and morning rush preparation.',
        },
        {
          title: 'Evening Floor Supervision',
          startTime: dayAfter,
          endTime: dayAfterEnd,
          breakMinutes: 30,
          notes: 'Customer service and closing inventory review.',
        },
        {
          title: 'Weekend Peak Shift',
          startTime: weekend,
          endTime: weekendEnd,
          breakMinutes: 60,
          notes: 'Peak weekend service hours.',
        },
      ];

      for (const config of shiftConfigs) {
        const shift = await prisma.shift.create({
          data: {
            businessId: membership.businessId,
            title: config.title,
            startTime: config.startTime,
            endTime: config.endTime,
            breakMinutes: config.breakMinutes,
            notes: config.notes,
            status: ShiftStatus.PUBLISHED,
          },
        });

        // Assign to current user membership
        await prisma.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            membershipId: membership.membershipId,
          },
        });
      }

      // Record audit log
      await prisma.auditLog.create({
        data: {
          businessId: membership.businessId,
          userId: req.user!.id,
          action: 'SHIFTS_SEEDED',
          resource: 'Shift',
          metadata: { count: shiftConfigs.length },
        },
      });

      res.status(201).json({
        message: 'Successfully seeded 3 upcoming shifts assigned to your team profile.',
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to seed sample shifts: ' + err.message,
      });
    }
  }
}
