"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtConfig = void 0;
const env_1 = require("./env");
exports.jwtConfig = {
    secret: env_1.env.STAFF_ACCESS_SECRET || env_1.env.JWT_SECRET,
    refreshSecret: env_1.env.STAFF_REFRESH_SECRET || env_1.env.JWT_REFRESH_SECRET || env_1.env.STAFF_ACCESS_SECRET || env_1.env.JWT_SECRET,
    expiresIn: '24h',
    refreshExpiresIn: '7d',
};
//# sourceMappingURL=auth.js.map