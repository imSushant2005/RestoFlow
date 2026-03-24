"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../config/auth");
const generateTokens = (payload) => {
    const plainPayload = { id: payload.id, tenantId: payload.tenantId, role: payload.role };
    const accessToken = jsonwebtoken_1.default.sign(plainPayload, auth_1.jwtConfig.secret, {
        expiresIn: auth_1.jwtConfig.expiresIn,
    });
    const refreshToken = jsonwebtoken_1.default.sign(plainPayload, auth_1.jwtConfig.refreshSecret, {
        expiresIn: auth_1.jwtConfig.refreshExpiresIn,
    });
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, auth_1.jwtConfig.secret);
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, auth_1.jwtConfig.refreshSecret);
};
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=jwt.js.map