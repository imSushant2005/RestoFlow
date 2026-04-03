"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.login = exports.register = void 0;
const prisma_1 = require("../db/prisma");
const hash_1 = require("../utils/hash");
const jwt_1 = require("../utils/jwt");
const prisma_2 = require("@dineflow/prisma");
const zod_1 = require("zod");
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().optional(),
    tenantName: zod_1.z.string().min(2),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const register = async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const existingUser = await prisma_1.prisma.user.findFirst({
            where: { email: validatedData.email },
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const hashedPassword = await (0, hash_1.hashPassword)(validatedData.password);
        const slug = validatedData.tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    businessName: validatedData.tenantName,
                    slug: `${slug}-${Math.floor(Math.random() * 10000)}`,
                    email: validatedData.email,
                },
            });
            const user = await tx.user.create({
                data: {
                    email: validatedData.email,
                    passwordHash: hashedPassword,
                    name: validatedData.name || '',
                    role: prisma_2.UserRole.OWNER,
                    tenantId: tenant.id,
                },
            });
            return { user, tenant };
        });
        const tokens = (0, jwt_1.generateTokens)({
            id: result.user.id,
            tenantId: result.user.tenantId,
            role: result.user.role,
        });
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await prisma_1.prisma.refreshToken.create({
            data: {
                userId: result.user.id,
                token: tokens.refreshToken,
                expiresAt,
            },
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(201).json({
            accessToken: tokens.accessToken,
            user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name,
                role: result.user.role,
                tenantId: result.user.tenantId,
            },
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
const login = async (req, res) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findFirst({
            where: { email: validatedData.email },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isPasswordValid = await (0, hash_1.verifyPassword)(validatedData.password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const tokens = (0, jwt_1.generateTokens)({
            id: user.id,
            tenantId: user.tenantId,
            role: user.role,
        });
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma_1.prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: tokens.refreshToken,
                expiresAt,
            },
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.json({
            accessToken: tokens.accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.issues
            });
        }
        console.error('Login Error:', error);
        return res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
};
exports.login = login;
const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }
        const decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const dbToken = await prisma_1.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });
        if (!dbToken || dbToken.user.id !== decoded.id || new Date() > dbToken.expiresAt) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        const tokens = (0, jwt_1.generateTokens)({
            id: dbToken.user.id,
            tenantId: dbToken.user.tenantId,
            role: dbToken.user.role,
        });
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        // Replace the old token with the new one
        await prisma_1.prisma.refreshToken.delete({ where: { id: dbToken.id } });
        await prisma_1.prisma.refreshToken.create({
            data: {
                userId: dbToken.user.id,
                token: tokens.refreshToken,
                expiresAt,
            },
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
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
            await prisma_1.prisma.refreshToken.deleteMany({
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