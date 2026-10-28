import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { trackWebSocketProxy } from "./lib/vpn-activity";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// V2Ray WebSocket proxy - MUST be before other middlewares
app.use(
  "/Bendecido91",
  createProxyMiddleware({
    target: "http://127.0.0.1:10808",
    ws: true,
    changeOrigin: true,
    logger: logger,
    on: {
      proxyReqWs(proxyReq, _req, socket, _options, head) {
        trackWebSocketProxy(proxyReq, socket, head);
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve React frontend static files when STATIC_DIR is set (production/Docker)
const staticDir = process.env.STATIC_DIR;
if (staticDir) {
  app.use(express.static(staticDir));
  // SPA fallback: all non-API routes serve index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
