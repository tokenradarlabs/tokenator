// src/plugins/requestTiming.test.ts

import { FastifyInstance } from 'fastify';
import { requestTiming } from './requestTiming';
import { recordLatency, resetLatencyMetrics } from '../utils/telemetry';

// Mock Fastify application and reply objects
const mockApp = {
  addHook: jest.fn(),
} as unknown as FastifyInstance;

// Mock the telemetry module
jest.mock('../utils/telemetry', () => ({
  recordLatency: jest.fn(),
  resetLatencyMetrics: jest.fn(),
  getLatencyMetrics: jest.fn(),
}));

describe('requestTiming plugin', () => {
  beforeAll(async () => {
    await requestTiming(mockApp);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetLatencyMetrics();
  });

  it('should add onRequest and onResponse hooks', () => {
    expect(mockApp.addHook).toHaveBeenCalledTimes(2);
    expect(mockApp.addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
    expect(mockApp.addHook).toHaveBeenCalledWith('onResponse', expect.any(Function));
  });

  it('should record request start time on onRequest hook', async () => {
    const onRequestHook = mockApp.addHook.mock.calls[0][1];
    const mockRequest = {} as any;
    const mockReply = {} as any;

    await onRequestHook(mockRequest, mockReply);

    expect(mockRequest.requestStartTime).toBeDefined();
    expect(typeof mockRequest.requestStartTime).toBe('number');
  });

  it('should record latency on onResponse hook', async () => {
    const onResponseHook = mockApp.addHook.mock.calls[1][1];
    const mockRequest = {
      method: 'GET',
      url: '/test-url',
      requestStartTime: Date.now() - 100, // Simulate a 100ms response time
    } as any;
    const mockReply = {} as any;

    await onResponseHook(mockRequest, mockReply);

    expect(recordLatency).toHaveBeenCalledTimes(1);
    expect(recordLatency).toHaveBeenCalledWith('GET:/test-url', expect.any(Number));
    const recordedDuration = (recordLatency as jest.Mock).mock.calls[0][1];
    expect(recordedDuration).toBeGreaterThanOrEqual(99); // Should be around 100ms
    expect(recordedDuration).toBeLessThanOrEqual(101);
  });
});
