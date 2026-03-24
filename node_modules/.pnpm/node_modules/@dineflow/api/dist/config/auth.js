"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.jwtConfig = {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-change-me',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
};
//# sourceMappingURL=auth.js.map