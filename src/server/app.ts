import fs from "node:fs";
import path from "node:path";
import cors from "@fastify/cors";
import { clerkPlugin } from "@clerk/fastify";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { config } from "./config.js";
import { registerItemRoutes } from "./routes/items.js";
import { assertAuthConfiguration, clearPasswordSession, currentAppUser, requireAppAuth, setPasswordSession, validatePassword } from "./services/auth.js";

export async function buildApp() {
  const app = fastify({
    logger: false
  });

  await app.register(cors, {
    origin: allowedOrigins()
  });

  assertAuthConfiguration();

  if (config.authEnabled && config.authProvider === "clerk") {
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
    authEnabled: config.authEnabled,
    authProvider: config.authProvider
  }));

  app.get("/api/config", async () => ({
    appPublicUrl: config.appPublicUrl,
    authEnabled: config.authEnabled,
    authProvider: config.authProvider,
    clerkPublishableKey: config.authEnabled && config.authProvider === "clerk" ? config.clerkPublishableKey : null
  }));

  app.get("/api/me", async (request, reply) => {
    const user = await currentAppUser(request);
    if (config.authEnabled && !user) {
      reply.code(401);
      return { user: null };
    }
    return { user, authEnabled: config.authEnabled, authProvider: config.authProvider };
  });

  app.post("/api/auth/login", async (request, reply) => {
    if (!config.authEnabled || config.authProvider !== "password") {
      reply.code(404);
      return { error: "Password auth is not enabled." };
    }

    const body = loginSchema.parse(request.body);
    if (!validatePassword(body.password)) {
      reply.code(401);
      return { error: "Incorrect password." };
    }

    setPasswordSession(reply);
    return { user: { userId: "owner", email: null, authMethod: "password" }, authEnabled: true, authProvider: config.authProvider };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    clearPasswordSession(reply);
    return { ok: true };
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

const loginSchema = z.object({
  password: z.string().min(1)
});

const publicApiPaths = new Set(["/api/health", "/api/config", "/api/me", "/api/auth/login", "/api/auth/logout"]);

function allowedOrigins(): string[] {
  return [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    config.appPublicUrl,
    ...config.corsAllowedOrigins
  ].filter((origin, index, origins) => Boolean(origin) && origins.indexOf(origin) === index);
}
