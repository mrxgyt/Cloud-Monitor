FROM node:22-slim AS deps
WORKDIR /app
RUN npm install -g pnpm@10

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json        ./lib/api-spec/
COPY lib/api-zod/package.json         ./lib/api-zod/
COPY lib/db/package.json              ./lib/db/
COPY scripts/package.json             ./scripts/
COPY artifacts/api-server/package.json    ./artifacts/api-server/
COPY artifacts/netpanel/package.json      ./artifacts/netpanel/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/

RUN pnpm install --frozen-lockfile

FROM deps AS frontend
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/netpanel/ ./artifacts/netpanel/
RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/netpanel run build

FROM frontend AS backend
COPY artifacts/api-server/ ./artifacts/api-server/
RUN pnpm --filter @workspace/api-server run build

FROM node:22-slim AS production
WORKDIR /app

# Install V2Ray
RUN apt-get update && \
    apt-get install -y wget unzip && \
    wget https://github.com/v2fly/v2ray-core/releases/latest/download/v2ray-linux-64.zip && \
    unzip v2ray-linux-64.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/v2ray && \
    rm v2ray-linux-64.zip && \
    apt-get remove -y wget unzip && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY --from=backend  /app/artifacts/api-server/dist ./dist
COPY --from=frontend /app/artifacts/netpanel/dist/public ./public
COPY v2ray-config.json /etc/v2ray/config.json
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENV PORT=8080
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
EXPOSE 8080

CMD ["/app/start.sh"]
