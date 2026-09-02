# Fase 0A - servico `web` (painel)
#
# ATENCAO: a Vercel NAO usa este arquivo. Ela constroi Next.js com o pipeline
# proprio, em funcoes serverless, e ignora Dockerfile. Este arquivo serve para:
#
#   - desenvolvimento local com docker compose, com paridade de runtime;
#   - portabilidade: se um dia o painel sair da Vercel, ja roda em qualquer
#     lugar que aceite container.
#
# Build multi-estagio: a imagem final leva so o necessario para rodar.

# ---------------------------------------------------------------- deps
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` respeita o lockfile exatamente - e o que torna o build reproduzivel.
RUN npm ci

# ------------------------------------------------------------- builder
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Liga `output: 'standalone'` no next.config.mjs SOMENTE neste build.
# Fora daqui a variavel nao existe, entao a Vercel constroi do jeito dela.
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -------------------------------------------------------------- runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Sem volume neste servico, entao usuario nao-root sem ressalvas.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# O build standalone ja traz as dependencias de runtime que precisa.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# `public/` e opcional; a barra final faz o COPY nao falhar se ele nao existir.
COPY --from=builder --chown=nextjs:nodejs /app/public* ./public/

USER nextjs
EXPOSE 3000

# O server.js do build standalone le HOSTNAME e PORT do ambiente.
ENV HOSTNAME=0.0.0.0
CMD node server.js
