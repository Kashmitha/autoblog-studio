FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY scripts scripts
RUN npm run db:generate && npm run build -w backend
FROM build AS runtime
ENV NODE_ENV=production
RUN npm prune --omit=dev && mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 4000
CMD ["npm","run","start","-w","backend"]
