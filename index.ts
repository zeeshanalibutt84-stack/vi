// --------------------
// Load Environment Variables
// --------------------
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initRealtime } from "./realtime";

// __dirname setup for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Optional sanity log (you can delete this later)
console.log("SENDGRID API Key loaded?", !!process.env.SENDGRID_API_KEY);

// --------------------
// Imports
// --------------------
import express, { type Request, type Response, type NextFunction } from "express";
import http from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// --------------------
// App Setup
// --------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

// --------------------
// Request Logging (API only)
// --------------------
app.use((req, res, next) => {
  const start = Date.now();
  const pathUrl = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  (res as any).json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathUrl.startsWith("/api")) {
      let logLine = `${req.method} ${pathUrl} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
          // ignore stringify errors
        }
      }
      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// --------------------
// Bootstrap
// --------------------
(async () => {
  const server = http.createServer(app);

  // Register API routes first
  await registerRoutes(app);
initRealtime(app);

  // Error Handler (after routes)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    // rethrow for visibility in logs
    throw err;
  });

  // Dev uses Vite middlewares; Prod serves built assets
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    log("Starting in Development mode...");
    await setupVite(app, server);
  } else {
    log("Starting in Production mode...");
    serveStatic(app);
  }

  // Ports/Host (Windows-friendly)
  const port = Number(process.env.PORT) || 5000;
  const host = isDev ? "127.0.0.1" : "0.0.0.0";

  server.listen({ port, host }, () => {
    const shownHost = isDev ? "localhost" : host;
    log(`🚀 Serving on http://${shownHost}:${port}`);
  });
})();

