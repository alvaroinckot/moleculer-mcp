# Use the latest LTS Node.js version
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Set environment variables for configurable port and settings
ENV PORT=3000
ENV SETTINGS_FILE=""

# Copy package files and install dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy TypeScript configuration files
COPY tsconfig*.json ./

# Copy source code
COPY src ./src

# Copy example configuration files (can be overridden by volume mounts)
COPY moleculer.config.example.js ./moleculer.config.example.js
COPY settings.example.json ./settings.json

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev && npm cache clean --force

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S moleculer -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R moleculer:nodejs /app
USER moleculer

# Make port configurable via environment variable
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: process.env.PORT || 3000, timeout: 2000 }; \
    const healthCheck = http.request(options, (res) => { \
      if (res.statusCode === 200) process.exit(0); \
      else process.exit(1); \
    }); \
    healthCheck.on('error', () => process.exit(1)); \
    healthCheck.end();"

# Start the application with configurable settings
CMD ["sh", "-c", "if [ -n \"$SETTINGS_FILE\" ]; then node dist/cjs/bootstrap.js --settings \"$SETTINGS_FILE\"; else node dist/cjs/bootstrap.js --settings settings.json; fi"]
