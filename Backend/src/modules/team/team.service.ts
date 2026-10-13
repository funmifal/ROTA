import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../database/prisma';
import { MembershipRole, MembershipStatus, InvitationStatus } from '@prisma/client';
import { config } from '../../config/env';
import { EmailService } from '../../services/email.service';
import { AuthService } from '../auth/auth.service';
import { CreateInvitationInput, UpdateMemberInput } from './team.validation';

export class TeamService {
  /**
   * Lists all members of a business (active, suspended, and invited).
   */
  static async listMembers(businessId: string) {
    const members = await prisma.membership.findMany({
      where: {
        businessId,
        status: {
          not: MembershipStatus.REMOVED,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            emailVerifiedAt: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return members.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      status: m.status,
      joinedAt: m.createdAt,
      emailVerified: !!m.user.emailVerifiedAt,
    }));
  }

  /**
   * Creates an invitation for a new team member.
   * Enforces:
   * - AUTHZ-006: Managers cannot invite Managers; only Owners can invite Managers.
   * - TEAM-004: Prevent duplicate active invitations for the same user and business.
   * - Scoping to the authorized business (AUTHZ-003).
   */
  static async createInvitation(
    businessId: string,
    inviterUserId: string,
    inviterRole: MembershipRole,
    input: CreateInvitationInput
  ) {
    // AUTHZ-006: Only Owners may invite Managers
    if (input.role === MembershipRole.MANAGER && inviterRole !== MembershipRole.OWNER) {
      throw new Error('Only business Owners have permission to invite Managers.');
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new Error('Business not found.');
    }

    const inviter = await prisma.user.findUnique({
      where: { id: inviterUserId },
    });

    if (!inviter) {
      throw new Error('Inviting user not found.');
    }

    // Check if recipient is already an active member
    const existingActiveMember = await prisma.membership.findFirst({
      where: {
        businessId,
        user: { email: input.email },
        status: MembershipStatus.ACTIVE,
      },
    });

    if (existingActiveMember) {
      throw new Error('A user with this email address is already an active member of this business.');
    }

    // TEAM-004: Prevent duplicate active/pending invitations for same email & business
    const existingActiveInvite = await prisma.invitation.findFirst({
      where: {
        businessId,
        email: input.email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingActiveInvite) {
      throw new Error('An active invitation has already been sent to this email address.');
    }

    // Generate secure unique invitation token (7 days validity)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.$transaction(async (tx) => {
      const invite = await tx.invitation.create({
        data: {
          businessId,
          email: input.email,
          role: input.role,
          token,
          invitedById: inviterUserId,
          expiresAt,
          status: InvitationStatus.PENDING,
        },
      });

      // AUDIT-001: Audit invitation creation
      await tx.auditLog.create({
        data: {
          businessId,
          userId: inviterUserId,
          action: 'INVITATION_CREATED',
          resource: 'invitation',
          resourceId: invite.id,
          metadata: {
            invitedEmail: input.email,
            role: input.role,
          },
        },
      });

      return invite;
    });

    // Send invitation email in the background
    EmailService.sendInvitationEmail(
      input.email,
      inviter.name,
      business.name,
      input.role,
      token
    ).catch(() => {});

    const inviteUrl = `${config.appUrl}/invite/${token}`;

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
      inviteUrl,
    };
  }

  /**
   * Lists all pending invitations for a business.
   */
  static async listInvitations(businessId: string) {
    const invitations = await prisma.invitation.findMany({
      where: {
        businessId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedBy: inv.invitedBy.name,
      inviteUrl: `${config.appUrl}/invite/${inv.token}`,
    }));
  }

  /**
   * Revokes an existing invitation.
   */
  static async revokeInvitation(businessId: string, invitationId: string, userId: string) {
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        businessId,
      },
    });

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: 'INVITATION_REVOKED',
          resource: 'invitation',
          resourceId: invitationId,
          metadata: { email: invitation.email },
        },
      });

      return updated;
    });
  }

  /**
   * Public preview of invitation details by token.
   */
  static async getInvitationByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            industry: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new Error('Invalid or expired invitation token.');
    }

    const isExpired = invitation.expiresAt < new Date() || invitation.status !== InvitationStatus.PENDING;

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      businessName: invitation.business.name,
      businessIndustry: invitation.business.industry,
      invitedBy: invitation.invitedBy.name,
      status: invitation.status,
      isExpired,
    };
  }

  /**
   * Accepts an invitation and grants active business membership.
   */
  static async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { business: true },
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new Error('This invitation is no longer valid or has already been used.');
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new Error('This invitation has expired.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    return await prisma.$transaction(async (tx) => {
      // Create or reactivate active membership
      const membership = await tx.membership.upsert({
        where: {
          businessId_userId: {
            businessId: invitation.businessId,
            userId: user.id,
          },
        },
        create: {
          businessId: invitation.businessId,
          userId: user.id,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
      });

      // Mark invitation accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      // AUDIT-001: Audit member join
      await tx.auditLog.create({
        data: {
          businessId: invitation.businessId,
          userId: user.id,
          action: 'MEMBER_JOINED',
          resource: 'membership',
          resourceId: membership.id,
          metadata: {
            role: invitation.role,
            viaInvitationId: invitation.id,
          },
        },
      });

      return {
        businessId: invitation.businessId,
        businessName: invitation.business.name,
        role: membership.role,
        membershipId: membership.id,
      };
    });
  }

  /**
   * Allows an invited user who does not have an account to sign up and immediately land in the team.
   */
  static async signUpWithInvitation(token: string, input: { name: string; password: string }) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { business: true },
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new Error('This invitation is no longer valid or has already been used.');
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new Error('This invitation has expired.');
    }

    const normalizedEmail = invitation.email.toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new Error('An account with this email already exists. Please log in to accept the invitation.');
    }

    const passwordHash = await bcrypt.hash(input.password, config.bcryptSaltRounds);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: input.name.trim(),
          email: normalizedEmail,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });

      const membership = await tx.membership.create({
        data: {
          businessId: invitation.businessId,
          userId: newUser.id,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      await tx.auditLog.create({
        data: {
          businessId: invitation.businessId,
          userId: newUser.id,
          action: 'MEMBER_JOINED_VIA_SIGNUP',
          resource: 'membership',
          resourceId: membership.id,
          metadata: {
            role: invitation.role,
            viaInvitationId: invitation.id,
          },
        },
      });

      return { user: newUser, membership };
    });

    const authRes = await AuthService.login({ email: normalizedEmail, password: input.password });

    return {
      user: authRes.user,
      business: invitation.business,
      membership: result.membership,
      accessToken: authRes.accessToken,
      refreshToken: authRes.refreshToken,
      token: authRes.accessToken,
    };
  }

  /**
   * Updates an existing member's role or status. Restricted to OWNER (AUTHZ-007).
   */
  static async updateMember(
    businessId: string,
    targetMemberId: string,
    updaterUserId: string,
    input: UpdateMemberInput
  ) {
    const member = await prisma.membership.findFirst({
      where: {
        id: targetMemberId,
        businessId,
      },
    });

    if (!member) {
      throw new Error('Member not found in this business.');
    }

    if (member.role === MembershipRole.OWNER && member.userId === updaterUserId) {
      if (input.role && input.role !== MembershipRole.OWNER) {
        throw new Error('Owners cannot demote themselves. Ownership cannot be transferred in MVP.');
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: targetMemberId },
        data: input,
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId: updaterUserId,
          action: 'MEMBER_ROLE_CHANGED',
          resource: 'membership',
          resourceId: targetMemberId,
          metadata: input as any,
        },
      });

      return updated;
    });
  }

  /**
   * Removes a member from the business.
   * Enforces TEAM-005: marks membership status REMOVED rather than hard-deleting historical records.
   */
  static async removeMember(
    businessId: string,
    targetMemberId: string,
    removerUserId: string,
    removerRole: MembershipRole
  ) {
    const member = await prisma.membership.findFirst({
      where: {
        id: targetMemberId,
        businessId,
      },
    });

    if (!member) {
      throw new Error('Member not found.');
    }

    if (member.role === MembershipRole.OWNER) {
      throw new Error('The business Owner cannot be removed.');
    }

    // AUTHZ-006: Managers can only remove Staff, not other Managers or Owners
    if (removerRole === MembershipRole.MANAGER && member.role !== MembershipRole.STAFF) {
      throw new Error('Managers may only remove Staff members.');
    }

    return await prisma.$transaction(async (tx) => {
      // TEAM-005: Soft mark membership as REMOVED to protect historical data
      const updated = await tx.membership.update({
        where: { id: targetMemberId },
        data: { status: MembershipStatus.REMOVED },
      });

      // AUDIT-001: Audit member removal
      await tx.auditLog.create({
        data: {
          businessId,
          userId: removerUserId,
          action: 'MEMBER_REMOVED',
          resource: 'membership',
          resourceId: targetMemberId,
          metadata: {
            removedUserId: member.userId,
            previousRole: member.role,
          },
        },
      });

      return updated;
    });
  }
}
