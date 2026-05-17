import crypto from "crypto";
import fs from "fs";
import path from "path";

// process.cwd() is artifacts/api-server/ when the server starts
const DATA_FILE = path.join(process.cwd(), "data", "users.json");

export interface PublicUser {
  id: string;
  username: string;
  speakerCode: string;
  createdAt: number;
}

interface User extends PublicUser {
  passwordHash: string;
  salt: string;
  token: string | null;
}

const users = new Map<string, User>();
const tokens = new Map<string, string>();

// ── Persistence ──────────────────────────────────────────────────────────────

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const list: User[] = JSON.parse(raw);
    for (const user of list) {
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
  return { id: user.id, username: user.username, speakerCode: user.speakerCode, createdAt: user.createdAt };
}

// ── API ───────────────────────────────────────────────────────────────────────

export function registerUser(
  username: string,
  password: string
): { user: PublicUser; token: string } | { error: string } {
  const key = username.toLowerCase().trim();

  if (!/^[a-z0-9_]{3,20}$/.test(key)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only" };
  }
  if (users.has(key)) return { error: "Username already taken" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };

  const salt = crypto.randomBytes(16).toString("hex");
  const token = crypto.randomBytes(32).toString("hex");

  const user: User = {
    id: crypto.randomBytes(8).toString("hex"),
    username: key,
    passwordHash: hashPassword(password, salt),
    salt,
    speakerCode: key.toUpperCase(),
    token,
    createdAt: Date.now(),
  };

  users.set(key, user);
  tokens.set(token, key);
  saveToDisk();

  return { user: toPublic(user), token };
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
