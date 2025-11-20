import supertest from 'supertest';
import { buildApp } from './app';
import jwt from 'jsonwebtoken';
import config from './config';

// Mock the logger to prevent console output during tests
jest.mock('./utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('App Middleware Ordering and Functionality', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(() => {
    app = buildApp();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 for the health check endpoint', async () => {
    const response = await request.get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('should return 401 for protected route without token', async () => {
    const response = await request.get('/protected');
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized: No token provided.' });
  });

  it('should return 401 for protected route with invalid token', async () => {
    const response = await request
      .get('/protected')
      .set('Authorization', 'Bearer invalidtoken');
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized: Invalid token.' });
  });

  it('should return 200 for protected route with valid token', async () => {
    const userId = 'testuser123';
    const token = jwt.sign({ id: userId }, config.JWT_SECRET);

    const response = await request
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'This is a protected route',
      user: { id: userId },
    });
  });
});
