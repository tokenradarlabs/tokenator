import { PrismaClient } from "../generated/prisma";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var _prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis._prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export default prisma;

async function gracefulShutdown(exitCode: number) {
  try {
    await prisma.$disconnect();
    process.exit(exitCode);
  } catch (error) {
    console.error("Error during Prisma disconnect:", error);
    process.exit(1);
  }
}

process.once("SIGINT", () => gracefulShutdown(0));
process.once("SIGTERM", () => gracefulShutdown(0));

// The 'beforeExit' event is not suitable for asynchronous operations like prisma.$disconnect().
// For normal exits, Prisma client will be garbage collected and connections closed.
// SIGINT and SIGTERM handlers cover explicit termination signals.
// Therefore, an explicit 'beforeExit' listener for prisma.$disconnect() is intentionally omitted. 