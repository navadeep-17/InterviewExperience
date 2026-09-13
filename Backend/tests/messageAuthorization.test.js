const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const messagesRouter = require('../routes/messages');
const groupRouter = require('../routes/group');
const authRouter = require('../routes/auth');

const a = '111111111111111111111111';
const b = '222222222222222222222222';
const c = '333333333333333333333333';
const groupId = '444444444444444444444444';
const messageId = '555555555555555555555555';
const selected = value => ({ select: () => Promise.resolve(value) });

function request(server, method, url, body, token = a) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method, headers }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

// Exercise real Express routes and authMiddleware, with only JWT/DB calls mocked.
// No server bootstrap, dotenv loading, MongoDB connection, or external services.
test('HTTP messaging authorization acceptance matrix', async t => {
  const previous = process.env.ALLOWED_EMAIL_DOMAINS;
  process.env.ALLOWED_EMAIL_DOMAINS = 'mgit.ac.in';
  t.after(() => {
    if (previous === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
    else process.env.ALLOWED_EMAIL_DOMAINS = previous;
  });
  t.mock.method(jwt, 'verify', token => {
    if (![a, b, c].includes(token)) throw new Error('Invalid fixture token');
    return { _id: token, name: 'Stale JWT name', email: 'stale@example.com' };
  });
  t.mock.method(User, 'findById', id => selected({
    _id: id, name: 'Current DB name', email: 'student@mgit.ac.in', department: 'CSE', isVerified: true,
  }));
  // Fail unexpected DB operations immediately, rather than queueing MongoDB work.
  const guards = [];
  for (const model of [Message, GroupMessage, Group]) {
    for (const method of ['find', 'findOne', 'findById', 'countDocuments', 'create', 'deleteOne', 'updateMany', 'findByIdAndDelete']) {
      guards.push(t.mock.method(model, method, () => { throw new Error('Unexpected DB operation'); }));
    }
  }
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messagesRouter);
  app.use('/api/groups', groupRouter);
  app.use('/api/auth', authRouter);
  app.use((req, res) => res.status(404).json({ message: 'Not found' }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const send = (...args) => request(server, ...args);

  for (const [method, url, body] of [
    ['GET', '/api/messages/' + b], ['DELETE', '/api/messages/' + messageId],
    ['POST', '/api/messages/markAsRead', { senderId: b }], ['GET', '/api/groups'],
    ['GET', '/api/groups/' + groupId + '/messages'],
    ['POST', '/api/groups/' + groupId + '/messages', { content: 'hello' }],
    ['DELETE', '/api/groups/messages/' + messageId],
  ]) {
    await t.test('unauthenticated ' + method + ' ' + url + ' is rejected', async () => {
      assert.equal((await send(method, url, body, null)).status, 401);
    });
  }

  for (const [method, url, body] of [
    ['GET', '/api/messages/invalid'], ['DELETE', '/api/messages/invalid'],
    ['GET', '/api/groups/invalid/messages'], ['POST', '/api/groups/invalid/messages', { content: 'hello' }],
    ['DELETE', '/api/groups/messages/invalid'],
  ]) {
    await t.test('malformed ID: ' + method + ' ' + url, async () => {
      assert.equal((await send(method, url, body)).status, 400);
    });
  }
  for (const senderId of [undefined, null, '', 'bad', b + '\n', { $ne: null }, [b], 123]) {
    await t.test('mark-as-read rejects malformed sender: ' + JSON.stringify(senderId), async () => {
      assert.equal((await send('POST', '/api/messages/markAsRead', { senderId })).status, 400);
    });
  }

  function conversation(t, rows) {
    const expected = { $or: [{ senderId: a, recipientId: b }, { senderId: b, recipientId: a }] };
    const calls = {};
    const matched = filter => rows.filter(row => filter.$or.some(pair =>
      row.senderId === pair.senderId && row.recipientId === pair.recipientId));
    t.mock.method(Message, 'countDocuments', async filter => {
      assert.deepEqual(filter, expected);
      return matched(filter).length;
    });
    t.mock.method(Message, 'find', filter => {
      assert.deepEqual(filter, expected);
      const chain = {
        sort(order) { calls.sort = order; return this; },
        skip(n) { calls.skip = n; return this; },
        limit(n) { calls.limit = n; return this; },
        populate(field, projection) { assert.equal(field, 'senderId'); assert.equal(projection, 'name avatar'); return this; },
        async lean() {
          return matched(filter).sort((x, y) => y.timestamp - x.timestamp)
            .slice(calls.skip, calls.skip + calls.limit).map(row => ({
              ...row, senderId: { _id: row.senderId, name: 'Safe Name', avatar: 'safe.svg' },
            }));
        },
      };
      return chain;
    });
    return calls;
  }
  const history = Array.from({ length: 45 }, (_, i) => ({
    _id: String(i + 1).padStart(24, '0'), senderId: i % 2 ? a : b,
    recipientId: i % 2 ? b : a, content: 'Message ' + i, timestamp: i,
  }));
  for (const [label, query, skip, limit, count, first, hasMore] of [
    ['defaults', '', 0, 20, 20, 25, true],
    ['second page', '?page=2&limit=20', 20, 20, 20, 5, true],
    ['last page', '?page=3&limit=20', 40, 20, 5, 0, false],
    ['past end', '?page=4&limit=20', 60, 20, 0, undefined, false],
    ['custom page size', '?page=2&limit=5', 5, 5, 5, 35, true],
    ['cap at 50', '?limit=100', 0, 50, 45, 0, false],
  ]) {
    await t.test('conversation pagination: ' + label, async t => {
      const calls = conversation(t, history);
      const result = await send('GET', '/api/messages/' + b + query);
      assert.equal(result.status, 200);
      assert.deepEqual(calls, { sort: { timestamp: -1, _id: -1 }, skip, limit });
      assert.equal(result.body.hasMore, hasMore);
      assert.equal(result.body.messages.length, count);
      if (count) {
        assert.equal(result.body.messages[0].timestamp, first);
        assert.ok(result.body.messages.every((row, i, rows) => !i || rows[i - 1].timestamp < row.timestamp));
        assert.equal(result.body.messages[0].senderName, 'Safe Name');
        assert.equal(result.body.messages[0].senderAvatar, 'safe.svg');
        assert.equal(typeof result.body.messages[0].senderId, 'string');
      }
    });
  }
  await t.test('arbitrary participant parameters cannot expose B-to-C conversation', async t => {
    conversation(t, [...history, { _id: messageId, senderId: b, recipientId: c, content: 'Private B-C', timestamp: 100 }]);
    const result = await send('GET', '/api/messages/' + b + '?senderId=' + b + '&recipientId=' + c);
    assert.equal(result.status, 200);
    assert.equal(result.body.messages.some(row => row.content === 'Private B-C'), false);
  });
  await t.test('empty conversation and exact page boundary have no more results', async t => {
    conversation(t, []);
    assert.deepEqual((await send('GET', '/api/messages/' + b)).body, { messages: [], hasMore: false });
    conversation(t, history.slice(0, 20));
    assert.equal((await send('GET', '/api/messages/' + b)).body.hasMore, false);
  });
  for (const key of ['page', 'limit']) {
    for (const value of ['1abc', '-1', '0', 'NaN', '', '1.5', '1e2', '1%0A', 'Infinity', '9007199254740992']) {
      await t.test('reject malformed ' + key + '=' + value, async () => {
        assert.equal((await send('GET', '/api/messages/' + b + '?' + key + '=' + value)).status, 400);
      });
    }
    for (const query of [key + '=1&' + key + '=2', key + '[$ne]=1', key + '[]=1']) {
      await t.test('reject nonscalar pagination: ' + query, async () => {
        assert.equal((await send('GET', '/api/messages/' + b + '?' + query)).status, 400);
      });
    }
  }
  await t.test('pagination rejects unsafe skip arithmetic', async () => {
    assert.equal((await send('GET', '/api/messages/' + b + '?page=9007199254740991&limit=20')).status, 400);
  });
  await t.test('route IDs reject encoded trailing newlines and query operators', async () => {
    for (const id of [a + '%0A', '%7B%22%24ne%22%3Anull%7D']) {
      for (const [method, url] of [
        ['GET', '/api/messages/' + id], ['DELETE', '/api/messages/' + id],
        ['GET', '/api/groups/' + id + '/messages'], ['POST', '/api/groups/' + id + '/messages'],
        ['DELETE', '/api/groups/messages/' + id],
      ]) assert.equal((await send(method, url, { content: 'hello' })).status, 400);
    }
  });

  // Same sender-only policy for personal and group deletion, including former members.
  for (const [label, model, url] of [
    ['personal', Message, '/api/messages/' + messageId],
    ['group', GroupMessage, '/api/groups/messages/' + messageId],
  ]) {
    for (const [role, actor, status] of [['sender', a, 200], ['recipient/member', b, 403], ['third party/nonmember', c, 403]]) {
      await t.test(label + ' deletion by ' + role, async t => {
        let stored = new model({ _id: messageId, senderId: a, recipientId: b, groupId, content: 'hello' });
        t.mock.method(model, 'findById', id => {
          assert.equal(id, messageId);
          return { select(fields) { assert.equal(fields, 'senderId'); return Promise.resolve(stored); } };
        });
        const deletion = t.mock.method(model, 'deleteOne', async filter => {
          assert.deepEqual(filter, { _id: messageId, senderId: a });
          stored = null;
          return { deletedCount: 1 };
        });
        const result = await send('DELETE', url, { senderId: actor, recipientId: actor, role: 'admin' }, actor);
        assert.equal(result.status, status);
        assert.equal(deletion.mock.callCount(), actor === a ? 1 : 0);
        assert.equal(stored === null, actor === a);
        if (actor === a) assert.deepEqual(result.body, { success: true });
      });
    }
    await t.test(label + ' missing message returns 404 without deletion', async t => {
      t.mock.method(model, 'findById', () => selected(null));
      assert.equal((await send('DELETE', url)).status, 404);
    });
    await t.test(label + ' concurrent removal returns 404', async t => {
      t.mock.method(model, 'findById', () => selected({ senderId: a }));
      t.mock.method(model, 'deleteOne', async () => ({ deletedCount: 0 }));
      assert.equal((await send('DELETE', url)).status, 404);
    });
  }
  await t.test('former group member can still delete their own message', async t => {
    t.mock.method(GroupMessage, 'findById', () => selected({ senderId: a }));
    t.mock.method(GroupMessage, 'deleteOne', async () => ({ deletedCount: 1 }));
    // Group DB guard must not be called: deletion depends only on sender ownership.
    assert.equal((await send('DELETE', '/api/groups/messages/' + messageId)).status, 200);
  });

  await t.test('mark-as-read ignores malicious recipient and only changes authenticated recipient records', async t => {
    const rows = [
      { senderId: b, recipientId: a, isRead: false },
      { senderId: b, recipientId: c, isRead: false },
      { senderId: c, recipientId: a, isRead: false },
      { senderId: b, recipientId: a, isRead: true },
    ];
    t.mock.method(Message, 'updateMany', async (filter, update) => {
      assert.deepEqual(filter, { senderId: b, recipientId: a, isRead: false });
      assert.deepEqual(update, { $set: { isRead: true } });
      let modifiedCount = 0;
      rows.forEach(row => {
        if (Object.entries(filter).every(([key, value]) => row[key] === value)) {
          row.isRead = true; modifiedCount++;
        }
      });
      return { modifiedCount, acknowledged: true, internal: 'hidden' };
    });
    const result = await send('POST', '/api/messages/markAsRead', { senderId: b, recipientId: c });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { success: true, modifiedCount: 1 });
    assert.deepEqual(rows.map(row => row.isRead), [true, false, false, true]);
  });
  await t.test('mark-as-read accepts only senderId and reports zero changes', async t => {
    t.mock.method(Message, 'updateMany', async filter => {
      assert.deepEqual(filter, { senderId: b, recipientId: a, isRead: false });
      return { modifiedCount: 0 };
    });
    assert.deepEqual((await send('POST', '/api/messages/markAsRead', { senderId: b })).body,
      { success: true, modifiedCount: 0 });
  });

  function membership(t, member) {
    return t.mock.method(Group, 'findOne', filter => {
      assert.deepEqual(filter, { _id: groupId, members: a });
      return { select(fields) { assert.equal(fields, '_id'); return Promise.resolve(member ? { _id: groupId } : null); } };
    });
  }
  await t.test('group list remains scoped to authenticated membership', async t => {
    t.mock.method(Group, 'find', async filter => {
      assert.deepEqual(filter, { members: a });
      return [{ _id: groupId }];
    });
    assert.deepEqual((await send('GET', '/api/groups')).body, [{ _id: groupId }]);
  });
  await t.test('current member can read messages with safe sender presentation', async t => {
    const lookup = membership(t, true);
    t.mock.method(GroupMessage, 'find', filter => {
      assert.equal(lookup.mock.callCount(), 1);
      assert.deepEqual(filter, { groupId });
      return {
        sort(order) { assert.equal(order, 'timestamp'); return this; },
        populate(field, projection) { assert.equal(field, 'senderId'); assert.equal(projection, 'name avatar'); return this; },
        async lean() { return [{ _id: messageId, content: 'hello', senderId: { _id: a, name: 'DB name', avatar: 'db.svg' } }]; },
      };
    });
    const result = await send('GET', '/api/groups/' + groupId + '/messages');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, [{ _id: messageId, content: 'hello', senderId: a, senderName: 'DB name', senderAvatar: 'db.svg' }]);
  });
  for (const method of ['GET', 'POST']) {
    await t.test('nonmember cannot ' + method + ' group messages; no message lookup/write', async t => {
      membership(t, false);
      assert.equal((await send(method, '/api/groups/' + groupId + '/messages', { content: 'hello', senderId: b })).status, 403);
    });
  }
  await t.test('group send rechecks membership each request and ignores spoofed sender/timestamp', async t => {
    let member = true;
    t.mock.method(Group, 'findOne', filter => {
      assert.deepEqual(filter, { _id: groupId, members: a });
      return selected(member ? { _id: groupId } : null);
    });
    const create = t.mock.method(GroupMessage, 'create', async data => {
      assert.deepEqual(data, { groupId, senderId: a, content: 'hello' });
      return new GroupMessage(data);
    });
    const body = { content: 'hello', senderId: b, senderName: 'Victim', timestamp: '1900-01-01' };
    const result = await send('POST', '/api/groups/' + groupId + '/messages', body);
    assert.equal(result.status, 200);
    assert.equal(result.body.senderId, a);
    assert.equal(result.body.senderName, undefined);
    assert.ok(new Date(result.body.timestamp).getFullYear() > 1900);
    member = false;
    assert.equal((await send('POST', '/api/groups/' + groupId + '/messages', body)).status, 403);
    assert.equal(create.mock.callCount(), 1);
  });
  for (const content of [undefined, null, '', ' \n\t', {}, [], 123]) {
    await t.test('group send rejects invalid content: ' + JSON.stringify(content), async () => {
      assert.equal((await send('POST', '/api/groups/' + groupId + '/messages', { content })).status, 400);
    });
  }
  for (const [method, url] of [
    ['GET', '/api/auth/messages/' + b], ['DELETE', '/api/auth/messages/' + messageId],
    ['GET', '/api/messages/messages/' + b], ['DELETE', '/api/messages/messages/' + messageId],
  ]) {
    await t.test('obsolete route is absent: ' + method + ' ' + url, async () => {
      assert.equal((await send(method, url)).status, 404);
      assert.equal((await send(method, url, undefined, null)).status, 404);
    });
  }
  for (const [label, model, method, verb, url, body] of [
    ['conversation count', Message, 'countDocuments', 'GET', '/api/messages/' + b],
    ['personal owner lookup', Message, 'findById', 'DELETE', '/api/messages/' + messageId],
    ['read update', Message, 'updateMany', 'POST', '/api/messages/markAsRead', { senderId: b }],
    ['group read membership', Group, 'findOne', 'GET', '/api/groups/' + groupId + '/messages'],
    ['group send membership', Group, 'findOne', 'POST', '/api/groups/' + groupId + '/messages', { content: 'hello' }],
    ['group owner lookup', GroupMessage, 'findById', 'DELETE', '/api/groups/messages/' + messageId],
  ]) {
    await t.test('database failure is bounded: ' + label, async t => {
      t.mock.method(model, method, () => {
        if (['findById', 'findOne'].includes(method)) {
          return { select: () => Promise.reject(new Error('private-database-detail')) };
        }
        return Promise.reject(new Error('private-database-detail'));
      });
      const result = await send(verb, url, body);
      assert.equal(result.status, 500);
      assert.equal(JSON.stringify(result.body).includes('private-'), false);
      assert.equal(Object.keys(result.body).length, 1);
    });
  }
  await t.test('index has no standalone mark-as-read handler or Message import', () => {
    const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
    assert.equal(source.includes('markAsRead'), false);
    assert.equal(source.includes("require('./models/Message')"), false);
    assert.ok(source.includes("app.use('/api/messages', messagesRouter)"));
  });
  // Guards are only invoked by bugs; expected failures use explicit per-test mocks.
  assert.equal(guards.reduce((sum, guard) => sum + guard.mock.callCount(), 0), 0);
});
