import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GetApiKeysParams {
  cursor?: string;
  limit?: number;
}

interface GetApiKeysResult {
  apiKeys: {
    id: string;
    address: string;
  }[];
  nextCursor?: string;
}

export async function getApiKeys(params: GetApiKeysParams): Promise<GetApiKeysResult> {
  const { cursor, limit = 10 } = params;

  const findManyArgs: any = {
    take: limit + 1, // Fetch one more to check for next cursor
    orderBy: {
      id: 'asc',
    },
  };

  if (cursor) {
    findManyArgs.cursor = {
      id: cursor,
    };
    findManyArgs.skip = 1; // Skip the cursor itself
  }

  const apiKeys = await prisma.token.findMany({
    ...findManyArgs,
    select: {
      id: true,
      address: true,
    },
  });

  let nextCursor: string | undefined = undefined;
  if (apiKeys.length > limit) {
    const lastApiKey = apiKeys.pop();
    nextCursor = lastApiKey?.id;
  }

  return {
    apiKeys,
    nextCursor,
  };
}
