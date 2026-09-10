# Docker Deployment Guide for OUDH & ROSE Scrollytelling Website

This repository is configured with a high-performance **Nginx Alpine** Docker container optimized for static asset caching, Gzip compression, and canvas sequence rendering.

---

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

To build and start the website in the background:
```bash
docker compose up -d --build
```
Open your browser at:
👉 **http://localhost:8080**

To view container status and logs:
```bash
docker compose logs -f
```

To stop the container:
```bash
docker compose down
```

---

### Option 2: Using the Docker CLI Directly

1. **Build the image**:
   ```bash
   docker build -t scroll-website:latest .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name scroll_website_app \
     -p 8080:80 \
     --restart unless-stopped \
     scroll-website:latest
   ```

3. **Check health status**:
   ```bash
   docker ps
   ```

4. **Stop & remove container**:
   ```bash
   docker stop scroll_website_app
   docker rm scroll_website_app
   ```

---

## 🛠️ Configuration Details

| File | Purpose |
|------|---------|
| `Dockerfile` | Production Alpine Nginx container setup with minimal footprint. |
| `nginx.conf` | Optimized Nginx config with Gzip compression, WebP/media caching (30 days), security headers, and health checks. |
| `docker-compose.yml` | Orchestration configuration with port forwarding (`8080:80`) and auto-restart. |
| `.dockerignore` | Excludes development scripts, raw files, and docs to keep the image slim and fast. |

---

## 🌐 Deploying to Production Cloud Services

### 1. Docker Hub / Container Registry
```bash
# Tag image
docker tag scroll-website:latest yourusername/scroll-website:v1.0.0

# Push to registry
docker push yourusername/scroll-website:v1.0.0
```

### 2. Google Cloud Run / AWS App Runner / DigitalOcean App Platform
Because this container listens on standard HTTP port `80` and has a built-in health check (`/healthz`), it can be deployed directly to serverless container runtimes with zero additional changes.

### 3. VPS / Linux Server with Reverse Proxy
If running on a VPS with Traefik, Caddy, or Nginx Proxy Manager, point the proxy upstream to `http://localhost:8080` (or whichever port you choose in `docker-compose.yml`).
