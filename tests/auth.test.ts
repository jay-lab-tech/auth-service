import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { redis } from '../src/config/redis.js';

const email = `integration-${crypto.randomUUID()}@example.test`;
const password = 'TestPassword-NotForProduction-123!';
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  await prisma.$connect();
  if (redis.status === 'wait') await redis.connect();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) await prisma.user.delete({ where: { id: existing.id } });
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
  if (redis.status === 'ready') await redis.quit();
  else redis.disconnect();
});

test('authentication lifecycle: validation, register, login, /me, refresh rotation, logout', async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthenticated.status, 401);

  const invalid = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
  });
  assert.equal(invalid.status, 400);

  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Integration Test', email, password }),
  });
  assert.equal(registered.status, 201);
  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Integration Test', email, password }),
  });
  assert.equal(duplicate.status, 409);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginResponse.status, 200);
  const login = (await loginResponse.json() as { data: { accessToken: string; refreshToken: string; user: { email: string } } }).data;
  assert.equal(login.user.email, email);

  const forbidden = await fetch(`${baseUrl}/api/users`, {
    headers: { authorization: `Bearer ${login.accessToken}` },
  });
  assert.equal(forbidden.status, 403);
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  const adminUsers = await fetch(`${baseUrl}/api/users?page=1&limit=10`, {
    headers: { authorization: `Bearer ${login.accessToken}` },
  });
  assert.equal(adminUsers.status, 200);
  const adminLogs = await fetch(`${baseUrl}/api/audit-logs`, {
    headers: { authorization: `Bearer ${login.accessToken}` },
  });
  assert.equal(adminLogs.status, 200);
  const selfRoleChange = await fetch(`${baseUrl}/api/users/${(await prisma.user.findUniqueOrThrow({ where: { email } })).id}/role`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}` },
    body: JSON.stringify({ role: 'USER' }),
  });
  assert.equal(selfRoleChange.status, 400);

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { authorization: `Bearer ${login.accessToken}` },
  });
  assert.equal(meResponse.status, 200);

  const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: login.refreshToken }),
  });
  assert.equal(refreshResponse.status, 200);
  const rotated = (await refreshResponse.json() as { data: { accessToken: string; refreshToken: string } }).data;
  assert.notEqual(rotated.refreshToken, login.refreshToken);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${rotated.accessToken}` },
    body: JSON.stringify({ refreshToken: rotated.refreshToken }),
  });
  assert.equal(logout.status, 200);

  const afterLogout = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: rotated.refreshToken }),
  });
  assert.equal(afterLogout.status, 401);

  const replay = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: login.refreshToken }),
  });
  assert.equal(replay.status, 401);
});
