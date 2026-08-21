FROM node:24-alpine
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# If /.env-file/.env is mounted into the container, its variables are made available to the server before it starts up.
RUN mkdir -p /.env-file /var/lib/zitadel-login/ip-location /var/lib/zitadel-login/ip-location-tmp && \
    touch /.env-file/.env && \
    chown -R nextjs:nodejs /.env-file /var/lib/zitadel-login

COPY --chown=nextjs:nodejs .next/standalone ./

USER nextjs
ENV HOSTNAME="::" \
    PORT="3000" \
    NODE_ENV="production" \
    NODE_OPTIONS="--use-openssl-ca --require /app/load-ssl-cert-dir.cjs" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt" \
    ZITADEL_TLS_ENABLED="false" \
    ILA_FIELDS="country" \
    ILA_IP_LOCATION_DB="user" \
    ILA_DATA_DIR="/var/lib/zitadel-login/ip-location" \
    ILA_TMP_DATA_DIR="/var/lib/zitadel-login/ip-location-tmp" \
    ILA_AUTO_UPDATE="0 3 * * *" \
    ILA_SMALL_MEMORY="false" \
    ILA_SILENT="true" \
    OTEL_SERVICE_NAME="zitadel-login" \
    OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/node", "/app/healthcheck.mjs", "/ui/v2/login/ready"]
ENTRYPOINT ["/app/entrypoint.sh", "node", "apps/login/server.js"]
