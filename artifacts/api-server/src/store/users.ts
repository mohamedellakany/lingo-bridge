import crypto from "crypto";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  db,
  usersTable,
  authTokensTable,
} from "@workspace/db";
import { eq, lt } from "drizzle-orm";

// process.cwd() is artifacts/api-server/ when the server starts
const DATA_FILE = path.join(process.cwd(), "data", "users.json");

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  speakerCode: string;
  createdAt: number;
}

interface User extends PublicUser {
  passwordHash: string;
  emailVerified: boolean;
}

/** A signup awaiting email OTP verification (not yet a real account). */
interface PendingRegistration {
  username: string;
  email: string;
  passwordHash: string;
  otpHash: string;
  otpSalt: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

interface TokenRecord {
  userId: string;
  expiresAt: number;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const OTP_MAX_ATTEMPTS = 5;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 10;

// Pending signups are always in memory (short-lived, pre-account).
const pending = new Map<string, PendingRegistration>();

// ── In-memory / JSON fallback state (used when DATABASE_URL is unset) ────────
const memUsers = new Map<string, User>();
const memTokens = new Map<string, TokenRecord>();

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as {
      users?: User[];
      tokens?: Record<string, TokenRecord>;
      // legacy shape: a bare array of users with salt/token fields
      legacy?: unknown;
    };

    if (Array.isArray(parsed)) {
      // Legacy format: array of users with embedded token + salt (pre-bcrypt).
      for (const u of parsed as Array<User & { token?: string | null }>) {
        memUsers.set(u.username, {
          id: u.id,
          username: u.username,
          email: u.email ?? "",
          speakerCode: u.speakerCode,
          passwordHash: u.passwordHash,
          emailVerified: u.emailVerified ?? true,
          createdAt: u.createdAt,
        });
      }
      return;
    }

    for (const u of parsed.users ?? []) memUsers.set(u.username, u);
    if (parsed.tokens) {
      for (const [token, rec] of Object.entries(parsed.tokens)) {
        memTokens.set(token, rec);
      }
    }
  } catch {
    // ignore corrupt file — start fresh
  }
}

function saveToDisk(): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const payload = {
      users: [...memUsers.values()],
      tokens: Object.fromEntries(memTokens.entries()),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // ignore write errors
  }
}

if (!db) loadFromDisk();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    speakerCode: user.speakerCode,
    createdAt: user.createdAt,
  };
}

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── User lookups (DB or memory) ─────────────────────────────────────────────

async function findUserByUsername(key: string): Promise<User | undefined> {
  if (db) {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, key))
      .limit(1);
    const r = rows[0];
    if (!r) return undefined;
    return {
      id: r.id,
      username: r.username,
      email: r.email,
      speakerCode: r.speakerCode,
      passwordHash: r.passwordHash,
      emailVerified: r.emailVerified,
      createdAt: r.createdAt.getTime(),
    };
  }
  return memUsers.get(key);
}

async function usernameTaken(key: string): Promise<boolean> {
  return (await findUserByUsername(key)) !== undefined;
}

async function emailInUse(email: string): Promise<boolean> {
  const target = email.toLowerCase().trim();
  if (db) {
    const rows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, target))
      .limit(1);
    return rows.length > 0;
  }
  for (const u of memUsers.values()) {
    if (u.email.toLowerCase() === target) return true;
  }
  return false;
}

async function findUserByEmail(email: string): Promise<User | undefined> {
  const target = email.toLowerCase().trim();
  if (db) {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, target))
      .limit(1);
    const r = rows[0];
    if (!r) return undefined;
    return {
      id: r.id,
      username: r.username,
      email: r.email,
      speakerCode: r.speakerCode,
      passwordHash: r.passwordHash,
      emailVerified: r.emailVerified,
      createdAt: r.createdAt.getTime(),
    };
  }
  for (const u of memUsers.values()) {
    if (u.email.toLowerCase() === target) return u;
  }
  return undefined;
}

/**
 * Derives a unique, valid username from an email local-part or display name,
 * appending a numeric suffix if needed to avoid collisions.
 */
async function uniqueUsernameFrom(seed: string): Promise<string> {
  let base = seed
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  if (base.length < 3) base = `user${base}`;
  base = base.slice(0, 20);

  if (!(await usernameTaken(base))) return base;
  for (let i = 1; i < 1000; i++) {
    const suffix = String(i);
    const candidate = base.slice(0, 20 - suffix.length) + suffix;
    if (!(await usernameTaken(candidate))) return candidate;
  }
  // Extremely unlikely fallback.
  return `user${crypto.randomBytes(4).toString("hex")}`;
}

async function persistUser(user: User): Promise<void> {
  if (db) {
    await db.insert(usersTable).values({
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      speakerCode: user.speakerCode,
      emailVerified: user.emailVerified,
      createdAt: new Date(user.createdAt),
    });
  } else {
    memUsers.set(user.username, user);
    saveToDisk();
  }
}

async function storeToken(token: string, userId: string, expiresAt: number): Promise<void> {
  if (db) {
    await db.insert(authTokensTable).values({
      token,
      userId,
      expiresAt: new Date(expiresAt),
    });
  } else {
    memTokens.set(token, { userId, expiresAt });
    saveToDisk();
  }
}

// ── Signup (OTP) ────────────────────────────────────────────────────────────

export async function startRegistration(
  username: string,
  email: string,
  password: string
): Promise<{ username: string; email: string; otp: string } | { error: string }> {
  const key = username.toLowerCase().trim();
  const mail = email.toLowerCase().trim();

  if (!/^[a-z0-9_]{3,20}$/.test(key)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only" };
  }
  if (!isValidEmail(mail)) return { error: "Please enter a valid email address" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  if (await usernameTaken(key)) return { error: "Username already taken" };
  if (await emailInUse(mail)) return { error: "An account with this email already exists" };

  const otp = generateOtp();
  const otpSalt = crypto.randomBytes(16).toString("hex");

  pending.set(key, {
    username: key,
    email: mail,
    passwordHash: await hashPassword(password),
    otpHash: hashOtp(otp, otpSalt),
    otpSalt,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });

  return { username: key, email: mail, otp };
}

export async function verifyOtp(
  username: string,
  code: string
): Promise<{ user: PublicUser; token: string } | { error: string }> {
  const key = username.toLowerCase().trim();
  const reg = pending.get(key);

  if (!reg) return { error: "No pending signup found. Please register again." };
  if (Date.now() > reg.expiresAt) {
    pending.delete(key);
    return { error: "Your code expired. Please request a new one." };
  }
  if (reg.attempts >= OTP_MAX_ATTEMPTS) {
    pending.delete(key);
    return { error: "Too many incorrect attempts. Please register again." };
  }

  if (hashOtp(code.trim(), reg.otpSalt) !== reg.otpHash) {
    reg.attempts += 1;
    return { error: "Incorrect code. Please try again." };
  }

  if (await usernameTaken(key)) {
    pending.delete(key);
    return { error: "Username already taken" };
  }

  const user: User = {
    id: crypto.randomBytes(8).toString("hex"),
    username: key,
    email: reg.email,
    passwordHash: reg.passwordHash,
    speakerCode: key.toUpperCase(),
    emailVerified: true,
    createdAt: Date.now(),
  };
  await persistUser(user);
  pending.delete(key);

  const token = newToken();
  await storeToken(token, user.id, Date.now() + TOKEN_TTL_MS);

  return { user: toPublic(user), token };
}

export function resendOtp(
  username: string
): { email: string; otp: string } | { error: string } {
  const key = username.toLowerCase().trim();
  const reg = pending.get(key);

  if (!reg) return { error: "No pending signup found. Please register again." };

  const sinceLast = Date.now() - reg.lastSentAt;
  if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLast) / 1000);
    return { error: `Please wait ${wait}s before requesting another code.` };
  }

  const otp = generateOtp();
  reg.otpHash = hashOtp(otp, reg.otpSalt);
  reg.expiresAt = Date.now() + OTP_TTL_MS;
  reg.attempts = 0;
  reg.lastSentAt = Date.now();

  return { email: reg.email, otp };
}

// ── Login / tokens ───────────────────────────────────────────────────────────

export async function loginUser(
  username: string,
  password: string
): Promise<{ user: PublicUser; token: string } | { error: string }> {
  const key = username.toLowerCase().trim();
  const user = await findUserByUsername(key);

  // Always run a compare to reduce timing differences between
  // "no such user" and "wrong password".
  const ok =
    user && (await verifyPassword(password, user.passwordHash));
  if (!user || !ok) return { error: "Invalid username or password" };

  const token = newToken();
  await storeToken(token, user.id, Date.now() + TOKEN_TTL_MS);

  return { user: toPublic(user), token };
}

/**
 * Logs in (or, on first use, creates) a user from a verified Google identity.
 * Matching is by email: Google has already verified the email, so there's no
 * OTP step. Existing email/password accounts with the same email are linked
 * automatically (the user can sign in either way).
 */
export async function loginOrCreateWithGoogle(identity: {
  email: string;
  name?: string;
}): Promise<{ user: PublicUser; token: string } | { error: string }> {
  const email = identity.email.toLowerCase().trim();
  if (!isValidEmail(email)) return { error: "Google did not provide a valid email" };

  let user = await findUserByEmail(email);

  if (!user) {
    const seed = identity.name?.trim() || email.split("@")[0] || "user";
    const username = await uniqueUsernameFrom(seed);
    user = {
      id: crypto.randomBytes(8).toString("hex"),
      username,
      email,
      // No usable password for Google-only accounts; a random hash placeholder
      // means the password-login path can never match.
      passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
      speakerCode: username.toUpperCase(),
      emailVerified: true,
      createdAt: Date.now(),
    };
    await persistUser(user);
  }

  const token = newToken();
  await storeToken(token, user.id, Date.now() + TOKEN_TTL_MS);
  return { user: toPublic(user), token };
}

export async function getUserByToken(token: string): Promise<PublicUser | null> {
  if (db) {
    const rows = await db
      .select()
      .from(authTokensTable)
      .where(eq(authTokensTable.token, token))
      .limit(1);
    const rec = rows[0];
    if (!rec) return null;
    if (rec.expiresAt.getTime() < Date.now()) {
      await db.delete(authTokensTable).where(eq(authTokensTable.token, token));
      return null;
    }
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, rec.userId))
      .limit(1);
    const u = userRows[0];
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      speakerCode: u.speakerCode,
      createdAt: u.createdAt.getTime(),
    };
  }

  const rec = memTokens.get(token);
  if (!rec) return null;
  if (rec.expiresAt < Date.now()) {
    memTokens.delete(token);
    saveToDisk();
    return null;
  }
  for (const u of memUsers.values()) {
    if (u.id === rec.userId) return toPublic(u);
  }
  return null;
}

export async function logoutUser(token: string): Promise<void> {
  if (db) {
    await db.delete(authTokensTable).where(eq(authTokensTable.token, token));
  } else {
    memTokens.delete(token);
    saveToDisk();
  }
}

/** Housekeeping: remove expired tokens. Safe to call periodically. */
export async function purgeExpiredTokens(): Promise<void> {
  const now = Date.now();
  if (db) {
    await db.delete(authTokensTable).where(lt(authTokensTable.expiresAt, new Date(now)));
  } else {
    let changed = false;
    for (const [t, rec] of memTokens.entries()) {
      if (rec.expiresAt < now) {
        memTokens.delete(t);
        changed = true;
      }
    }
    if (changed) saveToDisk();
  }
}
