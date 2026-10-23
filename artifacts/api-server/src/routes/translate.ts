import { Router } from "express";
import OpenAI from "openai";
import { toFile } from "openai";
import { addTranslationToSession } from "../store/sessions";

// ── Translation provider ──────────────────────────────────────────────────
// Groq (free tier) is OpenAI-compatible, so the same SDK works by pointing it
// at Groq's base URL. Switch providers with TRANSLATION_PROVIDER in .env.
const PROVIDER = (process.env["TRANSLATION_PROVIDER"] ?? "openai").toLowerCase();

const PROVIDERS = {
  groq: {
    apiKey: process.env["GROQ_API_KEY"],
    baseURL: "https://api.groq.com/openai/v1",
    transcribeModel: "whisper-large-v3-turbo",
    translateModel: "openai/gpt-oss-120b",
  },
  openai: {
    apiKey: process.env["OPENAI_API_KEY"],
    baseURL: undefined,
    transcribeModel: "gpt-4o-mini-transcribe",
    translateModel: "gpt-4o-mini",
  },
} as const;

const active = PROVIDERS[PROVIDER as keyof typeof PROVIDERS] ?? PROVIDERS.openai;

const openai = new OpenAI({
  apiKey: active.apiKey,
  ...(active.baseURL ? { baseURL: active.baseURL } : {}),
});

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

// Whisper tends to "hallucinate" stock phrases on silent/near-silent audio —
// most commonly subtitle credits it learned from training data. These are not
// real speech, so we discard them instead of transcribing/saving them.
const HALLUCINATION_PATTERNS: RegExp[] = [
  /ترجمة/i, // "translation by ..." (Arabic subtitle credits, e.g. نانسي قنقر)
  /اشترك.*القناة/i, // "subscribe to the channel"
  /ترجمة نانسي قنقر/i,
  /^thank you( for watching)?\.?$/i,
  /^thanks for watching\.?$/i,
  /^please subscribe\.?$/i,
  /^subtitles? by/i,
  /^amara\.org/i,
  /^\s*\.{2,}\s*$/, // just dots
  /^[\s.。،,!?-]+$/, // only punctuation/whitespace
];

function isHallucination(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;
  return HALLUCINATION_PATTERNS.some((re) => re.test(t));
}

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
      model: active.transcribeModel,
      language: fromLang,
      response_format: "json",
      // A low temperature makes Whisper less likely to invent text on silence.
      temperature: 0,
    });

    const original = transcriptionResponse.text?.trim();

    // Drop empty results and known hallucinations (subtitle credits, etc.) so
    // they never get translated, saved, or broadcast to listeners.
    if (!original || isHallucination(original)) {
      res.json({ original: "", translated: "" });
      return;
    }

    const translationResponse = await openai.chat.completions.create({
      model: active.translateModel,
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
      await addTranslationToSession(sessionCode, original, translated);
    }

    res.json({ original, translated });
  } catch (err: unknown) {
    req.log.error({ err }, "Translation error");

    // Surface a clear, actionable message and a flag telling the client
    // whether retrying is pointless (billing/auth/config problems).
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: string }).code
        : undefined;

    let message = "Translation failed. Please try again.";
    let fatal = false;

    if (code === "credit_balance_exhausted" || code === "insufficient_quota") {
      message = "The translation service has no credits left. Check the provider billing.";
      fatal = true;
    } else if (status === 401 || status === 403) {
      message = "The translation service rejected the API key. Check your configuration.";
      fatal = true;
    } else if (status === 429) {
      message = "Rate limit reached. Please wait a moment and try again.";
      fatal = true;
    }

    res.status(status === 429 ? 429 : 500).json({ error: message, fatal });
  }
});

export default router;
