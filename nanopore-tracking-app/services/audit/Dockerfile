# Multi-stage build for Audit Service
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S audit-service -u 1001

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create necessary directories
RUN mkdir -p /app/logs /app/data && chown -R audit-service:nodejs /app

# Copy built application from builder stage
COPY --from=builder --chown=audit-service:nodejs /app/dist ./dist
COPY --from=builder --chown=audit-service:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=audit-service:nodejs /app/package*.json ./

# Copy database schema
COPY --from=builder --chown=audit-service:nodejs /app/src/database ./src/database

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown -R audit-service:nodejs /app/logs

# Switch to non-root user
USER audit-service

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3006/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]