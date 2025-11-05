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

process.once("SIGINT", async () => {
  try {
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during Prisma disconnect on SIGINT:", error);
    process.exit(1);
  }
});

process.once("SIGTERM", async () => {
  try {
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during Prisma disconnect on SIGTERM:", error);
    process.exit(1);
  }
}); 