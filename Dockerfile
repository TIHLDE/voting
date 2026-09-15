# ---------- build ----------
FROM ghcr.io/voidzero-dev/vite-plus:0.3.1 AS build

WORKDIR /app

COPY --chown=vp:vp package.json bun.lock ./
RUN vp install --frozen-lockfile

COPY --chown=vp:vp . .
ENV NODE_ENV=production
ENV NITRO_PRESET=bun
RUN vp build


# ---------- runtime ----------
FROM oven/bun:1.4 AS runtime

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output

ENV NODE_ENV=production

# Drizzle migrations (drizzle-kit migrate only needs the config + migrations folder)
COPY drizzle.config.ts ./
COPY drizzle ./drizzle

USER bun
EXPOSE 3000/tcp
ENTRYPOINT ["sh", "-c", "bun node_modules/drizzle-kit/bin.cjs migrate && bun run ./.output/server/index.mjs"]
