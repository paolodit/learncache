import fs from "node:fs";
import path from "node:path";
import cors from "@fastify/cors";
import { clerkPlugin } from "@clerk/fastify";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { registerItemRoutes } from "./routes/items.js";
import { currentAppUser, requireAppAuth } from "./services/auth.js";

export async function buildApp() {
  const app = fastify({
    logger: false
  });

  await app.register(cors, {
    origin: allowedOrigins()
  });

  if (config.authEnabled) {
    if (!config.clerkPublishableKey.trim() || !config.clerkSecretKey.trim()) {
      throw new Error("CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required when AUTH_ENABLED=true.");
    }

    await app.register(clerkPlugin, {
      publishableKey: config.clerkPublishableKey,
      secretKey: config.clerkSecretKey
    });
  }

  app.addHook("preHandler", async (request, reply) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (!config.authEnabled || !pathname.startsWith("/api") || publicApiPaths.has(pathname)) return;
    await requireAppAuth(request, reply);
  });

  app.get("/api/health", async () => ({
    ok: true,
    authEnabled: config.authEnabled
  }));

  app.get("/api/config", async () => ({
    appPublicUrl: config.appPublicUrl,
    authEnabled: config.authEnabled,
    clerkPublishableKey: config.authEnabled ? config.clerkPublishableKey : null
  }));

  app.get("/api/me", async (request, reply) => {
    const user = await currentAppUser(request);
    if (config.authEnabled && !user) {
      reply.code(401);
      return { user: null };
    }
    return { user, authEnabled: config.authEnabled };
  });

  await registerItemRoutes(app);

  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    await app.register(fastifyStatic, {
      root: distPath,
      prefix: "/"
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith("/api")) {
        reply.code(404).send({ error: "Not found." });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  return app;
}

const publicApiPaths = new Set(["/api/health", "/api/config"]);

function allowedOrigins(): string[] {
  return [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    config.appPublicUrl,
    ...config.corsAllowedOrigins
  ].filter((origin, index, origins) => Boolean(origin) && origins.indexOf(origin) === index);
}
