import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/server/db";
import { sessions, users } from "@/lib/server/db/schema";

const scrypt = promisify(nodeScrypt);
const SESSION_COOKIE = "mf_session";
const SESSION_DAYS = 30;

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}

export type UserRole = "customer" | "business_owner" | "operations";
export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

function publicUser(user: { id: string; name: string; email: string; role: UserRole }): AuthenticatedUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

export async function createUserAccount(
  input: unknown,
  role: "customer" | "business_owner" = "customer"
) {
  const account = input && typeof input === "object" ? input as Record<string, unknown> : null;
  if (
    !account ||
    typeof account.name !== "string" ||
    typeof account.email !== "string" ||
    typeof account.password !== "string" ||
    (account.phone !== undefined && typeof account.phone !== "string") ||
    !account.name.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim()) ||
    !validPassword(account.password)
  ) {
    throw new AuthenticationError("Name, valid email, and a password of at least 8 characters are required.");
  }
  const passwordHash = await hashPassword(account.password);
  const { db } = await getDatabase();
  const [user] = await db.insert(users).values({
    name: account.name.trim(),
    email: account.email.trim().toLowerCase(),
    phone: typeof account.phone === "string" ? account.phone.trim() || null : null,
    passwordHash,
    role,
  }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  return publicUser(user);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const { db } = await getDatabase();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function logoutCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const { db } = await getDatabase();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

export async function authenticateUser(email: string, password: string) {
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AuthenticationError("Invalid email or password.");
  }
  const { db } = await getDatabase();
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AuthenticationError("Invalid email or password.");
  }
  return publicUser(user);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { db } = await getDatabase();
  const [result] = await db.select({
    user: {
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    },
  })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return result?.user ?? null;
}

export async function requireBusinessOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "business_owner") throw new AuthenticationError("Business owner access is required.");
  return user;
}

export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") throw new AuthenticationError("Customer access is required.");
  return user;
}

/**
 * The signed-in customer, or null. Never throws: guest flows (checkout, public
 * tracking) must keep working when there is no session or no database.
 */
export async function getOptionalCustomer(): Promise<AuthenticatedUser | null> {
  try {
    const user = await getCurrentUser();
    return user?.role === "customer" ? user : null;
  } catch {
    return null;
  }
}

/** Re-check a signed-in user's password before a destructive action. */
export async function verifyUserPassword(userId: string, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || !password) return false;
  const { db } = await getDatabase();
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return Boolean(user) && (await verifyPassword(password, user.passwordHash));
}

export async function requireOperations() {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError("Operations authentication is required.");
  if (user.role !== "operations") throw new AuthorizationError("Operations access is required.");
  return user;
}
