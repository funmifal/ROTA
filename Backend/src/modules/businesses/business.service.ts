import { prisma } from '../../database/prisma';
import { MembershipRole, MembershipStatus } from '@prisma/client';
import { CreateBusinessInput, UpdateBusinessInput } from './business.validation';

export class BusinessService {
  /**
   * Creates a business and sets the creator as OWNER in an atomic transaction (TEAM-001, DATA-002).
   */
  static async createBusiness(userId: string, input: CreateBusinessInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    return await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: input.name,
          industry: input.industry,
          country: input.country,
          timezone: input.timezone || 'Africa/Lagos',
        },
      });

      // TEAM-001: The creating user becomes the Owner
      const membership = await tx.membership.create({
        data: {
          businessId: business.id,
          userId: user.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      // Create default General department
      await tx.department.create({
        data: {
          businessId: business.id,
          name: 'General',
        },
      });

      // Create default Main Location
      await tx.location.create({
        data: {
          businessId: business.id,
          name: 'Main Location',
        },
      });

      // AUDIT-001: Audit business creation
      await tx.auditLog.create({
        data: {
          businessId: business.id,
          userId: user.id,
          action: 'BUSINESS_CREATED',
          resource: 'business',
          resourceId: business.id,
          metadata: {
            name: business.name,
            timezone: business.timezone,
          },
        },
      });

      return {
        ...business,
        role: membership.role,
      };
    });
  }

  /**
   * Returns all active businesses the user belongs to (TEAM-002).
   */
  static async getUserBusinesses(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        business: {
          include: {
            _count: {
              select: {
                memberships: {
                  where: { status: MembershipStatus.ACTIVE },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((m) => ({
      ...m.business,
      memberCount: m.business._count.memberships,
      currentUserRole: m.role,
      currentMembershipStatus: m.status,
    }));
  }

  /**
   * Returns details for a specific business scoped to member access.
   */
  static async getBusinessById(businessId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        departments: true,
        locations: true,
        _count: {
          select: {
            memberships: { where: { status: MembershipStatus.ACTIVE } },
          },
        },
      },
    });

    if (!business) {
      throw new Error('Business not found.');
    }

    return business;
  }

  /**
   * Updates business details. Restricted to Owner (AUTHZ-007).
   */
  static async updateBusiness(businessId: string, userId: string, input: UpdateBusinessInput) {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.business.update({
        where: { id: businessId },
        data: input,
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'BUSINESS_UPDATED',
          resource: 'business',
          resourceId: businessId,
          metadata: input as any,
        },
      });

      return updated;
    });
  }
}
