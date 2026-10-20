import { Router } from "express";
import {
  getUserByToken,
  loginUser,
  logoutUser,
  resendOtp,
  startRegistration,
  verifyOtp,
} from "../store/users";
import { sendOtpEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: Router = Router();

// Step 1: start signup. Validates input, creates a pending registration, and
// emails a one-time code. The account is not created until the code is verified.
router.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };

  if (!username || !email || !password) {
    res.status(400).json({ error: "Username, email and password are required" });
    return;
  }

  const result = startRegistration(username, email, password);
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
router.post("/auth/verify-otp", (req, res) => {
  const { username, code } = req.body as {
    username?: string;
    code?: string;
  };

  if (!username || !code) {
    res.status(400).json({ error: "Username and code are required" });
    return;
  }

  const result = verifyOtp(username, code);
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// Resend a fresh code for a pending signup.
router.post("/auth/resend-otp", async (req, res) => {
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

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const result = loginUser(username, password);
  if ("error" in result) {
    res.status(401).json(result);
    return;
  }

  res.json(result);
});

router.get("/auth/me", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  res.json({ user });
});

router.post("/auth/logout", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) logoutUser(token);
  res.json({ ok: true });
});

export default router;
