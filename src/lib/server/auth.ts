import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/server/db";
import { sessions, users } from "@/lib/server/db/schema";
import { normalizeKenyanPhone } from "@/lib/phone";

const scrypt = promisify(nodeScrypt);
const SESSION_COOKIE = "mf_session";
const SESSION_DAYS = 30;
/** Refresh a session once less than half its life is left. */
const SESSION_REFRESH_WINDOW_MS = 15 * 86_400_000;

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}

export type UserRole = "customer" | "business_owner" | "operations";
export type AuthenticatedUser = {
  id: string;
  name: string;
  /** Phone-first customers sign in with a code and never set an email. */
  email: string | null;
  /** Kenyan mobile number in local form, when the account has one. */
  phone: string | null;
  role: UserRole;
};

function publicUser(user: {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  role: UserRole;
}): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role,
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
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
  const phone = normalizeKenyanPhone(typeof account.phone === "string" ? account.phone : null);
  const { db } = await getDatabase();
  // The phone belongs to the customer, not to the sign-up form: if another
  // account already claims it, sign up with the email only rather than fail.
  const phoneForAccount = phone && (await isPhoneTaken(phone)) ? null : phone;
  const [user] = await db.insert(users).values({
    name: account.name.trim(),
    email: account.email.trim().toLowerCase(),
    phone: phoneForAccount,
    passwordHash,
    role,
  }).returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role });
  return publicUser(user);
}

/** True when an account already uses this Kenyan number. */
export async function isPhoneTaken(phone: string): Promise<boolean> {
  const local = normalizeKenyanPhone(phone);
  if (!local) return false;
  const { db } = await getDatabase();
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.phone, local)).limit(1);
  return Boolean(row);
}

/** The account that owns this Kenyan number, if any. */
export async function findUserByPhone(phone: string) {
  const local = normalizeKenyanPhone(phone);
  if (!local) return null;
  const { db } = await getDatabase();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role })
    .from(users)
    .where(eq(users.phone, local))
    .limit(1);
  return user ?? null;
}

/**
 * Create the account behind a verified phone number. Phone-first customers
 * have no password and no email, so both stay empty.
 */
export async function createPhoneAccount(name: string, phone: string) {
  const local = normalizeKenyanPhone(phone);
  if (!local) {
    throw new AuthenticationError("Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX….");
  }
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2) {
    throw new AuthenticationError("Enter your full name.");
  }
  if (await isPhoneTaken(local)) {
    throw new AuthenticationError("That number already has an account. Sign in instead.");
  }
  const { db } = await getDatabase();
  const [user] = await db
    .insert(users)
    .values({ name: cleanName, email: null, phone: local, passwordHash: null, role: "customer" })
    .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role });
  return publicUser(user);
}

/** Sign in the account that owns this Kenyan number. */
export async function authenticatePhone(phone: string) {
  const user = await findUserByPhone(phone);
  if (!user) {
    throw new AuthenticationError("We could not find an account for that number.");
  }
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
      phone: users.phone,
      role: users.role,
    },
  })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return result?.user ?? null;
}

/**
 * Extend a session that is halfway through its life, so an active customer is
 * never logged out mid-order.
 *
 * The database row and the cookie move together, which keeps the row from
 * outliving the cookie that can reach it. Only route handlers and server
 * actions may call this: they are the only places a cookie can be written.
 */
export async function renewSession(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { db } = await getDatabase();
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      id: sessions.id,
      expiresAt: sessions.expiresAt,
      user: { id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;

  const remaining = row.expiresAt.getTime() - Date.now();
  if (remaining > SESSION_REFRESH_WINDOW_MS) return publicUser(row.user);

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, row.id));
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return publicUser(row.user);
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
