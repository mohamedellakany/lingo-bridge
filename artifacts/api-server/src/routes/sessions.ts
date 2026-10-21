import { Router } from "express";
import {
  createSession,
  endSessionByCode,
  getSession,
  listSessionsByUser,
} from "../store/sessions";
import { getUserByToken } from "../store/users";

const router: Router = Router();

async function userIdFromReq(req: {
  headers: { authorization?: string };
}): Promise<string | null> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const user = await getUserByToken(token);
  return user?.id ?? null;
}

router.post("/sessions", async (req, res) => {
  const { code, fromLang, toLang, fromLangName, toLangName } = req.body as {
    code: string;
    fromLang: string;
    toLang: string;
    fromLangName: string;
    toLangName: string;
  };

  if (!code || !fromLang || !toLang) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Link the session to the speaker when authenticated, so it appears in
  // their server-synced history.
  const userId = await userIdFromReq(req);

  const session = await createSession({
    code,
    userId,
    fromLang,
    toLang,
    fromLangName,
    toLangName,
  });
  res.json(session);
});

// A speaker's own past sessions (server-synced history). Requires auth.
router.get("/sessions", async (req, res) => {
  const userId = await userIdFromReq(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const sessions = await listSessionsByUser(userId);
  res.json({ sessions });
});

router.get("/sessions/:code", async (req, res) => {
  const session = await getSession(req.params.code);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.post("/sessions/:code/end", async (req, res) => {
  await endSessionByCode(req.params.code);
  res.json({ ok: true });
});

export default router;
