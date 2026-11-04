# Build context is the repo root: docker build -f apps/server/Dockerfile .
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @glyphtex/server --prod --ignore-scripts \
	&& pnpm --filter @glyphtex/server deploy --prod --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY --from=deps /out/node_modules ./node_modules
COPY apps/server/package.json ./
COPY apps/server/src ./src
COPY apps/server/drizzle ./drizzle
USER node
EXPOSE 8787
# Node 22.18+ runs the TypeScript sources directly (type stripping); no build step.
CMD ["node", "src/entry/node.ts"]
