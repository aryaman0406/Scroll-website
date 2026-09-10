# Production-grade lightweight Nginx Alpine container
FROM nginx:1.27-alpine

# Set metadata labels
LABEL maintainer="OUDH & ROSE Atelier"
LABEL description="OUDH & ROSE interactive canvas scrollytelling website"

# Set working directory
WORKDIR /usr/share/nginx/html

# Clean default Nginx web root
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx server configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy website assets
COPY index.html ./
COPY main.js ./
COPY frames/ ./frames/
COPY images/ ./images/
COPY assets_engine/ ./assets_engine/

# Expose web port
EXPOSE 80

# Health check to monitor container status
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/healthz || exit 1

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
