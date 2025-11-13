# CoinGecko API Rate Limiting, Caching, and Cooldown

This document outlines the rate limiting policies, caching mechanisms, and cooldown periods associated with the CoinGecko API, which are crucial for efficient and responsible usage.

## Rate Limits

CoinGecko API rate limits vary based on the subscription plan:

*   **Free Demo API Plan:**
    *   **Rate Limit:** 30 calls per minute.
    *   **Monthly Quota:** 10,000 calls.
*   **Paid Plans (Pro API):**
    *   **Rate Limit:** Ranges from 500 to 1,000 calls per minute, depending on the specific plan.
    *   **Enterprise Plans:** Offer even higher, custom limits.

**Important Considerations:**
*   All API requests, including those resulting in 4xx or 5xx errors, count towards your minute rate limit.
*   To avoid hitting rate limits, it is highly recommended to:
    *   Implement efficient coding practices, such as batching multiple requests when possible.
    *   Utilize caching mechanisms to store data locally and reduce the frequency of API calls.

## Caching Mechanism and Cooldown Periods

CoinGecko API endpoints are subject to caching, meaning that data updates are not instantaneous. The cooldown periods (cache duration) vary by endpoint and subscription level:

*   **Most Endpoints (Free & Paid):** Cached for approximately 1 to 5 minutes. This implies that data can be expected to update within these intervals.
*   **Pro API (Paid Plans) - `simple/price` endpoint:** Updates can be as frequent as every 30 seconds.
*   **Pro API (Paid Plans) - Selected On-Chain Endpoints:** As of September 2, 2025, the edge cache duration for these endpoints was reduced from 30 seconds to 10 seconds, providing quicker access to more up-to-date data.

When implementing features that rely on CoinGecko data, consider these caching durations to ensure your application displays reasonably fresh data without unnecessarily burdening the API and hitting rate limits.