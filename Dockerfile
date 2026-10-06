# Production Dockerfile for NOD Backend (Google Cloud Run / Container)
FROM node:22-slim AS base

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci --omit=dev
RUN npx prisma generate

# Copy source code
COPY . .

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run unified Express REST & Socket.IO server
CMD ["node", "server.js"]
