import { Request, Response } from 'express';
import { UserRole } from '@bhojflow/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma, withPrismaRetry } from '../db/prisma';
import { deleteCache, withCache } from '../services/cache.service';
import { cacheKeys } from '../utils/cache-keys';
import { hashPassword, verifyPassword } from '../utils/hash';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import {
  clearFailedAuthAttempts,
  getRequestSecurityMeta,
  recordFailedAuthAttempt,
} from '../services/auth-security.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().trim().min(2).max(80).optional(),
  tenantName: z.string().trim().min(2).max(120).optional(),
});


const loginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(), // backward compatibility
  password: z.string().min(1),
});

const clerkSyncSchema = z.object({
  clerkUserId: z.string().trim().min(1),
  email: z.string().email(),
  name: z.string().trim().min(1).max(80).optional(),
  tenantName: z.string().trim().min(2).max(120).optional(),
  gstin: z.string().trim().min(8).max(20).optional(),
  businessPhone: z.string().trim().min(7).max(20).optional(),
  password: z.string().min(6).optional(),
  authProvider: z.enum(['EMAIL', 'GOOGLE']).optional(),
  intent: z.enum(['LOGIN', 'SIGNUP']).optional(),
});

const firstPasswordChangeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
  username: z.string().trim().min(3).max(80).optional(),
  securityQuestion: z.string().trim().min(6).max(160),
  securityAnswer: z.string().trim().min(2).max(120),
});

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().trim().url().max(500).nullable().optional(),
  preferredLanguage: z.enum(['en', 'hi', 'hinglish']).optional(),
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().trim().min(1),
    newPassword: z.string().min(8),
    securityQuestion: z.string().trim().min(6).max(160).optional(),
    securityAnswer: z.string().trim().min(2).max(120).optional(),
  })
  .superRefine((payload, ctx) => {
    const hasQuestion = Boolean(payload.securityQuestion?.trim());
    const hasAnswer = Boolean(payload.securityAnswer?.trim());
    if (hasQuestion !== hasAnswer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['securityQuestion'],
        message: 'Security question and answer must be updated together.',
      });
    }
  });

const forgotQuestionSchema = z.object({
  identifier: z.string().trim().min(1),
});

const forgotResetSchema = z.object({
  identifier: z.string().trim().min(1),
  securityAnswer: z.string().trim().min(2).max(120),
  newPassword: z.string().min(8),
});

const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: '/',
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function normalizeEmployeeCode(code: string) {
  return code.trim().toUpperCase();
}

function sanitizeTenantHandle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTenantScopedUsername(raw: string, tenantSlug: string) {
  const handlePart = raw.trim().toLowerCase().includes('@') ? raw.trim().toLowerCase().split('@')[0] : raw.trim().toLowerCase();
  const handle = sanitizeTenantHandle(handlePart) || 'staff';
  const slug = sanitizeTenantHandle(tenantSlug) || 'restaurant';
  return `${handle}@${slug}.BHOJFLOW`;
}

function issueRefreshCookie(res: Response, refreshToken: string) {
  res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
}

async function issueSessionForUser(res: Response, user: {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
  employeeCode: string | null;
  mustChangePassword: boolean;
  securityQuestion: string | null;
  preferredLanguage?: string | null;
}) {
  const tokens = generateTokens({
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
  await withPrismaRetry(
    () =>
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt,
        },
      }),
    `issue-session-refresh-token:${user.id}`,
  );

  issueRefreshCookie(res, tokens.refreshToken);

  return {
    accessToken: tokens.accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      employeeCode: user.employeeCode,
      mustChangePassword: user.mustChangePassword,
      hasSecurityQuestion: Boolean(user.securityQuestion),
      preferredLanguage: user.preferredLanguage || 'en',
    },
  };
}

function getSecuritySetupPending(user: {
  role: UserRole;
  mustChangePassword: boolean;
  securityQuestion: string | null;
}) {
  if (user.role === UserRole.OWNER) {
    return user.mustChangePassword || !user.securityQuestion;
  }

  return !user.securityQuestion;
}

async function buildTipSummaryForUser(userId: string) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Tips from Bills (Session-based)
  const [billSummary] = await withCache(
    cacheKeys.authTipSummary(userId), // We'll keep the same key but maybe clear it on bill payment too
    () =>
      prisma.$queryRaw<
        Array<{
          todayAmount: number | null;
          todayCount: number | null;
          weekAmount: number | null;
          monthAmount: number | null;
        }>
      >`
        SELECT
          COALESCE(SUM(b."tipAmount") FILTER (WHERE b."generatedAt" >= ${startOfToday}), 0)::float8 AS "todayAmount",
          COUNT(*) FILTER (WHERE b."generatedAt" >= ${startOfToday})::int AS "todayCount",
          COALESCE(SUM(b."tipAmount") FILTER (WHERE b."generatedAt" >= ${startOfWeek}), 0)::float8 AS "weekAmount",
          COALESCE(SUM(b."tipAmount") FILTER (WHERE b."generatedAt" >= ${startOfMonth}), 0)::float8 AS "monthAmount"
        FROM "Bill" b
        JOIN "DiningSession" ds ON b."sessionId" = ds.id
        WHERE ds."attendedByUserId" = ${userId}
          AND b."generatedAt" >= ${startOfMonth}
      `,
    30,
  );

  // Tips from Reviews (Legacy or Direct Feedback based)
  const [reviewSummary] = await withPrismaRetry(
    () =>
      prisma.$queryRaw<Array<{ todayReviewTips: number | null }>>`
        SELECT COALESCE(SUM("tipAmount") FILTER (WHERE "createdAt" >= ${startOfToday}), 0)::float8 AS "todayReviewTips"
        FROM "Review"
        WHERE "serviceStaffUserId" = ${userId} AND "createdAt" >= ${startOfToday}
      `,
    'auth-review-tips-lookup'
  );

  return {
    today: {
      amount: Number(billSummary?.todayAmount || 0) + Number(reviewSummary?.todayReviewTips || 0),
      sessions: Number(billSummary?.todayCount || 0),
    },
    week: {
      amount: Number(billSummary?.weekAmount || 0),
    },
    month: {
      amount: Number(billSummary?.monthAmount || 0),
    },
  };
}

async function invalidateAuthMeCache(userId: string, tenantId: string) {
  await Promise.all([
    deleteCache(cacheKeys.authMeUser(userId)),
    deleteCache(cacheKeys.authTenantBrief(tenantId)),
    deleteCache(cacheKeys.authTipSummary(userId)),
  ]);
}

async function buildUniqueTenantSlug(tenantName: string) {
  const base = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'restaurant';
  const initial = await withPrismaRetry(
    () => prisma.tenant.findUnique({ where: { slug: base }, select: { id: true } }),
    `tenant-slug:${base}`,
  );
  if (!initial) return base;

  let attempt = 2;
  while (attempt < 10000) {
    const candidate = `${base}-${attempt}`;
    const existing = await withPrismaRetry(
      () => prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } }),
      `tenant-slug:${candidate}`,
    );
    if (!existing) return candidate;
    attempt += 1;
  }

  return `${base}-${Date.now()}`;
}

function buildProvisionalWorkspaceName(ownerName?: string) {
  const trimmed = ownerName?.trim();
  if (!trimmed) return 'New Workspace';
  const firstName = trimmed.split(/\s+/)[0];
  return `${firstName}'s Workspace`;
}

export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(validatedData.email);

    const existingUser = await withPrismaRetry(
      () =>
        prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        }),
      `register-existing-user:${normalizedEmail}`,
    );

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await hashPassword(validatedData.password);
    const resolvedName = validatedData.name || 'Owner';
    const finalTenantName = validatedData.tenantName?.trim() || buildProvisionalWorkspaceName(resolvedName);
    const slug = await buildUniqueTenantSlug(validatedData.tenantName || 'workspace');

    const result = await withPrismaRetry(
      () =>
        prisma.$transaction(async (tx: any) => {
          const tenant = await tx.tenant.create({
            data: {
              businessName: finalTenantName,
              slug,
              email: normalizedEmail,
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day free trial on signup
              plan: 'MINI',
              planStartedAt: new Date(),
            },
          });

          const user = await tx.user.create({
            data: {
              email: normalizedEmail,
              passwordHash: hashedPassword,
              name: resolvedName,
              role: UserRole.OWNER,
              tenantId: tenant.id,
              mustChangePassword: false,
            },
          });

          return { user, tenant };
        }),
      `register-create:${normalizedEmail}`,
    );

    const session = await issueSessionForUser(res, {
      id: result.user.id,
      tenantId: result.user.tenantId,
      role: result.user.role,
      email: result.user.email,
      name: result.user.name,
      employeeCode: result.user.employeeCode,
      mustChangePassword: result.user.mustChangePassword,
      securityQuestion: result.user.securityQuestion,
    });

    return res.status(201).json({
      ...session,
      tenant: result.tenant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const clerkSync = async (req: Request, res: Response) => {
  try {
    const payload = clerkSyncSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(payload.email);
    const normalizedProvider = payload.authProvider === 'GOOGLE' ? 'GOOGLE' : 'EMAIL';
    const normalizedIntent = payload.intent === 'LOGIN' ? 'LOGIN' : 'SIGNUP';

    const existingByClerk = await withPrismaRetry(
      () =>
        prisma.user.findFirst({
          where: { clerkUserId: payload.clerkUserId },
          select: {
            id: true,
            tenantId: true,
            role: true,
            email: true,
            name: true,
            employeeCode: true,
            mustChangePassword: true,
            securityQuestion: true,
            preferredLanguage: true,
          },
        }),
      `clerk-sync-user:${payload.clerkUserId}`,
    );

    if (existingByClerk) {
      const session = await issueSessionForUser(res, existingByClerk);
      return res.json({ ...session, synced: true, created: false, linked: false });
    }

    const existingByEmail = await withPrismaRetry(
      () =>
        prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            tenantId: true,
            role: true,
            email: true,
            name: true,
            employeeCode: true,
            mustChangePassword: true,
            securityQuestion: true,
            preferredLanguage: true,
            clerkUserId: true,
          },
        }),
      `clerk-sync-email:${normalizedEmail}`,
    );

    if (existingByEmail) {
      if (existingByEmail.clerkUserId && existingByEmail.clerkUserId !== payload.clerkUserId) {
        return res.status(409).json({
          error: 'This email is already linked with another Clerk account. Please use your existing login method.',
        });
      }

      const linkedUser =
        existingByEmail.clerkUserId === payload.clerkUserId
          ? existingByEmail
          : await withPrismaRetry(
              () =>
                prisma.user.update({
                  where: { id: existingByEmail.id },
                  data: { clerkUserId: payload.clerkUserId },
                  select: {
                    id: true,
                    tenantId: true,
                    role: true,
                    email: true,
                    name: true,
                    employeeCode: true,
                    mustChangePassword: true,
                    securityQuestion: true,
                    preferredLanguage: true,
                  },
                }),
              `clerk-sync-link:${existingByEmail.id}`,
            );

      const session = await issueSessionForUser(res, linkedUser);
      return res.json({ ...session, synced: true, created: false, linked: true });
    }

    if (normalizedIntent === 'LOGIN') {
      return res.status(404).json({
        error: 'User not found. Please create an account first from the signup page.',
      });
    }

    const baseName = payload.name?.trim();
    const fallbackName = normalizedEmail.split('@')[0] || 'Owner';
    const resolvedName = baseName && baseName.length > 0 ? baseName : fallbackName;
    const finalTenantName = payload.tenantName?.trim() || buildProvisionalWorkspaceName(resolvedName);
    const tenantSlug = await buildUniqueTenantSlug(payload.tenantName || 'workspace');
    
    const localPassword =
      payload.password ||
      `${normalizedProvider.toLowerCase()}_${randomBytes(24).toString('base64url')}`;
    const hashedPassword = await hashPassword(localPassword);

    const created = await withPrismaRetry(
      () =>
        prisma.$transaction(async (tx: any) => {
          const tenant = await tx.tenant.create({
            data: {
              businessName: finalTenantName,
              slug: tenantSlug,
              email: normalizedEmail,
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day free trial on signup
              plan: 'MINI',
              planStartedAt: new Date(),
            },
          });

          const user = await tx.user.create({
            data: {
              tenantId: tenant.id,
              email: normalizedEmail,
              name: resolvedName,
              passwordHash: hashedPassword,
              role: UserRole.OWNER,
              clerkUserId: payload.clerkUserId,
              mustChangePassword: normalizedProvider === 'GOOGLE',
            },
          });

          return { user, tenant };
        }),
      `clerk-sync-create:${normalizedEmail}`,
    );

    const session = await issueSessionForUser(res, {
      id: created.user.id,
      tenantId: created.user.tenantId,
      role: created.user.role,
      email: created.user.email,
      name: created.user.name,
      employeeCode: created.user.employeeCode,
      mustChangePassword: created.user.mustChangePassword,
      securityQuestion: created.user.securityQuestion,
      preferredLanguage: created.user.preferredLanguage,
    });

    return res.status(201).json({
      ...session,
      synced: true,
      created: true,
      linked: false,
      tenant: {
        id: created.tenant.id,
        slug: created.tenant.slug,
        businessName: created.tenant.businessName,
      },
    });
  } catch (error) {
    const code = typeof (error as any)?.code === 'string' ? (error as any).code : '';
    const message = error instanceof Error ? error.message : '';

    if (code === 'P2002') {
      return res.status(409).json({
        error: 'Account already exists with same unique credentials. Please login instead.',
      });
    }

    if (
      message.includes("Can't reach database server") ||
      message.includes('Server has closed the connection') ||
      code === 'P1001' ||
      code === 'P1017'
    ) {
      return res.status(503).json({
        error: 'Database connection unavailable. Please retry in a few seconds.',
      });
    }

    if (code === 'P2022') {
      console.error('[PRISMA_SYNC_DEBUG] Column/Table missing:', error);
      return res.status(500).json({
        error: 'Database schema is out of sync. Run Prisma migration/db push and try again.',
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Clerk sync error:', error);
    return res.status(500).json({ error: 'Failed to sync Clerk account' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const rawIdentifier = validatedData.identifier || validatedData.email;

    if (!rawIdentifier) {
      return res.status(400).json({ error: 'Email or Employee ID is required' });
    }

    const normalized = normalizeIdentifier(rawIdentifier);
    const normalizedEmployeeCode = normalizeEmployeeCode(rawIdentifier);
    const loginUserSelect = {
      id: true,
      tenantId: true,
      role: true,
      email: true,
      name: true,
      employeeCode: true,
      mustChangePassword: true,
      securityQuestion: true,
      preferredLanguage: true,
      passwordHash: true,
    } as const;
    const isEmailLogin = rawIdentifier.includes('@');

    let user = await withPrismaRetry(
      () =>
        isEmailLogin
          ? prisma.user.findUnique({
              where: { email: normalized },
              select: loginUserSelect,
            })
          : prisma.user.findFirst({
              where: { employeeCode: normalizedEmployeeCode },
              select: loginUserSelect,
            }),
      'login-user-lookup',
    );

    if (!user && !isEmailLogin) {
      user = await withPrismaRetry(
        () =>
          prisma.user.findUnique({
            where: { email: normalized },
            select: loginUserSelect,
          }),
        'login-user-email-fallback',
      );
    }

    if (!user) {
      await recordFailedAuthAttempt({
        req,
        scope: 'login',
        identifier: rawIdentifier,
        reason: 'user_not_found',
      });
      return res.status(401).json({ error: 'User not found. Please create an account first from the signup page.' });
    }

    const isPasswordValid = await verifyPassword(validatedData.password, user.passwordHash);
    if (!isPasswordValid) {
      await recordFailedAuthAttempt({
        req,
        scope: 'login',
        identifier: rawIdentifier,
        reason: 'invalid_password',
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await clearFailedAuthAttempts({
      req,
      scope: 'login',
      identifier: rawIdentifier,
    });

    // Optimization: Run non-critical update in background and parallelize session creation
    const [session] = await Promise.all([
      issueSessionForUser(res, {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
        employeeCode: user.employeeCode,
        mustChangePassword: user.mustChangePassword,
        securityQuestion: user.securityQuestion,
        preferredLanguage: user.preferredLanguage,
      }),
      withPrismaRetry(
        () =>
          prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }),
        `login-last-login:${user.id}`,
      ).catch(err => logger.warn({ err, userId: user.id }, 'Non-critical lastLoginAt update failed'))
    ]);

    logger.info(
      {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        ...getRequestSecurityMeta(req),
      },
      'User login succeeded',
    );

    return res.json(session);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues,
      });
    }
    logger.error({ err: error, ...getRequestSecurityMeta(req) }, 'Login failed unexpectedly');
    return res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
};

export const changeFirstPassword = async (req: Request, res: Response) => {
  try {
    const body = firstPasswordChangeSchema.parse(req.body);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== UserRole.OWNER) {
      return res.status(403).json({ error: 'First-login password flow is reserved for owner accounts.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        mustChangePassword: true,
        clerkUserId: true,
        tenant: {
          select: {
            slug: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentPassword = body.currentPassword?.trim();
    const canSkipCurrentPassword = Boolean(user.clerkUserId) && !currentPassword;

    if (!canSkipCurrentPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const validCurrent = await verifyPassword(currentPassword, user.passwordHash);
      if (!validCurrent) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const isSamePassword = await verifyPassword(body.newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const [newPasswordHash, securityAnswerHash] = await Promise.all([
      hashPassword(body.newPassword),
      hashPassword(body.securityAnswer.trim().toLowerCase()),
    ]);

    const updatePayload: Record<string, unknown> = {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      securityQuestion: body.securityQuestion,
      securityAnswerHash,
    };

    if (body.username?.trim()) {
      const nextEmail = normalizeTenantScopedUsername(body.username, user.tenant.slug);
      const existing = await prisma.user.findFirst({
        where: {
          email: nextEmail,
          id: { not: user.id },
        },
        select: { id: true },
      });
      if (existing) {
        return res.status(400).json({ error: 'Username is already in use. Try another username.' });
      }
      updatePayload.email = nextEmail;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updatePayload,
    });

    await invalidateAuthMeCache(user.id, req.tenantId!);

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Change first password error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const body = passwordChangeSchema.parse(req.body);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validCurrent = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!validCurrent) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const isSamePassword = await verifyPassword(body.newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const updateData: Record<string, unknown> = {
      passwordHash: await hashPassword(body.newPassword),
      mustChangePassword: false,
    };

    if (body.securityQuestion?.trim() && body.securityAnswer?.trim()) {
      updateData.securityQuestion = body.securityQuestion.trim();
      updateData.securityAnswerHash = await hashPassword(body.securityAnswer.trim().toLowerCase());
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });

    await invalidateAuthMeCache(req.user.id, req.tenantId!);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const payload = profileUpdateSchema.parse(req.body);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof payload.name === 'string' && payload.name.trim()) updateData.name = payload.name.trim();
    if (payload.avatarUrl !== undefined) updateData.avatarUrl = payload.avatarUrl || null;
    if (payload.preferredLanguage) updateData.preferredLanguage = payload.preferredLanguage;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No profile fields provided' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        employeeCode: true,
        preferredLanguage: true,
        avatarUrl: true,
        mustChangePassword: true,
        securityQuestion: true,
      },
    });

    await invalidateAuthMeCache(req.user.id, req.tenantId!);

    return res.json({
      success: true,
      user: {
        ...user,
        hasSecurityQuestion: Boolean(user.securityQuestion),
        securitySetupPending: getSecuritySetupPending(user),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id || !req.tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const tenantId = req.tenantId;
    const includeTips = String(req.query.includeTips || '').toLowerCase() === 'true';
    const user = await withCache(
      cacheKeys.authMeUser(userId),
      () =>
        withPrismaRetry(
          () =>
            prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                tenantId: true,
                employeeCode: true,
                mustChangePassword: true,
                securityQuestion: true,
                preferredLanguage: true,
                avatarUrl: true,
                isActive: true,
              },
            }),
          `auth-me-user:${userId}`,
        ),
      15,
    );

    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tenant = await withCache(
      cacheKeys.authTenantBrief(tenantId),
      () =>
        withPrismaRetry(
          () =>
            prisma.tenant.findUnique({
              where: { id: tenantId },
              select: {
                id: true,
                slug: true,
                businessName: true,
              },
            }),
          `auth-me-tenant:${tenantId}`,
        ),
      60,
    );

    const tipsSummary = includeTips ? await buildTipSummaryForUser(user.id) : undefined;

    return res.json({
      tenantId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        employeeCode: user.employeeCode,
        avatarUrl: user.avatarUrl,
        preferredLanguage: user.preferredLanguage || 'en',
        mustChangePassword: user.mustChangePassword,
        hasSecurityQuestion: Boolean(user.securityQuestion),
        securitySetupPending: getSecuritySetupPending(user),
        ...(includeTips ? { tipsSummary } : {}),
      },
      tenant,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const getForgotPasswordQuestion = async (req: Request, res: Response) => {
  try {
    const body = forgotQuestionSchema.parse(req.body);
    const normalized = normalizeIdentifier(body.identifier);
    const normalizedEmployeeCode = normalizeEmployeeCode(body.identifier);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized },
          { employeeCode: normalizedEmployeeCode },
        ],
      },
      select: { securityQuestion: true, mustChangePassword: true },
    });

    if (!user) {
      await recordFailedAuthAttempt({
        req,
        scope: 'forgot_password',
        identifier: body.identifier,
        reason: 'account_not_found',
      });
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!user.securityQuestion) {
      return res.status(400).json({
        error: 'Security question is not set for this account. Please contact your manager.',
      });
    }

    return res.json({
      securityQuestion: user.securityQuestion,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Get forgot password question error:', error);
    return res.status(500).json({ error: 'Failed to fetch security question' });
  }
};

export const resetForgotPassword = async (req: Request, res: Response) => {
  try {
    const body = forgotResetSchema.parse(req.body);
    const normalized = normalizeIdentifier(body.identifier);
    const normalizedEmployeeCode = normalizeEmployeeCode(body.identifier);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized },
          { employeeCode: normalizedEmployeeCode },
        ],
      },
      select: {
        id: true,
        passwordHash: true,
        securityAnswerHash: true,
      },
    });

    if (!user || !user.securityAnswerHash) {
      await recordFailedAuthAttempt({
        req,
        scope: 'forgot_password',
        identifier: body.identifier,
        reason: 'reset_not_allowed',
      });
      return res.status(400).json({ error: 'Unable to reset password for this account' });
    }

    const answerMatches = await verifyPassword(body.securityAnswer.toLowerCase(), user.securityAnswerHash);
    if (!answerMatches) {
      await recordFailedAuthAttempt({
        req,
        scope: 'forgot_password',
        identifier: body.identifier,
        reason: 'invalid_security_answer',
      });
      return res.status(400).json({ error: 'Security answer is incorrect' });
    }

    await clearFailedAuthAttempts({
      req,
      scope: 'forgot_password',
      identifier: body.identifier,
    });

    const isSamePassword = await verifyPassword(body.newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const newPasswordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    return res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Reset forgot password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      await recordFailedAuthAttempt({
        req,
        scope: 'refresh',
        identifier: 'missing_refresh_token',
        reason: 'missing_refresh_token',
      });
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!dbToken || dbToken.user.id !== decoded.id || new Date() > dbToken.expiresAt) {
      await recordFailedAuthAttempt({
        req,
        scope: 'refresh',
        identifier: decoded.email || decoded.id,
        reason: 'invalid_refresh_token',
      });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens({
      id: dbToken.user.id,
      tenantId: dbToken.user.tenantId,
      role: dbToken.user.role,
      email: dbToken.user.email,
    });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

    await prisma.refreshToken.delete({ where: { id: dbToken.id } });
    await prisma.refreshToken.create({
      data: {
        userId: dbToken.user.id,
        token: tokens.refreshToken,
        expiresAt,
      },
    });

    issueRefreshCookie(res, tokens.refreshToken);
    await clearFailedAuthAttempts({
      req,
      scope: 'refresh',
      identifier: dbToken.user.email || dbToken.user.id,
    });

    return res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    await recordFailedAuthAttempt({
      req,
      scope: 'refresh',
      identifier: 'refresh_exception',
      reason: 'refresh_exception',
    }).catch(() => undefined);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    res.clearCookie('refreshToken', {
      ...getRefreshCookieOptions(),
      maxAge: undefined,
    });
    return res.json({ success: true, message: 'Logged out successfully' });
  }
};
