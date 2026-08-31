# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY .openai ./.openai
COPY app ./app
COPY build ./build
COPY db ./db
COPY public ./public
COPY scripts ./scripts
COPY worker ./worker
COPY eslint.config.mjs next.config.ts postcss.config.mjs tsconfig.json vite.config.ts ./
RUN npm run build

FROM node:24-alpine AS runtime

ARG UPTCG_GIT_SHA=development

ENV NODE_ENV=production
ENV PORT=3000
ENV UPTCG_DB_PATH=/data/uptcg.sqlite
ENV UPTCG_CARD_DATA_DIR=/data/card-data
ENV UPTCG_CARD_ASSET_DIR=/data/card-assets
ENV UPTCG_GIT_SHA=${UPTCG_GIT_SHA}
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/jibril2333/uptcg-app"
LABEL org.opencontainers.image.revision=${UPTCG_GIT_SHA}

COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node scripts/card-update-manager.mjs ./scripts/card-update-manager.mjs
COPY --chown=node:node scripts/ntfy-manager.mjs ./scripts/ntfy-manager.mjs
COPY --chown=node:node scripts/serve-local.mjs ./scripts/serve-local.mjs
COPY --chown=node:node scripts/start-container.mjs ./scripts/start-container.mjs
COPY --chown=node:node scripts/sync-ua-cards.mjs ./scripts/sync-ua-cards.mjs

RUN mkdir -p /data && chown node:node /data

USER node
VOLUME ["/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "scripts/start-container.mjs"]
