"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const envCandidates = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), '../../.env'),
];
for (const envPath of envCandidates) {
    if (fs_1.default.existsSync(envPath)) {
        dotenv_1.default.config({ path: envPath });
        break;
    }
}
exports.jwtConfig = {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-change-me',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
};
//# sourceMappingURL=auth.js.map