// src/utils/telemetry.test.ts

import { recordLatency, getLatencyMetrics, resetLatencyMetrics } from './telemetry';

describe('Telemetry Metrics', () => {
  beforeEach(() => {
    resetLatencyMetrics();
  });

  it('should record latency for a single endpoint', () => {
    recordLatency('GET:/test', 50);
    const metrics = getLatencyMetrics();

    expect(metrics).toHaveProperty('GET:/test');
    expect(metrics['GET:/test'].count).toBe(1);
    expect(metrics['GET:/test'].sum).toBe(50);
    expect(metrics['GET:/test'].min).toBe(50);
    expect(metrics['GET:/test'].max).toBe(50);
    expect(metrics['GET:/test'].mean).toBe(50);
    expect(metrics['GET:/test'].buckets['50']).toBe(1);
  });

  it('should record multiple latencies for the same endpoint', () => {
    recordLatency('GET:/test', 10);
    recordLatency('GET:/test', 100);
    recordLatency('GET:/test', 20);
    const metrics = getLatencyMetrics();

    expect(metrics['GET:/test'].count).toBe(3);
    expect(metrics['GET:/test'].sum).toBe(130);
    expect(metrics['GET:/test'].min).toBe(10);
    expect(metrics['GET:/test'].max).toBe(100);
    expect(metrics['GET:/test'].mean).toBe(130 / 3);
    expect(metrics['GET:/test'].buckets['10']).toBe(1);
    expect(metrics['GET:/test'].buckets['25']).toBe(1);
    expect(metrics['GET:/test'].buckets['100']).toBe(1);
  });

  it('should record latencies for different endpoints', () => {
    recordLatency('GET:/test1', 50);
    recordLatency('POST:/test2', 200);
    const metrics = getLatencyMetrics();

    expect(metrics).toHaveProperty('GET:/test1');
    expect(metrics).toHaveProperty('POST:/test2');
    expect(metrics['GET:/test1'].count).toBe(1);
    expect(metrics['POST:/test2'].count).toBe(1);
  });

  it('should correctly categorize latencies into buckets', () => {
    recordLatency('GET:/bucket-test', 1);
    recordLatency('GET:/bucket-test', 2);
    recordLatency('GET:/bucket-test', 3);
    recordLatency('GET:/bucket-test', 6);
    recordLatency('GET:/bucket-test', 51);
    const metrics = getLatencyMetrics();

    const buckets = metrics['GET:/bucket-test'].buckets;
    expect(buckets['1']).toBe(1);
    expect(buckets['2']).toBe(1);
    expect(buckets['5']).toBe(1);
    expect(buckets['10']).toBe(1);
    expect(buckets['50']).toBe(0); // 50ms should have 0 as 51 is the next bucket.
    expect(buckets['100']).toBe(1);

  });

  it('should handle zero or negative latencies gracefully', () => {
    recordLatency('GET:/zero-latency', 0);
    const metrics = getLatencyMetrics();
    expect(metrics['GET:/zero-latency'].min).toBe(0);
    expect(metrics['GET:/zero-latency'].buckets['1']).toBe(1);
  });

  it('should reset metrics correctly', () => {
    recordLatency('GET:/test', 10);
    resetLatencyMetrics();
    const metrics = getLatencyMetrics();
    expect(Object.keys(metrics).length).toBe(0);
  });
});
