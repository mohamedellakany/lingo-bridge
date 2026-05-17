import { Router } from "express";
import {
  getUserByToken,
  loginUser,
  logoutUser,
  registerUser,
} from "../store/users";

const router: Router = Router();

router.post("/auth/register", (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const result = registerUser(username, password);
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
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
