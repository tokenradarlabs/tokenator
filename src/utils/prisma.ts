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
