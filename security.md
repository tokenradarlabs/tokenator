# Security Practices

This document outlines the security considerations and best practices implemented in the Tokenator project.

## 1. Environment Variables

- **Sensitive credentials** (e.g., `DISCORD_TOKEN`, `COINGECKO_API_KEY`, `BETTERSTACK_TOKEN`) are never hardcoded and must be provided via a `.env` file.
- The `.env` file is excluded from version control via `.gitignore`.

## 2. Database Security

- Uses **Prisma ORM** with PostgreSQL.
- All database access is performed via parameterized queries, reducing the risk of SQL injection.
- Models use UUIDs as primary keys for better security and uniqueness.
- Foreign key constraints are enforced for data integrity.

## 3. Permissions and Access Control

- **Bot commands** that modify alerts (create, edit, delete) require the user to be in a Discord server and channel.
- Replies with error messages if commands are attempted outside of a server context.
- Alert operations check that the alert belongs to the requesting server and channel before allowing edits or deletions.

## 4. Error Handling and Logging

- All major operations are wrapped in try/catch blocks.
- Errors are logged using the `pino` logger, with support for external log aggregation (e.g., BetterStack).
- Sensitive information is not logged.

## 5. API Key Management

- The bot will not start if required API keys (e.g., `DISCORD_TOKEN`, `COINGECKO_API_KEY`) are missing.
- API keys are only accessed via environment variables.

## 6. Data Validation

- All user input from Discord commands is validated for required fields and types.
- Only valid options are accepted for command parameters (e.g., token IDs, direction).

## 7. Principle of Least Privilege

- The bot only requests the minimum Discord permissions necessary for its operation (e.g., reading messages, sending messages, managing slash commands).

## 8. Rate Limiting and Abuse Prevention

- The codebase does not currently implement explicit rate limiting, but relies on Discord's built-in rate limits.
- Consider adding custom rate limiting for high-risk commands in the future.

## 9. Dependency Management

- All dependencies are managed via `package.json` and should be kept up to date to avoid known vulnerabilities.

## 10. Future Improvements

- Implement wallet linking with secure authentication.
- Add custom rate limiting and abuse detection.
- Regularly audit dependencies for vulnerabilities. 