import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { MembershipRole, MembershipStatus } from '@prisma/client';

export interface BusinessMembershipContext {
  membershipId: string;
  businessId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
}

declare global {
  namespace Express {
    interface Request {
      membership?: BusinessMembershipContext;
    }
  }
}

/**
 * Resolves and validates the authenticated user's active membership in the business.
 * Strictly adheres to AUTHZ-001, AUTHZ-002, AUTHZ-003, and TEAM-003:
 * - Identifies server-side user identity.
 * - Scopes by businessId to prevent cross-business access.
 * - Enforces that only ACTIVE memberships can perform operations.
 */
export async function requireBusinessMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required.',
    });
    return;
  }

  const businessId = req.params.businessId || (req.body && req.body.businessId);

  if (!businessId || typeof businessId !== 'string') {
    res.status(400).json({
      error: 'BadRequest',
      message: 'A valid businessId parameter is required.',
    });
    return;
  }

  try {
    const membership = await prisma.membership.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      // AUTHZ-003: Cross-business isolation - do not leak information about other businesses
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this business.',
      });
      return;
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      // TEAM-003: Only active memberships may perform business operations
      res.status(403).json({
        error: 'Forbidden',
        message: 'Your membership in this business is currently inactive or suspended.',
      });
      return;
    }

    req.membership = {
      membershipId: membership.id,
      businessId: membership.businessId,
      userId: req.user.id,
      role: membership.role,
      status: membership.status,
    };

    next();
  } catch (err: any) {
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to verify business membership.',
    });
  }
}

/**
 * Enforces role-based permissions based on server-side membership data (AUTHZ-004).
 * Must be preceded by requireBusinessMember.
 */
export function requireBusinessRole(...allowedRoles: MembershipRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.membership) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Membership context missing. requireBusinessMember must precede requireBusinessRole.',
      });
      return;
    }

    if (!allowedRoles.includes(req.membership.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Your role (${req.membership.role}) does not have permission to perform this action. Required: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }

    next();
  };
}
