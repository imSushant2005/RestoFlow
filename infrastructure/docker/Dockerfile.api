FROM node:20-alpine AS builder
RUN apk update && apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY infrastructure ./infrastructure
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# Generate Prisma client BEFORE building (required for @prisma/client types)
WORKDIR /app/infrastructure/prisma
RUN pnpm prisma generate

WORKDIR /app/packages/api
RUN pnpm build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app /app

WORKDIR /app/packages/api
EXPOSE 4000
CMD ["pnpm", "start"]
