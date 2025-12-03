import { PrismaClient } from "../generated/prisma";

/**
 * Singleton pattern for PrismaClient.
 * This ensures that in development, a single instance of PrismaClient is reused across hot reloads,
 * preventing multiple connections to the database. In production, a new instance is created on each deployment.
 */
const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  // eslint-disable-next-line no-var
  var _prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis._prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis._prisma = prisma;

export default prisma;

