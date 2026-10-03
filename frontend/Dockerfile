FROM nginx:1.27-alpine

COPY src /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:80/ || exit 1