FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.13.1

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.13.1

# Install only production dependencies (skip postinstall scripts)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && pnpm store prune

# Copy built application
COPY --from=base /app/dist ./dist
COPY --from=base /app/src ./src

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S astro -u 1001

# Change ownership of the app directory
RUN chown -R astro:nodejs /app
USER astro

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["pnpm", "start"]