"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.resetForgotPassword = exports.getForgotPasswordQuestion = exports.changeFirstPassword = exports.login = exports.clerkSync = exports.register = void 0;
const prisma_1 = require("@dineflow/prisma");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const prisma_2 = require("../db/prisma");
const hash_1 = require("../utils/hash");
const jwt_1 = require("../utils/jwt");
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().trim().min(1).max(80).optional(),
});
const loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(1).optional(),
    email: zod_1.z.string().trim().min(1).optional(), // backward compatibility
    password: zod_1.z.string().min(1),
});
const clerkSyncSchema = zod_1.z.object({
    clerkUserId: zod_1.z.string().trim().min(1),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().trim().min(1).max(80).optional(),
    tenantName: zod_1.z.string().trim().min(2).max(120).optional(),
    gstin: zod_1.z.string().trim().min(8).max(20).optional(),
    businessPhone: zod_1.z.string().trim().min(7).max(20).optional(),
    password: zod_1.z.string().min(6).optional(),
    authProvider: zod_1.z.enum(['EMAIL', 'GOOGLE']).optional(),
    intent: zod_1.z.enum(['LOGIN', 'SIGNUP']).optional(),
});
const firstPasswordChangeSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().optional(),
    newPassword: zod_1.z.string().min(8),
    username: zod_1.z.string().trim().min(3).max(80).optional(),
    securityQuestion: zod_1.z.string().trim().min(6).max(160),
    securityAnswer: zod_1.z.string().trim().min(2).max(120),
});
const forgotQuestionSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(1),
});
const forgotResetSchema = zod_1.z.object({
    identifier: zod_1.z.string().trim().min(1),
    securityAnswer: zod_1.z.string().trim().min(2).max(120),
    newPassword: zod_1.z.string().min(8),
});
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function normalizeIdentifier(identifier) {
    return identifier.trim().toLowerCase();
}
function normalizeEmployeeCode(code) {
    return code.trim().toUpperCase();
}
function sanitizeTenantHandle(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function normalizeTenantScopedUsername(raw, tenantSlug) {
    const handlePart = raw.trim().toLowerCase().includes('@') ? raw.trim().toLowerCase().split('@')[0] : raw.trim().toLowerCase();
    const handle = sanitizeTenantHandle(handlePart) || 'staff';
    const slug = sanitizeTenantHandle(tenantSlug) || 'restaurant';
    return `${handle}@${slug}.restoflow`;
}
function issueRefreshCookie(res, refreshToken) {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
}
async function issueSessionForUser(res, user) {
    const tokens = (0, jwt_1.generateTokens)({
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
    });
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
    await prisma_2.prisma.refreshToken.create({
        data: {
            userId: user.id,
            token: tokens.refreshToken,
            expiresAt,
        },
    });
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
        },
    };
}
async function buildUniqueTenantSlug(tenantName) {
    const base = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'restaurant';
    const initial = await prisma_2.prisma.tenant.findUnique({ where: { slug: base }, select: { id: true } });
    if (!initial)
        return base;
    let attempt = 2;
    while (attempt < 10000) {
        const candidate = `${base}-${attempt}`;
        const existing = await prisma_2.prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
        if (!existing)
            return candidate;
        attempt += 1;
    }
    return `${base}-${Date.now()}`;
}
function buildProvisionalWorkspaceName(ownerName) {
    const trimmed = ownerName?.trim();
    if (!trimmed)
        return 'New Workspace';
    const firstName = trimmed.split(/\s+/)[0];
    return `${firstName}'s Workspace`;
}
const register = async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const normalizedEmail = normalizeEmail(validatedData.email);
        const existingUser = await prisma_2.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true },
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const hashedPassword = await (0, hash_1.hashPassword)(validatedData.password);
        const provisionalName = buildProvisionalWorkspaceName(validatedData.name);
        const slug = await buildUniqueTenantSlug('workspace');
        const result = await prisma_2.prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    businessName: provisionalName,
                    slug,
                    email: normalizedEmail,
                },
            });
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    passwordHash: hashedPassword,
                    name: validatedData.name || 'Owner',
                    role: prisma_1.UserRole.OWNER,
                    tenantId: tenant.id,
                    mustChangePassword: false,
                },
            });
            return { user, tenant };
        });
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
const clerkSync = async (req, res) => {
    try {
        const payload = clerkSyncSchema.parse(req.body);
        const normalizedEmail = normalizeEmail(payload.email);
        const normalizedProvider = payload.authProvider === 'GOOGLE' ? 'GOOGLE' : 'EMAIL';
        const normalizedIntent = payload.intent === 'LOGIN' ? 'LOGIN' : 'SIGNUP';
        const existingByClerk = await prisma_2.prisma.user.findFirst({
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
            },
        });
        if (existingByClerk) {
            const session = await issueSessionForUser(res, existingByClerk);
            return res.json({ ...session, synced: true, created: false, linked: false });
        }
        const existingByEmail = await prisma_2.prisma.user.findUnique({
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
                clerkUserId: true,
            },
        });
        if (existingByEmail) {
            if (existingByEmail.clerkUserId && existingByEmail.clerkUserId !== payload.clerkUserId) {
                return res.status(409).json({
                    error: 'This email is already linked with another Clerk account. Please use your existing login method.',
                });
            }
            const linkedUser = existingByEmail.clerkUserId === payload.clerkUserId
                ? existingByEmail
                : await prisma_2.prisma.user.update({
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
                    },
                });
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
        const localPassword = payload.password ||
            `${normalizedProvider.toLowerCase()}_${(0, crypto_1.randomBytes)(24).toString('base64url')}`;
        const hashedPassword = await (0, hash_1.hashPassword)(localPassword);
        const tenantSlug = await buildUniqueTenantSlug('workspace');
        const provisionalBusinessName = buildProvisionalWorkspaceName(resolvedName);
        const created = await prisma_2.prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    businessName: provisionalBusinessName,
                    slug: tenantSlug,
                    email: normalizedEmail,
                },
            });
            const user = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: normalizedEmail,
                    name: resolvedName,
                    passwordHash: hashedPassword,
                    role: prisma_1.UserRole.OWNER,
                    clerkUserId: payload.clerkUserId,
                    mustChangePassword: normalizedProvider === 'GOOGLE',
                },
            });
            return { user, tenant };
        });
        const session = await issueSessionForUser(res, {
            id: created.user.id,
            tenantId: created.user.tenantId,
            role: created.user.role,
            email: created.user.email,
            name: created.user.name,
            employeeCode: created.user.employeeCode,
            mustChangePassword: created.user.mustChangePassword,
            securityQuestion: created.user.securityQuestion,
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
    }
    catch (error) {
        const code = typeof error?.code === 'string' ? error.code : '';
        const message = error instanceof Error ? error.message : '';
        if (code === 'P2002') {
            return res.status(409).json({
                error: 'Account already exists with same unique credentials. Please login instead.',
            });
        }
        if (message.includes("Can't reach database server") ||
            message.includes('Server has closed the connection') ||
            code === 'P1001' ||
            code === 'P1017') {
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
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Clerk sync error:', error);
        return res.status(500).json({ error: 'Failed to sync Clerk account' });
    }
};
exports.clerkSync = clerkSync;
const login = async (req, res) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const rawIdentifier = validatedData.identifier || validatedData.email;
        if (!rawIdentifier) {
            return res.status(400).json({ error: 'Email or Employee ID is required' });
        }
        const normalized = normalizeIdentifier(rawIdentifier);
        const normalizedEmployeeCode = normalizeEmployeeCode(rawIdentifier);
        const user = await prisma_2.prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalized },
                    { employeeCode: normalizedEmployeeCode },
                ],
            },
        });
        if (!user) {
            return res.status(401).json({ error: 'User not found. Please create an account first from the signup page.' });
        }
        const isPasswordValid = await (0, hash_1.verifyPassword)(validatedData.password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        await prisma_2.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const session = await issueSessionForUser(res, {
            id: user.id,
            tenantId: user.tenantId,
            role: user.role,
            email: user.email,
            name: user.name,
            employeeCode: user.employeeCode,
            mustChangePassword: user.mustChangePassword,
            securityQuestion: user.securityQuestion,
        });
        return res.json(session);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
            });
        }
        console.error('[LOGIN_ERROR_DEBUG]:', error);
        return res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
};
exports.login = login;
const changeFirstPassword = async (req, res) => {
    try {
        const body = firstPasswordChangeSchema.parse(req.body);
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await prisma_2.prisma.user.findUnique({
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
            const validCurrent = await (0, hash_1.verifyPassword)(currentPassword, user.passwordHash);
            if (!validCurrent) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
        }
        const isSamePassword = await (0, hash_1.verifyPassword)(body.newPassword, user.passwordHash);
        if (isSamePassword) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }
        const [newPasswordHash, securityAnswerHash] = await Promise.all([
            (0, hash_1.hashPassword)(body.newPassword),
            (0, hash_1.hashPassword)(body.securityAnswer.trim().toLowerCase()),
        ]);
        const updatePayload = {
            passwordHash: newPasswordHash,
            mustChangePassword: false,
            securityQuestion: body.securityQuestion,
            securityAnswerHash,
        };
        if (body.username?.trim()) {
            const nextEmail = normalizeTenantScopedUsername(body.username, user.tenant.slug);
            const existing = await prisma_2.prisma.user.findFirst({
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
        await prisma_2.prisma.user.update({
            where: { id: user.id },
            data: updatePayload,
        });
        return res.json({ success: true, message: 'Password changed successfully' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Change first password error:', error);
        return res.status(500).json({ error: 'Failed to change password' });
    }
};
exports.changeFirstPassword = changeFirstPassword;
const getForgotPasswordQuestion = async (req, res) => {
    try {
        const body = forgotQuestionSchema.parse(req.body);
        const normalized = normalizeIdentifier(body.identifier);
        const normalizedEmployeeCode = normalizeEmployeeCode(body.identifier);
        const user = await prisma_2.prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalized },
                    { employeeCode: normalizedEmployeeCode },
                ],
            },
            select: { securityQuestion: true, mustChangePassword: true },
        });
        if (!user) {
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Get forgot password question error:', error);
        return res.status(500).json({ error: 'Failed to fetch security question' });
    }
};
exports.getForgotPasswordQuestion = getForgotPasswordQuestion;
const resetForgotPassword = async (req, res) => {
    try {
        const body = forgotResetSchema.parse(req.body);
        const normalized = normalizeIdentifier(body.identifier);
        const normalizedEmployeeCode = normalizeEmployeeCode(body.identifier);
        const user = await prisma_2.prisma.user.findFirst({
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
            return res.status(400).json({ error: 'Unable to reset password for this account' });
        }
        const answerMatches = await (0, hash_1.verifyPassword)(body.securityAnswer.toLowerCase(), user.securityAnswerHash);
        if (!answerMatches) {
            return res.status(400).json({ error: 'Security answer is incorrect' });
        }
        const isSamePassword = await (0, hash_1.verifyPassword)(body.newPassword, user.passwordHash);
        if (isSamePassword) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }
        const newPasswordHash = await (0, hash_1.hashPassword)(body.newPassword);
        await prisma_2.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
                mustChangePassword: false,
            },
        });
        return res.json({ success: true, message: 'Password reset successful' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        console.error('Reset forgot password error:', error);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
};
exports.resetForgotPassword = resetForgotPassword;
const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }
        const decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const dbToken = await prisma_2.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!dbToken || dbToken.user.id !== decoded.id || new Date() > dbToken.expiresAt) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        const tokens = (0, jwt_1.generateTokens)({
            id: dbToken.user.id,
            tenantId: dbToken.user.tenantId,
            role: dbToken.user.role,
        });
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
        await prisma_2.prisma.refreshToken.delete({ where: { id: dbToken.id } });
        await prisma_2.prisma.refreshToken.create({
            data: {
                userId: dbToken.user.id,
                token: tokens.refreshToken,
                expiresAt,
            },
        });
        issueRefreshCookie(res, tokens.refreshToken);
        return res.json({ accessToken: tokens.accessToken });
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            await prisma_2.prisma.refreshToken.deleteMany({
                where: { token: refreshToken },
            });
        }
    }
    catch (error) {
        console.error('Logout error:', error);
    }
    finally {
        res.clearCookie('refreshToken');
        return res.json({ success: true, message: 'Logged out successfully' });
    }
};
exports.logout = logout;
//# sourceMappingURL=auth.controller.js.map