const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const connectDB = require('../db');
const getHealth = require('../utils/health');

test('health reports ready only for a connected MongoDB state', () => {
  assert.deepEqual(getHealth(1), { statusCode: 200, body: { status: 'ok' } });
});

for (const state of [0, 2, 3]) {
  test(`health reports unavailable for MongoDB state ${state}`, () => {
    assert.deepEqual(getHealth(state), { statusCode: 503, body: { status: 'unavailable' } });
  });
}

test('health reflects disconnect and reconnect without caching readiness', () => {
  for (const state of [1, 0, 2, 1]) {
    assert.deepEqual(getHealth(state), state === 1
      ? { statusCode: 200, body: { status: 'ok' } }
      : { statusCode: 503, body: { status: 'unavailable' } });
  }
  for (const state of [undefined, null, '1', -1]) {
    assert.deepEqual(getHealth(state), { statusCode: 503, body: { status: 'unavailable' } });
  }
});

test('connectDB awaits mongoose.connect and logs success', async t => {
  const previousUri = process.env.MONGO_URI;
  process.env.MONGO_URI = 'mongodb://fixture.invalid/readiness-test';
  t.after(() => {
    if (previousUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = previousUri;
  });
  const calls = [];
  const connect = t.mock.method(mongoose, 'connect', async uri => {
    assert.equal(uri, 'mongodb://fixture.invalid/readiness-test');
    await Promise.resolve();
    calls.push('connected');
  });
  t.mock.method(console, 'log', message => calls.push(message));
  await assert.doesNotReject(connectDB());
  assert.equal(connect.mock.callCount(), 1);
  assert.deepEqual(calls, ['connected', 'MongoDB connected']);
});

test('connectDB propagates failure without terminating the process', async t => {
  const failure = new Error('Mock database connection failure');
  const connect = t.mock.method(mongoose, 'connect', async () => { throw failure; });
  const exit = t.mock.method(process, 'exit', () => {
    assert.fail('connectDB must leave termination to bootstrap');
  });
  const log = t.mock.method(console, 'log', () => {});
  await assert.rejects(connectDB(), error => error === failure);
  assert.equal(connect.mock.callCount(), 1);
  assert.equal(exit.mock.callCount(), 0);
  assert.equal(log.mock.callCount(), 0);
});

test('bootstrap awaits database, then seeding, before its only listen call', () => {
  // Read source only: importing index.js would initialize the production runtime.
  const source = readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  const startup = source.match(/async function startServer\(\) \{([\s\S]*?)\n\}/);
  assert.ok(startup, 'an asynchronous startup boundary must exist');
  assert.match(startup[1], /await connectDB\(\);\s*await seedDefaultGroups\(\);\s*http\.listen\(/);
  for (const call of [/connectDB\(\)/g, /seedDefaultGroups\(\);/g, /http\.listen\(/g]) {
    assert.equal([...source.matchAll(call)].length, 1, 'no independent initialization/listen calls');
  }
  assert.match(source, /startServer\(\)\.catch\(\(\) => \{[\s\S]*?console\.error\('[^'\n]+'\);\s*process\.exit\(1\);\s*\}\);/);
});
