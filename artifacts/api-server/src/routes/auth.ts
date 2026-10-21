import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getUserByToken,
  loginOrCreateWithGoogle,
  loginUser,
  logoutUser,
  resendOtp,
  startRegistration,
  verifyOtp,
} from "../store/users";
import { sendOtpEmail } from "../lib/email";
import { logger } from "../lib/logger";

// Allowed Google OAuth client IDs (web, iOS, Android). An ID token's audience
// must match one of these. Comma-separated in GOOGLE_CLIENT_IDS.
const GOOGLE_CLIENT_IDS = (process.env["GOOGLE_CLIENT_IDS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface GoogleTokenInfo {
  aud: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  exp?: string;
}

/**
 * Verifies a Google ID token by calling Google's tokeninfo endpoint, then
 * checks the audience is one of our configured client IDs and the email is
 * verified. Returns the identity or an error string.
 */
async function verifyGoogleIdToken(
  idToken: string
): Promise<{ email: string; name?: string } | { error: string }> {
  if (GOOGLE_CLIENT_IDS.length === 0) {
    return { error: "Google sign-in is not configured on the server." };
  }
  try {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!resp.ok) return { error: "Invalid Google token" };
    const info = (await resp.json()) as GoogleTokenInfo;

    if (!GOOGLE_CLIENT_IDS.includes(info.aud)) {
      return { error: "Google token was issued for a different app" };
    }
    const verified = info.email_verified === true || info.email_verified === "true";
    if (!info.email || !verified) {
      return { error: "Google account email is not verified" };
    }
    return { email: info.email, name: info.name };
  } catch {
    return { error: "Could not verify Google sign-in. Please try again." };
  }
}

const router: Router = Router();

// Throttle sensitive auth endpoints to slow down brute-force and abuse.
// Limits are per-IP within the window.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 20, // register / verify / resend combined
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

// Step 1: start signup. Validates input, creates a pending registration, and
// emails a one-time code. The account is not created until the code is verified.
router.post("/auth/register", otpLimiter, async (req, res) => {
  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };

  if (!username || !email || !password) {
    res.status(400).json({ error: "Username, email and password are required" });
    return;
  }

  const result = await startRegistration(username, email, password);
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  try {
    await sendOtpEmail(result.email, result.otp);
  } catch (err) {
    logger.error({ err }, "Failed to send OTP email");
    res.status(502).json({ error: "Could not send the verification email. Please try again." });
    return;
  }

  // Never return the OTP itself to the client.
  res.json({ pending: true, username: result.username, email: result.email });
});

// Step 2: verify the emailed code and complete signup (logs the user in).
router.post("/auth/verify-otp", otpLimiter, async (req, res) => {
  const { username, code } = req.body as {
    username?: string;
    code?: string;
  };

  if (!username || !code) {
    res.status(400).json({ error: "Username and code are required" });
    return;
  }

  const result = await verifyOtp(username, code);
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// Resend a fresh code for a pending signup.
router.post("/auth/resend-otp", otpLimiter, async (req, res) => {
  const { username } = req.body as { username?: string };

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const result = resendOtp(username);
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  try {
    await sendOtpEmail(result.email, result.otp);
  } catch (err) {
    logger.error({ err }, "Failed to resend OTP email");
    res.status(502).json({ error: "Could not send the verification email. Please try again." });
    return;
  }

  res.json({ ok: true });
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const result = await loginUser(username, password);
  if ("error" in result) {
    res.status(401).json(result);
    return;
  }

  res.json(result);
});

// Sign in (or auto-register) with a verified Google ID token.
router.post("/auth/google", loginLimiter, async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: "Missing Google token" });
    return;
  }

  const identity = await verifyGoogleIdToken(idToken);
  if ("error" in identity) {
    res.status(401).json(identity);
    return;
  }

  const result = await loginOrCreateWithGoogle(identity);
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

router.get("/auth/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  res.json({ user });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) await logoutUser(token);
  res.json({ ok: true });
});

export default router;
