# Use official Node.js lightweight image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 7860

# Set environment variable
ENV PORT=7860

# Start server
CMD ["node", "server.js"]
