import { PrismaClient } from "../generated/prisma";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export default prisma;

async function gracefulShutdown() {
  await prisma.$disconnect();
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown); 