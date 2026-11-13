import 'dotenv/config';
import request from 'supertest';

export const API_BASE_URL =
  process.env.INTEGRATION_TEST_BASE_URL ||
  `http://localhost:${process.env.PORT || 3000}`;

export function api(): ReturnType<typeof request> {
  return request(API_BASE_URL);
}
