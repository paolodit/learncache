import crypto from "node:crypto";
import { getAuth } from "@clerk/fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

interface CachedEmail {
  email: string | null;
  expiresAt: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string | null;
  authMethod: "local" | "password" | "extension-token" | "clerk";
}

const sessionCookieName = "learncache_session";
const sessionTtlSeconds = 30 * 24 * 60 * 60;
const emailCache = new Map<string, CachedEmail>();

export async function requireAppAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
  const user = await currentAppUser(request);
  if (user) return user;

  reply.code(401).send({ error: "Sign in to access LearnCache." });
  return null;
}

export async function currentAppUser(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  if (!config.authEnabled || config.authProvider === "none") {
    return { userId: "local", email: null, authMethod: "local" };
  }

  if (config.authProvider === "password") {
    const tokenUser = extensionTokenUser(request);
    if (tokenUser) return tokenUser;

    const session = readSessionCookie(request);
    if (session) return session;
    return null;
  }

  if (config.authProvider === "clerk") return clerkUser(request);
  return null;
}

export function assertAuthConfiguration(): void {
  if (!config.authEnabled || config.authProvider === "none") return;

  if (config.authProvider === "password") {
    if (!config.appPassword.trim()) {
      throw new Error("APP_PASSWORD is required when AUTH_PROVIDER=password.");
    }
    if (!config.appSessionSecret.trim()) {
      throw new Error("APP_SESSION_SECRET is required when AUTH_PROVIDER=password.");
    }
    return;
  }

  if (config.authProvider === "clerk" && (!config.clerkPublishableKey.trim() || !config.clerkSecretKey.trim())) {
    throw new Error("CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required when AUTH_PROVIDER=clerk.");
  }
}

export function validatePassword(password: string): boolean {
  return secureCompare(password, config.appPassword);
}

export function setPasswordSession(reply: FastifyReply): void {
  const payload = {
    sub: "owner",
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds
  };
  const token = signSession(payload);
  reply.header("Set-Cookie", serializeCookie(sessionCookieName, token, sessionTtlSeconds));
}

export function clearPasswordSession(reply: FastifyReply): void {
  reply.header("Set-Cookie", serializeCookie(sessionCookieName, "", 0));
}

export function signSession(payload: { sub: string; exp: number }): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sessionSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySession(token: string): { sub: string; exp: number } | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!secureCompare(signature, sessionSignature(encodedPayload))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { sub?: string; exp?: number };
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, exp: payload.exp };
  } catch {
    return null;
  }
}

export function isEmailAllowed(email: string | null, allowedEmails: string[]): boolean {
  return Boolean(email && allowedEmails.includes(email.toLowerCase()));
}

function extensionTokenUser(request: FastifyRequest): AuthenticatedUser | null {
  if (!config.extensionApiToken.trim()) return null;

  const authorization = request.headers.authorization ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  return secureCompare(match[1], config.extensionApiToken)
    ? { userId: "extension", email: null, authMethod: "extension-token" }
    : null;
}

function readSessionCookie(request: FastifyRequest): AuthenticatedUser | null {
  const token = parseCookies(request.headers.cookie ?? "")[sessionCookieName];
  if (!token) return null;

  const payload = verifySession(token);
  if (!payload) return null;
  return { userId: payload.sub, email: null, authMethod: "password" };
}

async function clerkUser(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  const auth = getAuth(request);
  if (!auth.userId) return null;

  const email = await primaryEmailForUser(auth.userId);
  if (config.allowedEmails.length === 0 || !isEmailAllowed(email, config.allowedEmails)) return null;
  return { userId: auth.userId, email, authMethod: "clerk" };
}

async function primaryEmailForUser(userId: string): Promise<string | null> {
  const cached = emailCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;

  if (!config.clerkSecretKey.trim()) {
    throw new Error("CLERK_SECRET_KEY is required when AUTH_PROVIDER=clerk.");
  }

  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    headers: {
      Authorization: `Bearer ${config.clerkSecretKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Clerk user lookup failed with HTTP ${response.status}.`);
  }

  const user = (await response.json()) as {
    primary_email_address_id?: string;
    email_addresses?: Array<{ id?: string; email_address?: string }>;
  };
  const primary = user.email_addresses?.find((entry) => entry.id === user.primary_email_address_id)?.email_address;
  const fallback = user.email_addresses?.[0]?.email_address;
  const email = primary ?? fallback ?? null;
  emailCache.set(userId, { email, expiresAt: Date.now() + 5 * 60 * 1000 });
  return email;
}

function sessionSignature(encodedPayload: string): string {
  return crypto.createHmac("sha256", config.appSessionSecret).update(encodedPayload).digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name || valueParts.length === 0) continue;
    cookies[name] = decodeURIComponent(valueParts.join("="));
  }
  return cookies;
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  const secure = config.appPublicUrl.startsWith("https://") ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
