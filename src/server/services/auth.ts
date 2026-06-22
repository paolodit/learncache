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
}

const emailCache = new Map<string, CachedEmail>();

export async function requireAppAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> {
  if (!config.authEnabled) return { userId: "local", email: null };

  const auth = getAuth(request);
  if (!auth.userId) {
    reply.code(401).send({ error: "Sign in to access LearnCache." });
    return null;
  }

  const email = await primaryEmailForUser(auth.userId);
  if (config.allowedEmails.length === 0) {
    reply.code(403).send({ error: "AUTH_ENABLED is true but ALLOWED_EMAILS is empty." });
    return null;
  }

  if (!isEmailAllowed(email, config.allowedEmails)) {
    reply.code(403).send({ error: "Your account is not allowlisted for LearnCache." });
    return null;
  }

  return { userId: auth.userId, email };
}

export async function currentAppUser(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  if (!config.authEnabled) return { userId: "local", email: null };
  const auth = getAuth(request);
  if (!auth.userId) return null;
  const email = await primaryEmailForUser(auth.userId);
  return { userId: auth.userId, email };
}

export function isEmailAllowed(email: string | null, allowedEmails: string[]): boolean {
  return Boolean(email && allowedEmails.includes(email.toLowerCase()));
}

async function primaryEmailForUser(userId: string): Promise<string | null> {
  const cached = emailCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;

  if (!config.clerkSecretKey.trim()) {
    throw new Error("CLERK_SECRET_KEY is required when AUTH_ENABLED=true.");
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
