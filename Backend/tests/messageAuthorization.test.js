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
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = {};
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method, headers }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: text === '' ? undefined : JSON.parse(text), text });
        } catch (err) {
          reject(new Error(`Invalid JSON response (HTTP ${res.statusCode}): ${text}`, { cause: err }));
        }
      });
    });
    req.on('error', reject);
    if (payload !== null) req.end(payload);
    else req.end();
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
      ]) {
        const body = method === 'POST' ? { content: 'hello' } : undefined;
        assert.equal((await send(method, url, body)).status, 400);
      }
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
      const body = method === 'POST' ? { content: 'hello', senderId: b } : undefined;
      assert.equal((await send(method, '/api/groups/' + groupId + '/messages', body)).status, 403);
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

const vm = require('node:vm');
const messagingSource = file => fs.readFileSync(path.join(__dirname, '../../Frontend/interviewhub/src', file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const userB = { _id: b, name: 'Student B' };
const userC = { _id: c, name: 'Student C' };
const defaultResponse = (url, options) => {
  if (url === '/api/auth/all') return [{ _id: a }, userB, userC];
  if (url === '/api/groups') return [{ _id: groupId, name: 'Group' }];
  if (options.method) return { success: true };
  if (url.startsWith('/api/groups/')) return [];
  return { messages: [], hasMore: false };
};

// Execute the real hook with isolated transport, effect cleanup and virtual timers.
// This scheduler verifies hook contracts without introducing a React test dependency.
function messagingHarness(respond = defaultResponse, initialProps = {}) {
  const slots = []; const pendingEffects = []; const requests = []; const authFailures = [];
  const instances = []; const timers = new Map(); const debounces = [];
  let cursor = 0; let dirty = true; let data; let clock = 0; let nextTimer = 0;
  let props = { currentUser: { _id: a }, authToken: 'fixture', onSocketAuthFailure: () => authFailures.push(true), ...initialProps };
  const sameDeps = (left, right) => left && right && left.length === right.length && left.every((v, i) => Object.is(v, right[i]));
  const setTimer = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id; };
  const memo = (factory, deps) => {
    const index = cursor++;
    if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { value: factory(), deps };
    return slots[index].value;
  };
  const ctx = vm.createContext({
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useCallback: (fn, deps) => memo(() => fn, deps), useMemo: memo,
    useEffect(fn, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) {
        const cleanup = slots[index]?.cleanup;
        slots[index] = { deps, cleanup };
        pendingEffects.push({ index, fn, cleanup });
      }
    },
    setTimeout: setTimer,
    debounce(fn, delay) {
      let timer;
      const debounced = () => { timers.delete(timer); timer = setTimer(fn, delay); };
      debounced.cancel = () => { timers.delete(timer); debounced.cancelled = true; };
      debounces.push({ delay, fn: debounced }); return debounced;
    },
    API_BASE_URL: 'https://api.invalid',
    io(url, options) {
      const listeners = new Map();
      const socket = {
        url, options, listeners, connected: false, auth: {}, emitted: [], connections: [], disconnects: 0,
        on(event, fn) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); },
        off(event, fn) { assert.equal(typeof fn, 'function', 'cleanup removes its own named listener'); listeners.get(event)?.delete(fn); },
        emit(event, payload) { this.emitted.push({ event, payload }); },
        connect() { this.connections.push(plain(this.auth)); this.connected = true; },
        disconnect() { this.disconnects++; this.connected = false; },
      };
      instances.push(socket); return socket;
    },
    apiRequest: async (url, options = {}) => { requests.push({ url, ...options }); return respond(url, options); },
  });
  const source = messagingSource('hooks/useMessaging.js').replace(/^import .*;\r?\n/gm, '').replace('export default ', '');
  vm.runInContext(source + '\nglobalThis.mount = useMessaging;', ctx);
  const h = {
    instances, requests, authFailures, debounces,
    get data() { return data; }, get socket() { return instances[0]; },
    render(next = {}) { props = { ...props, ...next }; dirty = true; },
    receive(event, payload) { for (const fn of h.socket.listeners.get(event) || []) fn(payload); },
    advance(ms) {
      const end = clock + ms;
      while (true) {
        const entry = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        const [id, timer] = entry; clock = timer.at; timers.delete(id); timer.fn();
      }
      clock = end;
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    async flush() {
      for (let turn = 0; turn < 30; turn++) {
        if (dirty) { cursor = 0; dirty = false; data = ctx.mount(props); }
        const effects = pendingEffects.splice(0);
        effects.forEach(effect => effect.cleanup?.());
        effects.forEach(effect => { slots[effect.index].cleanup = effect.fn(); });
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty && pendingEffects.length === 0) return;
      }
      assert.fail('Messaging hook did not settle');
    },
  };
  return h;
}

test('messaging architecture keeps page policy and presentation separate from shared HTTP/socket transport', () => {
  const page = messagingSource('components/Message.jsx');
  const hook = messagingSource('hooks/useMessaging.js');
  assert.ok(page.includes("import useMessaging from '../hooks/useMessaging'"));
  assert.equal((page.match(/useMessaging\(/g) || []).length, 1);
  for (const component of ['ChatSidebar', 'MessageList', 'MessageComposer']) {
    assert.ok(page.includes(`import ${component} from './messages/${component}'`));
    assert.ok(page.includes(`<${component} `));
  }
  assert.equal(/apiRequest|socket\.\w+|socket.io-client|\/api\/(messages|groups|auth\/all)|receive_message|send_message/.test(page), false);
  assert.ok(hook.includes("import { API_BASE_URL, apiRequest } from '../services/apiClient'"));
  assert.ok(hook.includes("import io from 'socket.io-client'"));
  assert.ok(hook.includes("import debounce from 'lodash.debounce'"));
  assert.equal(/\bfetch\s*\(|\baxios\b|VITE_API_URL|Authorization|auth:\s*false|register_user|localStorage|useNavigate|useLocation|className/.test(hook), false);
  for (const file of ['ChatSidebar', 'MessageList', 'MessageComposer', 'ChatAvatar']) {
    const source = messagingSource(`components/messages/${file}.jsx`);
    assert.equal(/apiRequest|socket\.\w+|socket.io-client|useMessaging|useNavigate|useLocation|\bfetch\s*\(|\baxios\b|Authorization/.test(source), false);
  }
});

test('messaging creates one stable authenticated socket and cleans all listeners and debounce on unmount', async () => {
  const h = messagingHarness(); await h.flush();
  assert.equal(h.instances.length, 1); assert.equal(h.socket.url, 'https://api.invalid');
  assert.deepEqual(plain(h.socket.options), { autoConnect: false });
  assert.deepEqual(h.socket.connections, [{ token: 'fixture' }]);
  h.render({ currentUser: { _id: a } }); await h.flush();
  h.data.selectUser(userB); await h.flush(); h.data.selectGroup({ _id: groupId }); await h.flush();
  assert.equal(h.instances.length, 1); assert.equal(h.socket.connections.length, 1);
  assert.deepEqual([...h.socket.listeners.keys()].sort(), ['connect_error', 'receive_group_message', 'receive_message', 'typing']);
  for (const listeners of h.socket.listeners.values()) assert.equal(listeners.size, 1);
  h.unmount();
  for (const listeners of h.socket.listeners.values()) assert.equal(listeners.size, 0);
  assert.equal(h.socket.connected, false); assert.deepEqual(plain(h.socket.auth), {});
  assert.ok(h.debounces.every(debounce => debounce.fn.cancelled));
});

for (const code of ['UNAUTHORIZED', 'FORBIDDEN', 'SERVER_ERROR', undefined]) {
  test('messaging connect-error policy: ' + String(code), async () => {
    const h = messagingHarness(); await h.flush();
    h.receive('connect_error', code ? { data: { code } } : new Error('network'));
    const authError = ['UNAUTHORIZED', 'FORBIDDEN'].includes(code);
    assert.equal(h.authFailures.length, authError ? 1 : 0);
    assert.equal(h.socket.connected, !authError);
    assert.deepEqual(plain(h.socket.auth), authError ? {} : { token: 'fixture' });
    h.unmount();
  });
}

test('messaging missing token never connects; page retains missing-token and socket-auth session policy', async () => {
  const h = messagingHarness(defaultResponse, { authToken: null }); await h.flush();
  assert.equal(h.socket.connections.length, 0); h.unmount();
  const source = messagingSource('components/Message.jsx');
  const policy = source.slice(source.indexOf('  const handleSocketAuthFailure'), source.indexOf('\n\n  const data'));
  for (const authToken of [null, 'fixture']) {
    const removed = []; const redirects = [];
    const ctx = vm.createContext({ authToken, useCallback: fn => fn, useEffect: fn => fn(),
      localStorage: { removeItem: key => removed.push(key) }, navigate: (...args) => redirects.push(args) });
    vm.runInContext(policy + '\nglobalThis.fail = handleSocketAuthFailure;', ctx);
    assert.equal(redirects.length, authToken ? 0 : 1); assert.deepEqual(removed, []);
    redirects.length = 0; ctx.fail();
    assert.deepEqual(removed, ['authToken', 'user']); assert.equal(redirects[0][0], '/login'); assert.equal(redirects[0][1].replace, true);
  }
});

test('messaging personal receive keys counterpart, labels sender and deduplicates IDs and fallback tuples', async () => {
  const h = messagingHarness((url, options) => url.includes(`/api/messages/${c}?`) ? new Promise(() => {}) : defaultResponse(url, options));
  await h.flush(); h.data.selectUser(userB); await h.flush();
  const own = { _id: messageId, senderId: a, recipientId: b, content: 'own', timestamp: 't1' };
  const incoming = { senderId: b, recipientId: a, content: 'incoming', timestamp: 't2' };
  for (const payload of [own, own, incoming, incoming]) h.receive('receive_message', payload);
  h.receive('receive_message', { ...incoming, timestamp: 't3' });
  h.receive('receive_message', { ...incoming, senderId: c });
  await h.flush();
  assert.deepEqual(plain(h.data.currentMessages.map(m => m.sender)), ['me', 'them', 'them']);
  assert.equal(h.data.unreadCounts[b], 2); assert.equal(h.data.unreadCounts[c], 1);
  h.data.selectUser(userC); await h.flush();
  assert.equal(h.data.currentMessages.length, 1); assert.equal(h.data.currentMessages[0].senderId, c);
  h.unmount();
});

test('messaging group receive preserves ID and fallback duplicate protection without extra filtering', async () => {
  const h = messagingHarness(); await h.flush(); h.data.selectGroup({ _id: groupId }); await h.flush();
  const identified = { _id: messageId, senderId: a, groupId, content: 'hello', timestamp: 't1' };
  const fallback = { senderId: b, groupId, content: 'hello', timestamp: 't2' };
  for (const value of [identified, identified, fallback, fallback]) h.receive('receive_group_message', value);
  h.receive('receive_group_message', { ...fallback, senderId: c }); await h.flush();
  assert.equal(h.data.groupMessages.length, 3); h.unmount();
});

test('messaging send gates blank/disconnected/no selection and emits only server-authorized payload fields', async () => {
  const h = messagingHarness(); await h.flush();
  assert.equal(h.data.sendMessage('hello'), false);
  h.data.selectUser(userB); await h.flush();
  for (const text of ['', ' \n\t']) assert.equal(h.data.sendMessage(text), false);
  h.socket.connected = false; assert.equal(h.data.sendMessage('keep draft'), false);
  assert.equal(h.socket.emitted.length, 0);
  h.socket.connected = true; assert.equal(h.data.sendMessage('  hello  '), true);
  assert.deepEqual(plain(h.socket.emitted[0]), { event: 'send_message', payload: { recipientId: b, content: '  hello  ' } });
  assert.equal(h.data.currentMessages.length, 0, 'no optimistic insertion');
  h.data.selectGroup({ _id: groupId }); await h.flush();
  assert.equal(h.data.selectedUser, null); assert.equal(h.data.sendMessage('group'), true);
  assert.deepEqual(plain(h.socket.emitted[1]), { event: 'send_group_message', payload: { groupId, content: 'group' } });
  assert.equal(h.data.groupMessages.length, 0); h.unmount();
});

test('messaging typing emits personal-only after 400ms, cancels on selection cleanup and receives for 1500ms', async () => {
  const h = messagingHarness(); await h.flush(); h.data.selectUser(userB); await h.flush();
  h.data.emitTyping(); h.advance(200); h.data.emitTyping(); h.advance(399);
  assert.equal(h.socket.emitted.length, 0); h.advance(1);
  assert.deepEqual(plain(h.socket.emitted), [{ event: 'typing', payload: { to: b } }]);
  h.receive('typing', { from: c }); await h.flush(); assert.equal(h.data.isTyping, false);
  h.receive('typing', { from: b }); await h.flush(); assert.equal(h.data.isTyping, true);
  h.advance(1499); await h.flush(); assert.equal(h.data.isTyping, true);
  h.advance(1); await h.flush(); assert.equal(h.data.isTyping, false);
  h.data.emitTyping(); h.data.selectGroup({ _id: groupId }); await h.flush(); h.advance(400);
  h.data.emitTyping(); h.advance(400); assert.equal(h.socket.emitted.length, 1);
  h.receive('typing', { from: b }); await h.flush(); assert.equal(h.data.isTyping, false);
  h.data.selectUser(userB); await h.flush(); h.socket.connected = false; h.data.emitTyping(); h.advance(400);
  assert.equal(h.socket.emitted.length, 1); h.unmount();
});

test('messaging directories filter current user, validate arrays and preserve local HTTP failure policy', async () => {
  const h = messagingHarness(); await h.flush();
  assert.deepEqual(plain(h.data.users), [userB, userC]); assert.equal(h.data.groups[0]._id, groupId); h.unmount();
  const absent = messagingHarness(defaultResponse, { currentUser: null }); await absent.flush();
  assert.deepEqual(plain(absent.data.users), []); assert.equal(absent.requests.length, 0); absent.unmount();
  for (const scenario of ['malformed', 401, 403, 500]) {
    const failed = messagingHarness(() => { if (scenario === 'malformed') return {}; throw { status: scenario }; });
    await failed.flush(); assert.deepEqual(plain(failed.data.users), []); assert.deepEqual(plain(failed.data.groups), []);
    assert.deepEqual(failed.authFailures, []); failed.unmount();
  }
});

test('messaging page one replaces, older pages prepend with ID dedupe, and selection resets pagination', async () => {
  let pageOne = [{ _id: 'new', content: 'recent' }];
  let valid = true;
  const h = messagingHarness((url, options) => {
    if (!options.method && url.startsWith('/api/messages/')) {
      if (!valid) return new Promise(() => {});
      return { messages: url.includes('page=1&') ? pageOne : [{ _id: 'old' }, { _id: 'new', content: 'overlap' }], hasMore: url.includes('page=1&') };
    }
    return defaultResponse(url, options);
  });
  await h.flush(); h.data.selectUser(userB); await h.flush();
  assert.ok(h.requests.some(r => r.url === `/api/messages/${b}?page=1&limit=20`));
  assert.deepEqual(plain(h.data.currentMessages), pageOne); assert.equal(h.data.hasMore, true);
  h.data.loadMore(); await h.flush();
  assert.deepEqual(plain(h.data.currentMessages.map(m => m._id)), ['old', 'new']);
  assert.equal(h.data.currentMessages[1].content, 'recent'); assert.equal(h.data.hasMore, false);
  pageOne = [{ _id: 'replacement' }]; h.data.selectUser({ ...userB }); await h.flush();
  assert.equal(h.data.page, 1); assert.deepEqual(plain(h.data.currentMessages), pageOne);
  h.data.loadMore(); await h.flush(); valid = false; h.data.selectUser(userC); await h.flush();
  assert.equal(h.data.page, 1); assert.equal(h.data.hasMore, true); assert.equal(h.data.selectedGroup, null); h.unmount();
});

for (const response of [{}, { messages: {} , hasMore: false }, { messages: [], hasMore: 'false' }, null]) {
  test('messaging invalid conversation preserves loaded data: ' + JSON.stringify(response), async () => {
    let invalid = false;
    const h = messagingHarness((url, options) => !options.method && url.startsWith('/api/messages/')
      ? invalid ? response : { messages: [{ _id: messageId }], hasMore: true } : defaultResponse(url, options));
    await h.flush(); h.data.selectUser(userB); await h.flush(); invalid = true; h.data.loadMore(); await h.flush();
    assert.deepEqual(plain(h.data.currentMessages), [{ _id: messageId }]);
    assert.equal(h.data.hasMore, true); assert.equal(h.data.loadingMore, false); assert.deepEqual(h.authFailures, []); h.unmount();
  });
}

test('messaging ignores obsolete personal and group requests after selection cleanup and unmount', async () => {
  const deferred = new Map();
  const h = messagingHarness((url, options) => !options.method && /\/api\/(messages\/|groups\/.+\/messages)/.test(url)
    ? new Promise(resolve => deferred.set(url, resolve)) : defaultResponse(url, options));
  await h.flush(); h.data.selectUser(userB); await h.flush();
  h.data.selectUser(userC); await h.flush();
  deferred.get(`/api/messages/${c}?page=1&limit=20`)({ messages: [{ _id: 'current' }], hasMore: false }); await h.flush();
  deferred.get(`/api/messages/${b}?page=1&limit=20`)({ messages: [{ _id: 'obsolete' }], hasMore: true }); await h.flush();
  assert.deepEqual(plain(h.data.currentMessages), [{ _id: 'current' }]); assert.equal(h.data.hasMore, false);
  h.data.selectUser(userB); await h.flush(); assert.deepEqual(plain(h.data.currentMessages), [], 'obsolete B response was not stored');
  h.data.selectGroup({ _id: groupId }); await h.flush(); assert.equal(h.data.selectedUser, null);
  deferred.get(`/api/groups/${groupId}/messages`)([{ _id: 'first-group' }]); await h.flush();
  assert.equal(h.data.groupMessages[0]._id, 'first-group');
  h.data.selectGroup({ _id: 'second-group' }); await h.flush(); assert.deepEqual(plain(h.data.groupMessages), []);
  h.data.selectGroup({ _id: 'third-group' }); await h.flush();
  deferred.get('/api/groups/second-group/messages')([{ _id: 'obsolete-group' }]); await h.flush();
  assert.deepEqual(plain(h.data.groupMessages), []);
  h.unmount(); deferred.get('/api/groups/third-group/messages')([{ _id: 'after-unmount' }]);
  await new Promise(resolve => setImmediate(resolve)); await h.flush();
  assert.deepEqual(plain(h.data.groupMessages), []);
});

test('messaging unread counts and mark-as-read preserve sender-only payload and success/failure state', async () => {
  let finishRead;
  const h = messagingHarness((url, options) => url.endsWith('/markAsRead')
    ? new Promise((resolve, reject) => { finishRead = { resolve, reject }; }) : defaultResponse(url, options));
  await h.flush(); h.data.selectUser(userB); await h.flush();
  for (const msg of [
    { _id: 'unread', senderId: b, recipientId: a },
    { _id: 'read', senderId: b, recipientId: a, isRead: true },
    { _id: 'outgoing', senderId: a, recipientId: b },
    { _id: 'no-sender', recipientId: a },
  ]) h.receive('receive_message', msg);
  await h.flush(); assert.equal(h.data.unreadCounts[b], 1);
  const write = h.requests.find(r => r.url.endsWith('/markAsRead'));
  assert.equal(write.method, 'POST'); assert.deepEqual(plain(write.data), { senderId: b });
  finishRead.reject({ status: 401 }); await h.flush(); assert.equal(h.data.unreadCounts[b], 1);
  h.data.selectUser({ ...userB }); await h.flush();
  h.receive('receive_message', { _id: 'another', senderId: b, recipientId: a }); await h.flush();
  finishRead.resolve({ success: true }); await h.flush(); assert.equal(h.data.unreadCounts[b], 0);
  assert.deepEqual(h.authFailures, []); h.unmount();
});

for (const group of [false, true]) {
  test('messaging ' + (group ? 'group' : 'personal') + ' deletion updates local messages only after HTTP success', async () => {
    let finish;
    const rows = [{ _id: messageId }, { _id: 'keep' }];
    const h = messagingHarness((url, options) => {
      if (options.method === 'DELETE') return new Promise((resolve, reject) => { finish = { resolve, reject }; });
      if (!options.method && url.startsWith('/api/messages/')) return { messages: rows, hasMore: false };
      if (url.endsWith('/messages')) return rows;
      return defaultResponse(url, options);
    });
    await h.flush();
    if (group) h.data.selectGroup({ _id: groupId }); else h.data.selectUser(userB);
    await h.flush();
    const action = group ? 'handleDeleteGroupMessage' : 'handleDeleteMessage';
    const current = () => group ? h.data.groupMessages : h.data.currentMessages;
    let pending = h.data[action](messageId); await h.flush(); assert.equal(current().length, 2);
    finish.reject({ status: 403 }); await pending; await h.flush(); assert.equal(current().length, 2);
    pending = h.data[action](messageId); await h.flush(); assert.equal(current().length, 2);
    finish.resolve({ success: true }); await pending; await h.flush();
    assert.deepEqual(plain(current()), [{ _id: 'keep' }]); assert.deepEqual(h.authFailures, []);
    const writes = h.requests.filter(r => r.method === 'DELETE');
    assert.equal(writes[0].url, group ? `/api/groups/messages/${messageId}` : `/api/messages/${messageId}`);
    assert.equal(writes[0].data, undefined); h.unmount();
  });
}

test('messaging failed histories preserve loaded messages without invoking socket auth policy', async () => {
  let fail = false;
  const h = messagingHarness((url, options) => {
    if (!options.method && url.startsWith('/api/messages/')) {
      if (fail) throw { status: 401 };
      return { messages: [{ _id: messageId }], hasMore: true };
    }
    if (url.endsWith('/messages')) throw { status: 403 };
    return defaultResponse(url, options);
  });
  await h.flush(); h.data.selectUser(userB); await h.flush(); fail = true;
  h.data.loadMore(); await h.flush(); assert.equal(h.data.currentMessages[0]._id, messageId);
  h.data.selectGroup({ _id: groupId }); await h.flush(); assert.deepEqual(plain(h.data.groupMessages), []);
  assert.equal(h.data.loadingMore, false); assert.deepEqual(h.authFailures, []); h.unmount();
});

test('messaging presentation retains sidebar/search, date/group/tick/dropdown paths and composer contracts', () => {
  const sidebar = messagingSource('components/messages/ChatSidebar.jsx');
  for (const text of ['Search users...', 'Groups', 'Back to Dashboard', 'View Profile', 'onViewProfile(user._id)', "useState('')", 'user.name.toLowerCase().includes(search.toLowerCase())']) assert.ok(sidebar.includes(text));
  assert.ok(sidebar.includes('groups.map(group =>'));
  const list = messagingSource('components/messages/MessageList.jsx');
  for (const text of ['function getDateLabel', 'Today', 'Yesterday', 'toLocaleDateString()', 'dropdownOpen', 'SingleTick', 'DoubleTick seen={true}',
    'groupMessages.map', 'currentMessages.map', "window.addEventListener('click'", "window.removeEventListener('click'", 'isMe && msg._id', 'More options', 'Delete',
    'prevMsg.senderId === msg.senderId', 'toDateString() === new Date(msg.timestamp).toDateString()', "hour: '2-digit', minute: '2-digit'", 'is typing...',
    'messagesContainerRef.current.scrollTop === 0', 'hasMore &&', '!loadingMore', "scrollIntoView({ behavior: 'smooth' })"]) assert.ok(list.includes(text), text);
  const composer = messagingSource('components/messages/MessageComposer.jsx');
  for (const text of ["useState('')", 'Type a message...', "e.key === 'Enter' && handleSend()", 'onClick={handleSend}', 'disabled={!newMessage.trim()}', 'if (personal) onTyping()', 'if (!visible) return null']) assert.ok(composer.includes(text));
  let state = 'keep draft'; let sent = false; const received = [];
  const prefix = composer.replace(/^import .*;\r?\n/gm, '').replace('export default ', '').split('  if (!visible)')[0];
  const ctx = vm.createContext({ useState: () => [state, value => { state = value; }] });
  vm.runInContext(prefix + '\nreturn { handleSend }; }\nglobalThis.mount = MessageComposer;', ctx);
  const onSend = value => { received.push(value); return sent; };
  ctx.mount({ onSend }).handleSend(); assert.equal(state, 'keep draft');
  sent = true; ctx.mount({ onSend }).handleSend(); assert.equal(state, ''); assert.deepEqual(received, ['keep draft', 'keep draft']);
  const page = messagingSource('components/Message.jsx');
  for (const text of ['Please log in to view your messages.', 'Select a user or group to chat', 'Select a chat', 'Group: ${selectedGroup.name}', 'Open sidebar',
    'setSidebarOpen(true)', 'setSidebarOpen(false)', 'Boolean(selectedUser || selectedGroup)', "navigate('/home')", 'navigate(`/user/${id}`)']) assert.ok(page.includes(text), text);
});

test('messaging URL preselection keeps query/directory triggers and selected-user guard', () => {
  const page = messagingSource('components/Message.jsx');
  const start = page.indexOf('  // Only run if users');
  const effect = page.slice(start, page.indexOf('\n\n  if (!currentUser', start));
  for (const scenario of ['found', 'missing', 'loading', 'already-selected']) {
    const selectedUsers = [];
    vm.runInNewContext(effect, { URLSearchParams, location: { search: '?user=' + (scenario === 'missing' ? c : b) },
      users: scenario === 'loading' ? [] : [userB], selectedUserRef: { current: scenario === 'already-selected' ? userC : null },
      selectUser: user => selectedUsers.push(user), useEffect: (fn, deps) => { assert.equal(deps.length, 3); fn(); } });
    assert.equal(selectedUsers.length, scenario === 'found' ? 1 : 0);
    if (selectedUsers.length) assert.equal(selectedUsers[0], userB);
  }
});


test('Phase 6 messaging controls support keyboard selection, closing, empty states and confirmed deletion', () => {
  const page = messagingSource('components/Message.jsx');
  const sidebar = messagingSource('components/messages/ChatSidebar.jsx');
  const list = messagingSource('components/messages/MessageList.jsx');
  assert.ok(page.includes('aria-controls="chat-navigation" aria-expanded={sidebarOpen}'));
  assert.ok(sidebar.includes('<aside id="chat-navigation"'));
  assert.match(sidebar, /<button type="button" onClick=\{onClose\} aria-label="Close chat navigation"\s+className="md:hidden/);
  assert.ok(page.includes('onClose={() => setSidebarOpen(false)}'));
  for (const kind of ['User', 'Group']) {
    const value = kind.toLowerCase();
    const wrapper = page.match(new RegExp('const handleSelect' + kind + ' = ' + value + ' => \\{([^]*?)\\n  \\};'));
    assert.ok(wrapper);
    const calls = [];
    vm.runInNewContext('(' + value + ' => {' + wrapper[1] + '})(selection)', {
      selection: { _id: b }, ['select' + kind]: item => calls.push(['select', item._id]), setSidebarOpen: open => calls.push(['open', open]),
    });
    assert.deepEqual(calls, [['select', b], ['open', false]]);
    assert.ok(page.includes('onSelect' + kind + '={handleSelect' + kind + '}'));
    const button = (sidebar.match(/<button\b[^]*?<\/button>/g) || []).find(control => control.includes('onSelect' + kind + '(' + value + ')'));
    assert.ok(button && button.includes('type="button"'), kind + ' selection is a button');
  }
  assert.ok(sidebar.includes('aria-label={`View ${user.name}\'s profile`}'));
  for (const text of ['filteredUsers.length === 0', 'No users found.', 'groups.length === 0', 'No groups available.']) assert.ok(sidebar.includes(text));
  assert.equal(page.split('<button type="button" onClick={() => navigate(`/user/${selectedUser._id}`)}').length - 1, 2);
  assert.equal((page.match(/\{selectedUser \? \(\s*<button/g) || []).length, 2);
  for (const heading of page.match(/<h3\b[^>]*>/g) || []) assert.equal(heading.includes('onClick='), false);
  assert.ok(page.includes('visible={Boolean(selectedUser || selectedGroup)}'));
  assert.match(page, /\{sidebarOpen && \(\s*<div\s+className="[^"\n]*md:hidden"\s+onClick=\{\(\) => setSidebarOpen\(false\)\}/);
  for (const text of ['Choose a conversation to start messaging.', 'No messages yet. Start the conversation.', 'No messages in this group yet.',
    '!selectedUser && !selectedGroup && (', 'selectedUser && currentMessages.length === 0 && !initialLoading', 'selectedGroup && groupMessages.length === 0 && !initialLoading']) assert.ok(list.includes(text));
  const initialLoading = list.match(/const initialLoading = ([^;]+);/);
  assert.ok(initialLoading);
  for (const [loadingMore, page, selectedGroup, expected] of [[true, 1, null, true], [true, 3, {}, true], [false, 1, null, false], [true, 2, null, false]]) {
    assert.equal(vm.runInNewContext(initialLoading[1], { loadingMore, page, selectedGroup }), expected);
  }
  for (const handler of ['handleDeleteMessage', 'handleDeleteGroupMessage']) {
    const blocks = [...list.matchAll(/onClick=\{\(\) => \{\s*(if \(!window\.confirm\([^}]+?)\s*\}\}/g)];
    const deletion = blocks.find(block => block[1].includes(handler + '(msg._id)'));
    assert.ok(deletion, handler + ' is confirmation-gated');
    assert.ok(deletion[1].includes('Delete this message? It will be removed for everyone.'));
    for (const confirmed of [false, true]) {
      const calls = [];
      vm.runInNewContext('(() => {' + deletion[1] + '})()', {
        window: { confirm: () => confirmed }, msg: { _id: b }, [handler]: id => calls.push(id), setDropdownOpen: () => {},
      });
      assert.deepEqual(calls, confirmed ? [b] : []);
    }
  }
});
