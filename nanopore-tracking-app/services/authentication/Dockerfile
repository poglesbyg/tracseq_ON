# Multi-stage build for Authentication Service
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.13.1

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build stage
FROM base AS build

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.13.1

# Copy package files
COPY package.json ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S auth -u 1001

# Change ownership of the app directory
RUN chown -R auth:nodejs /app
USER auth

# Expose port
EXPOSE 3004

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/server.js"]