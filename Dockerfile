ARG BASE_REGISTRY=docker.io
FROM ${BASE_REGISTRY}/library/node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM ${BASE_REGISTRY}/library/node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --system --uid 1001 --create-home appuser
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY db ./db
COPY *.html script.js styles.css account.js account.css ./
COPY admin ./admin
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
CMD ["sh", "-c", "node server/scripts/migrate-media.js && node server/app.js"]
