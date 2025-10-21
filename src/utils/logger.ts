import pino from "pino";
import { isDevelopment } from "../config";

const { BETTERSTACK_TOKEN, PINO_LOG_LEVEL } = process.env;

let transport;

if (isDevelopment()) {
  transport = pino.transport({
    target: "pino-pretty",
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: "SYS:standard",
    },
  });
} else if (BETTERSTACK_TOKEN) {
  transport = pino.transport({
    targets: [
      {
        target: "@logtail/pino",
        options: { sourceToken: BETTERSTACK_TOKEN },
        level: PINO_LOG_LEVEL || "info",
      },
      {
        target: "pino/file", // stdout
        options: { destination: 1 }, // 1 = stdout
        level: PINO_LOG_LEVEL || "info",
      },
    ],
  });
} else {
  // Default to stdout if no BetterStack token and not in development
  transport = pino.transport({
    target: "pino/file", // stdout
    options: { destination: 1 }, // 1 = stdout
    level: PINO_LOG_LEVEL || "info",
  });
}

const logger = pino(
  {
    level: PINO_LOG_LEVEL || (isDevelopment() ? "debug" : "info"),
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport,
);

export default logger;
