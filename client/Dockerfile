# ---------- Build Stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy only dependency files first (cache-friendly)
COPY client/package.json client/package-lock.json ./
RUN npm install

# Copy client source
COPY client/ .
RUN npm run build


# ---------- Production Stage ----------
FROM nginx:alpine

# Copy custom nginx configuration for SPA routing
COPY client/nginx.conf /etc/nginx/nginx.conf

# Copy built assets (Vite -> dist)
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]