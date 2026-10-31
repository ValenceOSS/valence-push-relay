FROM node:24.21.0-alpine AS build
WORKDIR /relay
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:24.21.0-alpine
WORKDIR /relay
ENV NODE_ENV=production
COPY --from=build /relay/node_modules ./node_modules
COPY --from=build /relay/dist ./dist
COPY package.json ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "dist/main.js"]
