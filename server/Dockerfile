# ---------- Base ----------
FROM node:22-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy only server package files first (cache-friendly)
COPY server/package.json server/package-lock.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy server source code
COPY server/ .

# CapRover provides PORT automatically
ENV NODE_ENV=production

# App MUST listen on process.env.PORT
EXPOSE 3000

# Start server
CMD ["node", "server.js"]