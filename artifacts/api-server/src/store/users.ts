import crypto from "crypto";
import fs from "fs";
import path from "path";

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
  salt: string;
  token: string | null;
  emailVerified: boolean;
}

/** A signup awaiting email OTP verification (not yet a real account). */
interface PendingRegistration {
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const users = new Map<string, User>();
const tokens = new Map<string, string>();
// Keyed by username. Pending signups live in memory only until verified.
const pending = new Map<string, PendingRegistration>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const OTP_MAX_ATTEMPTS = 5;

// ── Persistence ──────────────────────────────────────────────────────────────

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const list: User[] = JSON.parse(raw);
    for (const user of list) {
      // Backward compatibility for records saved before email verification existed
      if (user.email === undefined) user.email = "";
      if (user.emailVerified === undefined) user.emailVerified = true;
      users.set(user.username, user);
      if (user.token) tokens.set(user.token, user.username);
    }
  } catch {
    // ignore corrupt file — start fresh
  }
}

function saveToDisk(): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify([...users.values()], null, 2), "utf8");
  } catch {
    // ignore write errors
  }
}

// Load on startup
loadFromDisk();

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
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
  // 6-digit numeric code, zero-padded.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function isValidEmail(email: string): boolean {
  // Simple, pragmatic email check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function emailInUse(email: string): boolean {
  const target = email.toLowerCase().trim();
  for (const u of users.values()) {
    if (u.email.toLowerCase() === target) return true;
  }
  return false;
}

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Step 1 of signup. Validates the input, stores a pending registration with a
 * freshly generated OTP, and returns the plaintext OTP so the caller can email
 * it. No real account exists until verifyOtp succeeds.
 */
export function startRegistration(
  username: string,
  email: string,
  password: string
): { username: string; email: string; otp: string } | { error: string } {
  const key = username.toLowerCase().trim();
  const mail = email.toLowerCase().trim();

  if (!/^[a-z0-9_]{3,20}$/.test(key)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only" };
  }
  if (!isValidEmail(mail)) return { error: "Please enter a valid email address" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  if (users.has(key)) return { error: "Username already taken" };
  if (emailInUse(mail)) return { error: "An account with this email already exists" };

  const salt = crypto.randomBytes(16).toString("hex");
  const otp = generateOtp();

  pending.set(key, {
    username: key,
    email: mail,
    passwordHash: hashPassword(password, salt),
    salt,
    otpHash: hashPassword(otp, salt),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now(),
  });

  return { username: key, email: mail, otp };
}

/**
 * Step 2 of signup. Checks the OTP for a pending registration and, on success,
 * promotes it to a real verified account and logs the user in.
 */
export function verifyOtp(
  username: string,
  code: string
): { user: PublicUser; token: string } | { error: string } {
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

  const submittedHash = hashPassword(code.trim(), reg.salt);
  if (submittedHash !== reg.otpHash) {
    reg.attempts += 1;
    return { error: "Incorrect code. Please try again." };
  }

  // Guard against a race where the username got taken while pending.
  if (users.has(key)) {
    pending.delete(key);
    return { error: "Username already taken" };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const user: User = {
    id: crypto.randomBytes(8).toString("hex"),
    username: key,
    email: reg.email,
    passwordHash: reg.passwordHash,
    salt: reg.salt,
    speakerCode: key.toUpperCase(),
    token,
    emailVerified: true,
    createdAt: Date.now(),
  };

  users.set(key, user);
  tokens.set(token, key);
  pending.delete(key);
  saveToDisk();

  return { user: toPublic(user), token };
}

/**
 * Regenerates and returns a new OTP for an existing pending registration,
 * subject to a short resend cooldown.
 */
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
  reg.otpHash = hashPassword(otp, reg.salt);
  reg.expiresAt = Date.now() + OTP_TTL_MS;
  reg.attempts = 0;
  reg.lastSentAt = Date.now();

  return { email: reg.email, otp };
}

export function loginUser(
  username: string,
  password: string
): { user: PublicUser; token: string } | { error: string } {
  const key = username.toLowerCase().trim();
  const user = users.get(key);

  if (!user) return { error: "Invalid username or password" };

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { error: "Invalid username or password" };

  if (user.token) tokens.delete(user.token);

  const token = crypto.randomBytes(32).toString("hex");
  user.token = token;
  tokens.set(token, key);
  saveToDisk();

  return { user: toPublic(user), token };
}

export function getUserByToken(token: string): PublicUser | null {
  const username = tokens.get(token);
  if (!username) return null;
  const user = users.get(username);
  if (!user) return null;
  return toPublic(user);
}

export function logoutUser(token: string): void {
  const username = tokens.get(token);
  if (username) {
    const user = users.get(username);
    if (user) user.token = null;
    tokens.delete(token);
    saveToDisk();
  }
}
