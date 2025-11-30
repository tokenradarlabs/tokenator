# Telemetry and Latency Metrics

This document outlines the telemetry data collected for API endpoint latencies, including histogram metrics for response times.

## Endpoint Latency Metrics

Endpoint latency is measured for each API request and recorded as a histogram. This provides a distribution of response times rather than just averages, allowing for better insight into performance variability.

### Metrics Collected

For each unique endpoint (identified by `HTTP_METHOD:URL_PATH`), the following metrics are collected:

-   **`count`**: The total number of requests to the endpoint.
-   **`sum`**: The sum of all response times for the endpoint (in milliseconds).
-   **`min`**: The minimum response time recorded for the endpoint (in milliseconds).
-   **`max`**: The maximum response time recorded for the endpoint (in milliseconds).
-   **`mean`**: The average response time for the endpoint (calculated as `sum / count`) (in milliseconds).
-   **`buckets`**: A key-value map representing the histogram buckets. The keys are the upper bounds of the latency buckets (in milliseconds), and the values are the number of requests that fall into that bucket.

    The predefined latency buckets are (in milliseconds): `[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]`.
    For example, a `buckets` entry like `"50": 120` means 120 requests completed in 50ms or less.

### How to Access

The aggregated latency metrics can be accessed programmatically via the `getLatencyMetrics()` function in `src/utils/telemetry.ts`.

```typescript
import { getLatencyMetrics } from '../utils/telemetry';

const metrics = getLatencyMetrics();
console.log(metrics);
// Example output:
// {
//   "GET:/api/v1/price": {
//     "count": 150,
//     "sum": 7500,
//     "min": 10,
//     "max": 150,
//     "mean": 50,
//     "buckets": {
//       "1": 5,
//       "2": 10,
//       "5": 20,
//       "10": 30,
//       "25": 40,
//       "50": 35,
//       "100": 10,
//       "250": 0,
//       "500": 0,
//       "1000": 0,
//       "2500": 0,
//       "5000": 0,
//       "10000": 0
//     }
//   },
//   "POST:/api/v1/alert": {
//     "count": 20,
//     "sum": 1000,
//     "min": 30,
//     "max": 80,
//     "mean": 50,
//     "buckets": { /* ... */ }
//   }
// }
```
