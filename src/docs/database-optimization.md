# Database Optimization for Tokenator

This document outlines frequent Prisma queries, recommended database indexes, and general query performance tips for the Tokenator application.

## Frequent Queries and Analysis

Here's an analysis of the most frequently executed Prisma queries across the application, particularly focusing on `src/cron/priceUpdateJob.ts` and `src/lib/alertcommands/`.

### 1. Alert Retrieval and Filtering

**Query Examples:**
- `prisma.alert.findMany({ where: { enabled: true }, include: { token: true } })` (in `cleanupOrphanedAlerts`)
- `tx.alert.findMany({ where: { enabled: true, tokenId: token.id, ... }, include: { priceAlert: true, token: true } })` (in `checkPriceAlertsWithTransaction`, `checkVolumeAlertsWithTransaction`)
- `prisma.alert.findMany({ where: { discordServerId, channelId, ... }, include: { priceAlert: true, volumeAlert: true, token: true } })` (in `listAlerts`, `disableAlert`, `enableAlert`, `deleteAlert`)

**Analysis:**
These queries are central to the application's functionality, fetching alerts based on various criteria (enabled status, token ID, Discord server/channel, alert type, cooldown status). The `include` statements for `token`, `priceAlert`, and `volumeAlert` are common.

### 2. Token Price and Volume Retrieval

**Query Examples:**
- `prisma.tokenPrice.findFirst({ where: { token: { address: standardizedId } }, orderBy: { timestamp: 'desc' } })` (in `getLatestTokenPriceFromDatabase`, `getLatestTokenPriceWithMetadata`)
- `prisma.tokenVolume.findFirst({ where: { token: { address: tokenId } }, orderBy: { timestamp: 'desc' } })` (in `getTokenVolumeByTimeframe`)
- `prisma.tokenVolume.findMany({ where: { token: { address: tokenId } }, orderBy: { timestamp: 'desc' }, take: limit })` (in `getTokenVolumeHistory`)

**Analysis:**
These queries are crucial for fetching the latest price and volume data for tokens, often ordered by timestamp.

### 3. Alert Updates (Status and Cooldown)

**Query Examples:**
- `tx.alert.updateMany({ where: { id: alert.id, ... }, data: { lastTriggered: now } })` (in `checkPriceAlertsWithTransaction`, `checkVolumeAlertsWithTransaction`)
- `prisma.alert.updateMany({ where: { id: { in: alertIds } }, data: { enabled: false } })` (in `disableAlert`)
- `prisma.alert.updateMany({ where: { id: { in: alertIds } }, data: { enabled: true, lastTriggered: null } })` (in `enableAlert`)

**Analysis:**
These queries update the status (`enabled`) and `lastTriggered` timestamp of alerts. Batch updates (`updateMany`) are now used where N+1 patterns were identified.

### 4. Upsert Operations (DiscordServer, Token)

**Query Examples:**
- `tx.discordServer.upsert({ where: { id: guildId }, update: { name: guildName }, create: { id: guildId, name: guildName } })` (in `createPriceAlert`, `createVolumeAlert`)
- `tx.token.upsert({ where: { address: standardizedId }, update: {}, create: { address: standardizedId } })` (in `createPriceAlert`, `createVolumeAlert`, `upsertTokenPrice`)

**Analysis:**
These ensure that Discord servers and tokens exist in the database before related operations.

## Recommended Indexes

Based on the frequent queries, the following indexes are recommended to improve query performance. These should be added to your `prisma/schema.prisma` file.

### `Alert` Model

The `Alert` model is heavily queried.

-   **`discordServerId`, `channelId`, `tokenId`**: For filtering alerts by Discord context and token.
    ```prisma
    @@index([discordServerId, channelId, tokenId])
    ```
-   **`enabled`**: For filtering active alerts.
    ```prisma
    @@index([enabled])
    ```
-   **`lastTriggered`**: For cooldown checks.
    ```prisma
    @@index([lastTriggered])
    ```
-   **Combined index for `listAlerts` and `checkPriceAlertsWithTransaction`/`checkVolumeAlertsWithTransaction`**:
    ```prisma
    @@index([enabled, tokenId, lastTriggered])
    @@index([discordServerId, channelId, enabled, createdAt]) // For listAlerts orderBy and filtering
    ```

### `Token` Model

-   **`address`**: This is already a `@unique` field, which automatically creates an index. No additional index needed here.

### `TokenPrice` Model

-   **`tokenId`, `timestamp`**: For fetching the latest price of a specific token.
    ```prisma
    @@index([tokenId, timestamp(sort: Desc)])
    ```

### `TokenVolume` Model

-   **`tokenId`, `timestamp`**: For fetching the latest volume of a specific token.
    ```prisma
    @@index([tokenId, timestamp(sort: Desc)])
    ```

### `PriceAlert` and `VolumeAlert` Models

These models are typically accessed via their relationship to the `Alert` model. Indexes on their own fields might be less critical unless direct queries are performed on them without joining `Alert`.

-   **`alertId`**: This is already a `@unique` field, which automatically creates an index. No additional index needed here.

## Query Performance Tips

1.  **Monitor and Analyze:** Regularly use database monitoring tools (e.g., `pg_stat_statements` for PostgreSQL) to identify slow queries. Prisma's `log` option can also help in development.
2.  **Eager Loading (`include` / `select`):** Use `include` or `select` judiciously. While `include` is convenient, only fetch the data you truly need. Over-fetching can lead to larger payloads and slower queries.
3.  **Batch Operations:** As demonstrated in the N+1 fixes, use `updateMany`, `deleteMany`, and `createMany` for bulk operations instead of iterating and performing individual database calls.
4.  **Transactions:** Use Prisma's `$transaction` for operations that need to be atomic. This ensures data consistency but can also impact performance if transactions are very long or involve many locks. Keep transactions as short and focused as possible.
5.  **Filtering and Pagination:** Always apply appropriate `where` clauses and use `skip` and `take` for pagination to limit the result set size.
6.  **Database-Level Optimizations:**
    *   **Analyze and Vacuum:** Regularly `ANALYZE` your tables to update statistics for the query planner. `VACUUM` (or `AUTOVACUUM`) is essential for reclaiming space and improving performance in PostgreSQL.
    *   **Connection Pooling:** Ensure your application uses a connection pool (Prisma Client has one built-in) to efficiently manage database connections.
    *   **Hardware:** Scale your database hardware (CPU, RAM, I/O) as needed.
7.  **Review `schema.prisma`:** Periodically review your `schema.prisma` for opportunities to add or refine indexes as query patterns evolve.
8.  **Avoid N+1 Queries:** Always be vigilant for N+1 query patterns, especially when iterating over a result set and performing a database operation for each item. Use `include` for eager loading related data or batch operations for updates/deletes.
