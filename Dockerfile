# Use official Node.js Active LTS lightweight image
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies deterministically
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Expose port
EXPOSE 10000

# Set environment variable
ENV PORT=10000

# Start server
CMD ["node", "server.js"]
