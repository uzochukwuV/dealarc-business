import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { readFileSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Swagger UI (served from CDN, spec from file) ─────────────────────────────

// Load and convert the OpenAPI YAML spec to JSON at startup
let openApiSpec: object = {};
try {
  // __dirname is set by the esbuild banner to the dist/ directory
  // The spec lives 2 levels up at lib/api-spec/openapi.yaml
  const specPath = path.resolve(__dirname, "../../../lib/api-spec/openapi.yaml");
  const raw = readFileSync(specPath, "utf-8");
  // Simple YAML → JSON: use the yaml npm package if available, else basic parse
  openApiSpec = parseYaml(raw);
  logger.info({ specPath }, "OpenAPI spec loaded");
} catch (err) {
  logger.warn({ err }, "Could not load OpenAPI spec — /api/docs will return an empty spec");
}

/** Minimal YAML parser for well-formed OpenAPI specs (not a general YAML parser) */
function parseYaml(raw: string): object {
  try {
    // Try to dynamically require js-yaml if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require("js-yaml");
    return yaml.load(raw) as object;
  } catch {
    // Fallback: return empty object so swagger UI still loads (with empty spec)
    logger.warn("js-yaml not available; OpenAPI spec will not be parsed");
    return { openapi: "3.1.0", info: { title: "B2B Deal Network API", version: "1.0.0" } };
  }
}

// GET /api/docs → Swagger UI HTML (loads spec from /api/docs/openapi.json)
app.get("/api/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>B2B Deal Network — API Docs</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      .swagger-ui .topbar { background: #1a1a2e; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function() {
        SwaggerUIBundle({
          url: "/api/docs/openapi.json",
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          plugins: [SwaggerUIBundle.plugins.DownloadUrl],
          layout: "StandaloneLayout",
          persistAuthorization: true,
          tryItOutEnabled: true
        });
      }
    </script>
  </body>
</html>`);
});

// GET /api/docs/openapi.json → raw spec as JSON
app.get("/api/docs/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

// GET /api/docs/openapi.yaml → raw spec as YAML
app.get("/api/docs/openapi.yaml", (_req, res) => {
  try {
    const specPath = path.resolve(__dirname, "../../../lib/api-spec/openapi.yaml");
    const raw = readFileSync(specPath, "utf-8");
    res.setHeader("Content-Type", "application/yaml");
    res.send(raw);
  } catch {
    res.status(404).json({ error: "Spec file not found" });
  }
});

app.use("/api", router);

export default app;
