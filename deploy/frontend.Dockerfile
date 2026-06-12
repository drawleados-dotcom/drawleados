# ===== Frontend Dockerfile (React + nginx) =====
# Multi-stage build: build static bundle with Node, serve with nginx

# ---- Stage 1: build ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for cache
COPY frontend/package.json frontend/yarn.lock* /app/
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy source and build
COPY frontend/ /app/

# Production build args — REACT_APP_BACKEND_URL is baked in at build time
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN yarn build

# ---- Stage 2: serve ----
FROM nginx:1.25-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
