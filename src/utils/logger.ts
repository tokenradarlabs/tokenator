import pino from "pino";

const { BETTERSTACK_TOKEN, PINO_LOG_LEVEL } = process.env;

const defaultLevel = PINO_LOG_LEVEL || "info";

let transport;

if (BETTERSTACK_TOKEN) {
  transport = pino.transport({
    targets: [
      {
        target: "@logtail/pino",
        options: { sourceToken: BETTERSTACK_TOKEN },
        level: defaultLevel,
      },
      {
        target: "pino/file", // stdout
        options: { destination: 1 }, // 1 = stdout
        level: defaultLevel,
      },
    ],
  });
} else {
  // Default to stdout (JSON) if no BetterStack token
  transport = pino.transport({
    target: "pino/file", // stdout
    options: { destination: 1 }, // 1 = stdout
    level: defaultLevel,
  });
}

const logger = pino(
  {
    level: defaultLevel,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport,
);

export const createContextualLogger = (context: {
  userId?: string;
  guildId?: string;
  channelId?: string;
  commandName?: string;
}) => {
  return logger.child(context);
};

export default logger;
