"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStaff = exports.updateStaff = exports.createStaff = exports.getStaff = exports.completeBusinessOnboarding = exports.updateBusinessSettings = exports.getBusinessSlugAvailability = exports.getBusinessSettings = void 0;
const prisma_1 = require("../db/prisma");
const plans_1 = require("../config/plans");
const prisma_2 = require("@bhojflow/prisma");
const hash_1 = require("../utils/hash");
const zod_1 = require("zod");
const cache_service_1 = require("../services/cache.service");
const subscription_billing_service_1 = require("../services/subscription-billing.service");
const restaurantTypeValues = [
    'FINE_DINING',
    'CASUAL_DINING',
    'FAST_FOOD',
    'QSR',
    'CAFE',
    'BAKERY',
    'CLOUD_KITCHEN',
    'FOOD_TRUCK',
    'BAR_LOUNGE',
    'BUFFET',
    'FAMILY_RESTAURANT',
    'STREET_FOOD',
    'SWEET_SHOP',
    'MULTI_BRAND_KITCHEN',
    'OTHER',
];
const onboardingStatusValues = [
    'ACCOUNT_CREATED',
    'RESTAURANT_PROFILE',
    'RESTAURANT_TYPE',
    'COMPLETED',
];
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;
const createStaffSchema = zod_1.z
    .object({
    email: zod_1.z.string().trim().optional(),
    username: zod_1.z.string().trim().optional(),
    name: zod_1.z.string().trim().min(1).max(80),
    password: zod_1.z.string().min(8),
    role: zod_1.z.string(),
    employeeCode: zod_1.z
        .string()
        .trim()
        .min(3)
        .max(40)
        .regex(/^[A-Za-z0-9_-]+$/, 'Employee ID can only include letters, numbers, - and _')
        .optional(),
})
    .superRefine((payload, ctx) => {
    if (!payload.email && !payload.username) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Username is required',
            path: ['username'],
        });
    }
});
const updateStaffSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80).optional(),
    role: zod_1.z.string().optional(),
    email: zod_1.z.string().trim().optional(),
    username: zod_1.z.string().trim().optional(),
    employeeCode: zod_1.z
        .string()
        .trim()
        .min(3)
        .max(40)
        .regex(/^[A-Za-z0-9_-]+$/, 'Employee ID can only include letters, numbers, - and _')
        .optional(),
    password: zod_1.z.string().min(8).optional(),
});
const updateBusinessSettingsSchema = zod_1.z.object({
    businessName: zod_1.z.string().trim().min(1).max(120).optional(),
    slug: zod_1.z.string().trim().min(2).max(120).optional(),
    description: zod_1.z.string().trim().max(500).optional().nullable(),
    primaryColor: zod_1.z.string().trim().max(30).optional(),
    accentColor: zod_1.z.string().trim().max(30).optional(),
    currencySymbol: zod_1.z.string().trim().min(1).max(8).optional(),
    taxRate: zod_1.z.number().min(0).max(100).optional(),
    logoUrl: zod_1.z.string().trim().max(500).optional().nullable(),
    coverImageUrl: zod_1.z.string().trim().max(500).optional().nullable(),
    email: zod_1.z.string().trim().email().optional(),
    phone: zod_1.z.string().trim().min(7).max(20).optional(),
    upiId: zod_1.z
        .string()
        .trim()
        .regex(/^[a-z0-9.\-_]{2,}@[a-z][a-z0-9.-]{1,}$/i, 'Enter a valid UPI ID')
        .optional()
        .nullable(),
    restaurantType: zod_1.z.enum(restaurantTypeValues).optional().nullable(),
    businessType: zod_1.z.string().trim().max(80).optional().nullable(),
    hasWaiterService: zod_1.z.boolean().optional(),
    tableCount: zod_1.z.number().int().min(0).max(500).optional(),
    deliveryEnabled: zod_1.z.boolean().optional(),
    multiBranch: zod_1.z.boolean().optional(),
    gstin: zod_1.z.string().trim().min(8).max(20).optional(),
    businessHours: zod_1.z.unknown().optional(),
    onboardingStatus: zod_1.z.enum(onboardingStatusValues).optional(),
    workspaceConfig: zod_1.z.unknown().optional(),
    successChecklist: zod_1.z.unknown().optional(),
    isActive: zod_1.z.boolean().optional(),
    plan: zod_1.z.nativeEnum(prisma_2.Plan).optional(),
    trialEndsAt: zod_1.z.string().pipe(zod_1.z.coerce.date()).optional().nullable(),
});
const slugAvailabilitySchema = zod_1.z.object({
    slug: zod_1.z.string().trim().min(2).max(120),
});
const completeOnboardingSchema = zod_1.z.object({
    businessName: zod_1.z.string().trim().min(2).max(120),
    slug: zod_1.z.string().trim().min(2).max(120),
    restaurantType: zod_1.z.enum(restaurantTypeValues),
    phone: zod_1.z.string().trim().min(7).max(20),
    tableCount: zod_1.z.number().int().min(0).max(500),
    hasWaiterService: zod_1.z.boolean(),
    deliveryEnabled: zod_1.z.boolean(),
    multiBranch: zod_1.z.boolean(),
    gstin: zod_1.z.string().trim().min(8).max(20).optional().or(zod_1.z.literal('')),
    planId: zod_1.z.string().trim().min(1),
});
const baseBusinessSelect = {
    id: true,
    businessName: true,
    slug: true,
    email: true,
    phone: true,
    upiId: true,
    hasWaiterService: true,
    tableCount: true,
    deliveryEnabled: true,
    multiBranch: true,
    gstin: true,
    currencySymbol: true,
    taxRate: true,
    description: true,
    logoUrl: true,
    coverImageUrl: true,
    primaryColor: true,
    accentColor: true,
    businessHours: true,
    isActive: true,
    plan: true,
    trialStartedAt: true,
    trialEndsAt: true,
    trialStatus: true,
    restaurantType: true,
    businessType: true,
    onboardingStatus: true,
    onboardingCompletedAt: true,
    workspaceConfig: true,
    successChecklist: true,
};
function sanitizeSegment(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function normalizeLoginEmail(raw, tenantSlug) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed)
        return '';
    const handlePart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
    const handle = sanitizeSegment(handlePart) || 'staff';
    return `${handle}@${sanitizeSegment(tenantSlug) || 'restaurant'}.bhojflow`;
}
function defaultEmployeeCode(name, tenantSlug) {
    const tenantPrefix = sanitizeSegment(tenantSlug).slice(0, 4).toUpperCase() || 'REST';
    const namePrefix = sanitizeSegment(name).replace(/-/g, '').slice(0, 6).toUpperCase() || 'STAFF';
    return `${tenantPrefix}-${namePrefix}`;
}
function isEmailLike(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function normalizeGstin(value) {
    return value?.trim().toUpperCase() || '';
}
function normalizePhone(value) {
    return value?.trim() || '';
}
function normalizeSlug(value) {
    return sanitizeSegment(value || '');
}
async function buildAvailableSlugCandidate(baseSlug, excludeTenantId) {
    const base = normalizeSlug(baseSlug) || 'restaurant';
    let attempt = 0;
    while (attempt < 1000) {
        const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
        const existing = await prisma_1.prisma.tenant.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });
        if (!existing || existing.id === excludeTenantId) {
            return candidate;
        }
        attempt += 1;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
}
function mapRestaurantTypeToBusinessType(restaurantType) {
    switch (restaurantType) {
        case 'CAFE':
        case 'BAKERY':
            return 'cafe';
        case 'CLOUD_KITCHEN':
        case 'MULTI_BRAND_KITCHEN':
            return 'cloud_kitchen';
        case 'STREET_FOOD':
        case 'FOOD_TRUCK':
            return 'street_vendor';
        default:
            return 'restaurant';
    }
}
function buildWorkspacePreset(input) {
    const base = {
        qrOrdering: true,
        takeaway: false,
        compactKitchen: false,
        dineIn: input.tableCount > 0,
        tablesEnabled: input.tableCount > 0,
        deliveryEnabled: input.deliveryEnabled,
        kitchenPriority: false,
        waiterEnabled: input.hasWaiterService,
        reservationsReady: false,
        premiumBilling: false,
        counterMode: false,
        quickBilling: false,
        fastKitchen: false,
        sessionBilling: false,
        tableTurnoverMode: false,
        multiBrand: false,
        multiBranch: input.multiBranch,
    };
    switch (input.restaurantType) {
        case 'CAFE':
            return { ...base, takeaway: true, compactKitchen: true };
        case 'CLOUD_KITCHEN':
            return {
                ...base,
                qrOrdering: false,
                takeaway: true,
                dineIn: false,
                tablesEnabled: false,
                kitchenPriority: true,
                waiterEnabled: false,
                deliveryEnabled: true,
            };
        case 'FINE_DINING':
            return { ...base, waiterEnabled: true, reservationsReady: true, premiumBilling: true };
        case 'FAST_FOOD':
        case 'QSR':
            return { ...base, takeaway: true, counterMode: true, quickBilling: true, fastKitchen: true };
        case 'BUFFET':
            return { ...base, waiterEnabled: true, sessionBilling: true, tableTurnoverMode: true };
        case 'MULTI_BRAND_KITCHEN':
            return {
                ...base,
                qrOrdering: false,
                takeaway: true,
                dineIn: false,
                tablesEnabled: false,
                kitchenPriority: true,
                deliveryEnabled: true,
                multiBrand: true,
            };
        default:
            return base;
    }
}
async function ensureUniqueEmployeeCode(base, excludeUserId) {
    let candidate = base;
    let counter = 1;
    while (counter < 1000) {
        const existing = await prisma_1.prisma.user.findFirst({
            where: {
                employeeCode: candidate,
                ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
            },
            select: { id: true },
        });
        if (!existing)
            return candidate;
        counter += 1;
        candidate = `${base}-${counter}`;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
}
const getBusinessSettings = async (req, res) => {
    try {
        const tenant = await (0, cache_service_1.withCache)(`tenant:${req.tenantId}:business-settings`, () => (0, prisma_1.withPrismaRetry)(() => prisma_1.prisma.tenant.findUnique({
            where: { id: req.tenantId },
            select: baseBusinessSelect,
        }), `business-settings:${req.tenantId}`), 20);
        if (!tenant) {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        res.json({
            ...tenant,
            plan: (0, plans_1.normalizePlan)(tenant.plan),
            planLimits: (0, plans_1.getPlanLimits)(tenant.plan),
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};
exports.getBusinessSettings = getBusinessSettings;
const getBusinessSlugAvailability = async (req, res) => {
    try {
        const query = slugAvailabilitySchema.parse(req.query);
        const normalizedSlug = normalizeSlug(query.slug);
        if (!normalizedSlug || normalizedSlug.length < 2) {
            return res.status(400).json({ error: 'Slug must contain at least 2 letters or numbers.' });
        }
        const existing = await prisma_1.prisma.tenant.findUnique({
            where: { slug: normalizedSlug },
            select: { id: true },
        });
        if (!existing || existing.id === req.tenantId) {
            return res.json({ slug: normalizedSlug, available: true, suggestion: normalizedSlug });
        }
        const suggestion = await buildAvailableSlugCandidate(normalizedSlug, req.tenantId);
        return res.json({ slug: normalizedSlug, available: false, suggestion });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return res.status(500).json({ error: 'Unable to validate slug right now.' });
    }
};
exports.getBusinessSlugAvailability = getBusinessSlugAvailability;
const updateBusinessSettings = async (req, res) => {
    try {
        const payload = updateBusinessSettingsSchema.parse(req.body);
        const { businessName, slug, description, primaryColor, accentColor, currencySymbol, taxRate, logoUrl, coverImageUrl, email, phone, upiId, restaurantType, businessType, hasWaiterService, tableCount, deliveryEnabled, multiBranch, gstin, businessHours, onboardingStatus, workspaceConfig, successChecklist, isActive, plan, trialEndsAt, } = payload;
        const normalizedSlug = slug === undefined ? undefined : normalizeSlug(slug);
        const normalizedGstin = normalizeGstin(gstin);
        const normalizedPhone = normalizePhone(phone);
        const normalizedPlan = plan ? (0, plans_1.normalizePlan)(plan) : undefined;
        if (slug !== undefined && !normalizedSlug) {
            return res.status(400).json({ error: 'Workspace URL must contain letters or numbers.' });
        }
        if ((normalizedPlan !== undefined || trialEndsAt !== undefined) && req.user?.role !== prisma_2.UserRole.OWNER) {
            return res.status(403).json({
                error: 'Only the workspace owner can change plan or trial settings.',
            });
        }
        if (normalizedPlan !== undefined || trialEndsAt !== undefined) {
            return res.status(409).json({
                error: 'Plan and trial changes now go through the billing system so every subscription change is recorded safely.',
                code: 'BILLING_FLOW_REQUIRED',
            });
        }
        // Check if slug is taken by another tenant
        if (normalizedSlug) {
            const existing = await prisma_1.prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
            if (existing && existing.id !== req.tenantId) {
                return res.status(400).json({ error: 'Slug already taken' });
            }
        }
        if (normalizedGstin) {
            if (!GSTIN_PATTERN.test(normalizedGstin)) {
                return res.status(400).json({
                    error: 'GSTIN format looks incorrect. Double-check the number or leave it blank for now.',
                });
            }
            const existingTenant = await prisma_1.prisma.tenant.findFirst({
                where: {
                    gstin: normalizedGstin,
                    id: { not: req.tenantId },
                },
                select: { id: true, businessName: true },
            });
            if (existingTenant) {
                return res.status(409).json({
                    error: 'GST number already exists. Each workspace must use a unique GST number.',
                });
            }
        }
        if (normalizedPhone && !PHONE_PATTERN.test(normalizedPhone)) {
            return res.status(400).json({ error: 'Phone format looks incorrect.' });
        }
        const tenant = await prisma_1.prisma.tenant.update({
            where: { id: req.tenantId },
            data: {
                businessName,
                slug: normalizedSlug,
                description,
                primaryColor,
                accentColor,
                currencySymbol,
                taxRate,
                logoUrl,
                coverImageUrl,
                email,
                phone: phone === undefined ? undefined : normalizedPhone || null,
                upiId: upiId === undefined ? undefined : upiId?.trim() || null,
                restaurantType: restaurantType === undefined ? undefined : restaurantType || null,
                businessType: businessType === undefined ? undefined : businessType?.trim() || undefined,
                hasWaiterService,
                tableCount,
                deliveryEnabled,
                multiBranch,
                gstin: gstin === undefined ? undefined : normalizedGstin || null,
                businessHours: businessHours === undefined ? undefined : businessHours,
                onboardingStatus,
                workspaceConfig: workspaceConfig === undefined ? undefined : workspaceConfig,
                successChecklist: successChecklist === undefined ? undefined : successChecklist,
                isActive,
                plan: undefined,
                trialEndsAt: undefined,
                planStartedAt: undefined,
            },
            select: baseBusinessSelect,
        });
        await Promise.all([
            (0, cache_service_1.deleteCache)(`tenant:${req.tenantId}:business-settings`),
            (0, cache_service_1.deleteCache)(`tenant:${req.tenantId}:billing`),
            (0, cache_service_1.deleteCache)(normalizedSlug ? `public_menu_${normalizedSlug}` : `public_menu_${tenant.slug}`),
            (0, cache_service_1.deleteCache)(`public_menu_${tenant.slug}`),
        ]);
        res.json({
            ...tenant,
            plan: (0, plans_1.normalizePlan)(tenant.plan),
            planLimits: (0, plans_1.getPlanLimits)(tenant.plan),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
exports.updateBusinessSettings = updateBusinessSettings;
const completeBusinessOnboarding = async (req, res) => {
    try {
        const payload = completeOnboardingSchema.parse(req.body);
        const normalizedSlug = normalizeSlug(payload.slug);
        const normalizedGstin = normalizeGstin(payload.gstin);
        const normalizedPhone = normalizePhone(payload.phone);
        const normalizedPlan = (0, plans_1.parsePlan)(payload.planId);
        const restaurantType = payload.restaurantType;
        const forceKitchenOnly = restaurantType === 'CLOUD_KITCHEN' || restaurantType === 'MULTI_BRAND_KITCHEN';
        const effectiveTableCount = forceKitchenOnly ? 0 : payload.tableCount;
        const effectiveHasWaiterService = forceKitchenOnly ? false : payload.hasWaiterService;
        const effectiveDeliveryEnabled = forceKitchenOnly ? true : payload.deliveryEnabled;
        if (!normalizedPlan) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }
        if (!normalizedSlug || normalizedSlug.length < 2) {
            return res.status(400).json({ error: 'Workspace URL is required.' });
        }
        if (!PHONE_PATTERN.test(normalizedPhone)) {
            return res.status(400).json({ error: 'Phone format looks incorrect.' });
        }
        if (normalizedGstin && !GSTIN_PATTERN.test(normalizedGstin)) {
            return res.status(400).json({ error: 'GSTIN format looks incorrect. You can also skip it for now.' });
        }
        const slugSuggestion = await buildAvailableSlugCandidate(normalizedSlug, req.tenantId);
        if (slugSuggestion !== normalizedSlug) {
            return res.status(409).json({
                error: 'That workspace URL is already taken.',
                suggestion: slugSuggestion,
            });
        }
        const existingTenant = await prisma_1.prisma.tenant.findUnique({
            where: { id: req.tenantId },
            select: { slug: true, successChecklist: true },
        });
        if (!existingTenant) {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        const preset = buildWorkspacePreset({
            restaurantType,
            tableCount: effectiveTableCount,
            hasWaiterService: effectiveHasWaiterService,
            deliveryEnabled: effectiveDeliveryEnabled,
            multiBranch: payload.multiBranch,
        });
        const setupChecklist = existingTenant.successChecklist && typeof existingTenant.successChecklist === 'object'
            ? existingTenant.successChecklist
            : {
                addMenuItem: false,
                generateQr: false,
                createTestOrder: false,
                addStaffMember: false,
                openDashboard: false,
            };
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            if (normalizedGstin) {
                const duplicateGstin = await tx.tenant.findFirst({
                    where: {
                        gstin: normalizedGstin,
                        id: { not: req.tenantId },
                    },
                    select: { id: true },
                });
                if (duplicateGstin) {
                    throw new Error('GSTIN_ALREADY_EXISTS');
                }
            }
            await tx.tenant.update({
                where: { id: req.tenantId },
                data: {
                    businessName: payload.businessName.trim(),
                    slug: normalizedSlug,
                    phone: normalizedPhone,
                    gstin: normalizedGstin || null,
                    restaurantType,
                    businessType: mapRestaurantTypeToBusinessType(restaurantType),
                    hasWaiterService: effectiveHasWaiterService,
                    tableCount: effectiveTableCount,
                    deliveryEnabled: effectiveDeliveryEnabled,
                    multiBranch: payload.multiBranch,
                    onboardingStatus: 'COMPLETED',
                    onboardingCompletedAt: new Date(),
                    workspaceConfig: preset,
                    successChecklist: setupChecklist,
                },
            });
            const trial = await (0, subscription_billing_service_1.startTrialForTenantTransaction)(tx, {
                tenantId: req.tenantId,
                actorUserId: req.user?.id,
                plan: normalizedPlan,
                hasWaiterService: effectiveHasWaiterService,
            });
            const tenant = await tx.tenant.findUnique({
                where: { id: req.tenantId },
                select: baseBusinessSelect,
            });
            if (!tenant) {
                throw new Error('TENANT_NOT_FOUND');
            }
            return { tenant, trial };
        });
        await Promise.all([
            (0, cache_service_1.deleteCache)(`tenant:${req.tenantId}:business-settings`),
            (0, cache_service_1.deleteCache)(`tenant:${req.tenantId}:billing`),
            (0, cache_service_1.deleteCache)(`public_menu_${existingTenant.slug}`),
            (0, cache_service_1.deleteCache)(`public_menu_${normalizedSlug}`),
        ]);
        return res.json({
            ...result.tenant,
            plan: (0, plans_1.normalizePlan)(result.tenant.plan),
            planLimits: (0, plans_1.getPlanLimits)(result.tenant.plan),
            trialStartedAt: result.tenant.trialStartedAt,
            trialEndsAt: result.trial.trialEndsAt,
            trialActivated: result.trial.created,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        if (error instanceof Error && error.message === 'GSTIN_ALREADY_EXISTS') {
            return res.status(409).json({
                error: 'GST number already exists. Each workspace must use a unique GST number.',
            });
        }
        return res.status(500).json({ error: 'Unable to finish onboarding right now.' });
    }
};
exports.completeBusinessOnboarding = completeBusinessOnboarding;
const getStaff = async (req, res) => {
    try {
        const staff = await prisma_1.prisma.user.findMany({
            where: { tenantId: req.tenantId },
            select: {
                id: true,
                name: true,
                email: true,
                employeeCode: true,
                role: true,
                mustChangePassword: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(staff.map((member) => ({
            ...member,
            username: member.email,
        })));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
};
exports.getStaff = getStaff;
const createStaff = async (req, res) => {
    try {
        const payload = createStaffSchema.parse(req.body);
        const { name, password } = payload;
        const role = payload.role;
        const normalizedRole = typeof role === 'string' ? role.toUpperCase() : '';
        const allowedStaffRoles = new Set([
            prisma_2.UserRole.MANAGER,
            prisma_2.UserRole.CASHIER,
            prisma_2.UserRole.KITCHEN,
            prisma_2.UserRole.WAITER,
        ]);
        const tenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId } });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const tenantLimits = (0, plans_1.getPlanLimits)(tenant.plan);
        if (!allowedStaffRoles.has(normalizedRole)) {
            return res.status(400).json({ error: 'Invalid staff role selected' });
        }
        if (normalizedRole === prisma_2.UserRole.WAITER && !tenantLimits.hasWaiterRole) {
            return res.status(403).json({
                error: `The ${tenantLimits.name} plan does not support the Waiter role. Please upgrade to CAFÉ or higher.`
            });
        }
        if (normalizedRole !== prisma_2.UserRole.OWNER && tenantLimits.staff <= 1) {
            return res.status(403).json({
                error: `The ${tenantLimits.name} plan is Owner-only. Please upgrade to a higher plan to add staff members.`
            });
        }
        const requestedLogin = payload.username?.trim() || payload.email?.trim() || '';
        const email = normalizeLoginEmail(requestedLogin, tenant.slug);
        if (!isEmailLike(email)) {
            return res.status(400).json({ error: 'Username format is invalid. Use for example: alex@your-venue.bhojflow' });
        }
        const baseEmployeeCode = payload.employeeCode?.trim().toUpperCase() || defaultEmployeeCode(name, tenant.slug);
        const requestedEmployeeCode = baseEmployeeCode;
        const count = await prisma_1.prisma.user.count({ where: { tenantId: req.tenantId } });
        const staffLimits = (0, plans_1.getPlanLimits)(tenant.plan);
        if (count >= staffLimits.staff) {
            return res.status(403).json({ error: `Plan limit reached. Your ${staffLimits.name} plan allows up to ${staffLimits.staff} staff members.` });
        }
        const [existingByEmail, existingByEmployeeCode] = await Promise.all([
            prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true } }),
            prisma_1.prisma.user.findFirst({ where: { employeeCode: requestedEmployeeCode }, select: { id: true } }),
        ]);
        if (existingByEmail)
            return res.status(400).json({ error: 'Email already exists' });
        let employeeCode = requestedEmployeeCode;
        if (existingByEmployeeCode) {
            if (payload.employeeCode) {
                return res.status(400).json({ error: 'Employee ID already exists' });
            }
            employeeCode = await ensureUniqueEmployeeCode(requestedEmployeeCode);
        }
        const hashedPassword = await (0, hash_1.hashPassword)(password);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                employeeCode,
                name,
                passwordHash: hashedPassword,
                role: normalizedRole,
                tenantId: req.tenantId,
                mustChangePassword: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                employeeCode: true,
                role: true,
                mustChangePassword: true,
                lastLoginAt: true,
            },
        });
        res.status(201).json(user);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        res.status(500).json({ error: 'Failed to create staff' });
    }
};
exports.createStaff = createStaff;
const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = updateStaffSchema.parse(req.body);
        const allowedStaffRoles = new Set([
            prisma_2.UserRole.MANAGER,
            prisma_2.UserRole.CASHIER,
            prisma_2.UserRole.KITCHEN,
            prisma_2.UserRole.WAITER,
        ]);
        const existingUser = await prisma_1.prisma.user.findFirst({
            where: { id, tenantId: req.tenantId },
            select: {
                id: true,
                role: true,
            },
        });
        if (!existingUser)
            return res.status(404).json({ error: 'Staff member not found' });
        if (existingUser.role === prisma_2.UserRole.OWNER) {
            return res.status(400).json({ error: 'Owner credentials cannot be edited from staff management.' });
        }
        const tenant = await prisma_1.prisma.tenant.findUnique({
            where: { id: req.tenantId },
            select: { slug: true },
        });
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        const updateData = {};
        if (typeof payload.name === 'string' && payload.name.trim()) {
            updateData.name = payload.name.trim();
        }
        if (typeof payload.role === 'string' && payload.role.trim()) {
            const normalizedRole = payload.role.trim().toUpperCase();
            if (!allowedStaffRoles.has(normalizedRole)) {
                return res.status(400).json({ error: 'Invalid staff role selected' });
            }
            const currentTenant = await prisma_1.prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { plan: true } });
            const planLimits = (0, plans_1.getPlanLimits)(currentTenant?.plan || 'MINI');
            if (normalizedRole === prisma_2.UserRole.WAITER && !planLimits.hasWaiterRole) {
                return res.status(403).json({
                    error: `The ${planLimits.name} plan does not support the Waiter role.`
                });
            }
            updateData.role = normalizedRole;
        }
        const requestedLogin = payload.username?.trim() || payload.email?.trim() || '';
        if (requestedLogin) {
            const email = normalizeLoginEmail(requestedLogin, tenant.slug);
            if (!isEmailLike(email)) {
                return res.status(400).json({ error: 'Username format is invalid. Use for example: alex@your-venue.bhojflow' });
            }
            const existingByEmail = await prisma_1.prisma.user.findFirst({
                where: { email, id: { not: id } },
                select: { id: true },
            });
            if (existingByEmail)
                return res.status(400).json({ error: 'Email already exists' });
            updateData.email = email;
        }
        if (payload.employeeCode?.trim()) {
            const employeeCode = payload.employeeCode.trim().toUpperCase();
            const existingByEmployeeCode = await prisma_1.prisma.user.findFirst({
                where: { employeeCode, id: { not: id } },
                select: { id: true },
            });
            if (existingByEmployeeCode)
                return res.status(400).json({ error: 'Employee ID already exists' });
            updateData.employeeCode = employeeCode;
        }
        if (payload.password?.trim()) {
            updateData.passwordHash = await (0, hash_1.hashPassword)(payload.password);
            updateData.mustChangePassword = true;
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                employeeCode: true,
                role: true,
                mustChangePassword: true,
                lastLoginAt: true,
            },
        });
        return res.json(updated);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        return res.status(500).json({ error: 'Failed to update staff' });
    }
};
exports.updateStaff = updateStaff;
const deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        // Prevent deleting oneself
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        await prisma_1.prisma.user.delete({
            where: { id, tenantId: req.tenantId }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete staff' });
    }
};
exports.deleteStaff = deleteStaff;
//# sourceMappingURL=settings.controller.js.map