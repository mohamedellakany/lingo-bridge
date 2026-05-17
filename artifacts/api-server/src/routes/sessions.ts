import { Router } from "express";
import { createSession, getSession } from "../store/sessions";

const router: Router = Router();

router.post("/sessions", (req, res) => {
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

  const session = createSession({ code, fromLang, toLang, fromLangName, toLangName });
  res.json(session);
});

router.get("/sessions/:code", (req, res) => {
  const session = getSession(req.params.code);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

export default router;
