# Stage 1: Build client frontend
FROM node:24-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Production server runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source code
COPY server/ ./server/

# Copy built client distribution bundle from stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Copy root package.json for standard scripts
COPY package*.json ./

# Secure non-root user
USER node

EXPOSE 5000

CMD ["node", "server/src/server.js"]
