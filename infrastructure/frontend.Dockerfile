FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend frontend
ARG API_INTERNAL_URL=http://backend:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build -w frontend
FROM build AS runtime
ENV NODE_ENV=production
RUN npm prune --omit=dev && chown -R node:node /app/frontend/.next
USER node
EXPOSE 3100
CMD ["npm","run","start","-w","frontend"]
