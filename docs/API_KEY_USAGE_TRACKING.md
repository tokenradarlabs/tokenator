# API Key Usage Tracking

This document outlines the API key usage tracking mechanism implemented in the Tokenator project.

## Purpose

The primary purpose of API key usage tracking is to monitor the activity of individual API keys. This data can be used for:

*   **Analytics:** Understanding API usage patterns.
*   **Rate Limiting:** Implementing fair usage policies and preventing abuse.
*   **Security:** Detecting unusual activity associated with a specific API key.

## Database Schema

Two new models have been introduced in `prisma/schema.prisma` to facilitate API key usage tracking:

### `ApiKey` Model

This model stores information about each API key.

```prisma
model ApiKey {
  id          String      @id @default(uuid())
  key         String      @unique
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  usageCount  Int         @default(0)
  usages      ApiKeyUsage[]
}
```

**Fields:**

*   `id`: Unique identifier for the API key.
*   `key`: The actual API key string. This field is unique to ensure no duplicate keys.
*   `createdAt`: Timestamp when the API key was created.
*   `updatedAt`: Timestamp when the API key was last updated.
*   `usageCount`: An integer representing the total number of times this API key has been used. Defaults to 0.
*   `usages`: A relation to the `ApiKeyUsage` model, representing all individual usage events for this API key.

### `ApiKeyUsage` Model

This model records each instance of an API key being used.

```prisma
model ApiKeyUsage {
  id        String    @id @default(uuid())
  apiKeyId  String
  apiKey    ApiKey    @relation(fields: [apiKeyId], references: [id])
  timestamp DateTime  @default(now())

  @@index([apiKeyId])
  @@index([timestamp])
}
```

**Fields:**

*   `id`: Unique identifier for the usage event.
*   `apiKeyId`: The ID of the `ApiKey` that was used.
*   `apiKey`: A relation to the `ApiKey` model.
*   `timestamp`: Timestamp when the API key usage occurred. Indexed for efficient time-based queries.

## Usage Tracking Mechanism

Whenever an API key is successfully authenticated and used for an operation, the following actions should be performed:

1.  **Increment `usageCount`:** The `usageCount` field of the corresponding `ApiKey` record should be incremented by 1.
2.  **Create `ApiKeyUsage` record:** A new `ApiKeyUsage` record should be created, linking to the `ApiKey` and recording the current timestamp.

These operations ensure both an aggregated count and a detailed log of API key usage are maintained, allowing for flexible querying and analysis.