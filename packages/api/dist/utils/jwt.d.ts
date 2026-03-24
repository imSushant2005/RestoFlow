import { UserRole } from '@dineflow/prisma';
export interface JwtPayload {
    id: string;
    tenantId: string;
    role: UserRole;
}
export declare const generateTokens: (payload: JwtPayload) => {
    accessToken: string;
    refreshToken: string;
};
export declare const verifyAccessToken: (token: string) => JwtPayload;
export declare const verifyRefreshToken: (token: string) => JwtPayload;
//# sourceMappingURL=jwt.d.ts.map