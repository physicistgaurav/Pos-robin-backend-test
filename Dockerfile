# ---------------------
# Stage 1: Build stage
# ---------------------
    FROM node:22-slim AS builder

    WORKDIR /app
    
    RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
    
    COPY package.json package-lock.json* ./
    RUN npm ci
    
    COPY . .
    RUN npm run build
    
    # -------------------------
    # Stage 2: Production stage
    # -------------------------
    FROM node:22-slim
    
    WORKDIR /app
    
    RUN apt-get update -y && apt-get install -y openssl && \
        npm install -g pm2 && \
        rm -rf /var/lib/apt/lists/*
    
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json .
    COPY --from=builder /app/ecosystem.config.js .
    COPY --from=builder /app/src/database/migrations ./dist/src/database/migrations
    
    # Create logs dir before switching to non-root user
    RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nodejs && \
        mkdir -p /app/logs && \
        chown -R nodejs:nodejs /app
    
    USER nodejs
    
    EXPOSE 5000
    
    CMD ["sh", "-c", "node dist/migrate.js up && pm2-runtime start ecosystem.config.js --env production"]