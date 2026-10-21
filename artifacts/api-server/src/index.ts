import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import { purgeExpiredTokens } from "./store/users";
import { isDatabaseConfigured } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    { port, database: isDatabaseConfigured ? "postgres" : "in-memory/json" },
    "Server listening",
  );
});

// Attach the realtime WebSocket server to the same HTTP server.
initRealtime(server);

// Periodically clean up expired auth tokens (hourly).
setInterval(() => {
  purgeExpiredTokens().catch((err) =>
    logger.error({ err }, "Token purge failed"),
  );
}, 60 * 60 * 1000);
