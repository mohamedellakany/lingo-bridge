import { Router } from "express";
import OpenAI from "openai";
import { toFile } from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import { addTranslationToSession } from "../store/sessions";

const router: Router = Router();

const MIME_TYPES: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  aac: "audio/aac",
};

router.post("/translate", async (req, res) => {
  const { audio, format, fromLang, toLang, fromLangName, toLangName, sessionCode } =
    req.body as {
      audio: string;
      format: string;
      fromLang: string;
      toLang: string;
      fromLangName: string;
      toLangName: string;
      sessionCode?: string;
    };

  if (!audio || !fromLang || !toLang) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const audioBuffer = Buffer.from(audio, "base64");
    const ext = format ?? "m4a";
    const mimeType = MIME_TYPES[ext] ?? "audio/mp4";

    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, `audio.${ext}`, { type: mimeType }),
      model: "gpt-4o-mini-transcribe",
      language: fromLang,
      response_format: "json",
    });

    const original = transcriptionResponse.text?.trim();

    if (!original || original.length < 2) {
      res.json({ original: "", translated: "" });
      return;
    }

    const translationResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a professional interpreter. Translate the following text from ${fromLangName} to ${toLangName}. Return ONLY the translation with no explanations, notes, or extra text.`,
        },
        { role: "user", content: original },
      ],
    });

    const translated =
      translationResponse.choices[0]?.message?.content?.trim() ?? "";

    if (sessionCode) {
      addTranslationToSession(sessionCode, original, translated);
    }

    res.json({ original, translated });
  } catch (err: unknown) {
    req.log.error({ err }, "Translation error");
    res.status(500).json({ error: "Translation failed. Please try again." });
  }
});

export default router;
