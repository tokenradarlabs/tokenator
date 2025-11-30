// src/utils/telemetry.ts

interface Histogram {
  buckets: Map<number, number>;
  count: number;
  sum: number;
  min: number;
  max: number;
}

const latencyBuckets = [
  1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
]; // in milliseconds

const endpointLatencies: Map<string, Histogram> = new Map();

function createHistogram(): Histogram {
  const buckets = new Map<number, number>();
  latencyBuckets.forEach(bucket => buckets.set(bucket, 0));
  return {
    buckets,
    count: 0,
    sum: 0,
    min: Infinity,
    max: -Infinity,
  };
}

export function recordLatency(endpoint: string, duration: number): void {
  if (!endpointLatencies.has(endpoint)) {
    endpointLatencies.set(endpoint, createHistogram());
  }

  const histogram = endpointLatencies.get(endpoint)!;
  histogram.count++;
  histogram.sum += duration;
  histogram.min = Math.min(histogram.min, duration);
  histogram.max = Math.max(histogram.max, duration);

  for (const bucket of latencyBuckets) {
    if (duration <= bucket) {
      histogram.buckets.set(bucket, histogram.buckets.get(bucket)! + 1);
      break;
    }
  }
}

export function getLatencyMetrics(): Record<string, any> {
  const metrics: Record<string, any> = {};
  endpointLatencies.forEach((histogram, endpoint) => {
    metrics[endpoint] = {
      count: histogram.count,
      sum: histogram.sum,
      min: histogram.min === Infinity ? 0 : histogram.min,
      max: histogram.max === -Infinity ? 0 : histogram.max,
      mean: histogram.count > 0 ? histogram.sum / histogram.count : 0,
      buckets: Object.fromEntries(histogram.buckets),
    };
  });
  return metrics;
}

export function resetLatencyMetrics(): void {
  endpointLatencies.clear();
}
