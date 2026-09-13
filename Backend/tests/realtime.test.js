const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const GroupMessage = require('../models/GroupMessage');
const { configureRealtime } = require('../socket/realtime');

const senderId = '111111111111111111111111';
const recipientId = 'abcdefabcdefabcdefabcdef';
const groupId = '333333333333333333333333';
const otherGroupId = '444444444444444444444444';
const account = {
  _id: senderId, email: ' Student@MGIT.AC.IN ', name: 'Current DB name',
  department: 'CSE', isVerified: true, avatar: 'db-avatar.svg',
  password: 'private-fixture', otp: 'private-fixture', otpExpiry: new Date(),
};
const query = value => ({ select: () => Promise.resolve(value) });

// Model calls are mocked per test. This in-memory transport records room unions
// and delivers to all matching fake tabs without opening network/DB connections.
function transport() {
  const middleware = [];
  const sockets = [];
  const broadcasts = [];
  let onConnection;
  const io = {
    use(fn) { middleware.push(fn); },
    on(event, fn) { assert.equal(event, 'connection'); onConnection = fn; },
    to(rooms) {
      const targets = new Set(Array.isArray(rooms) ? rooms : [rooms]);
      return {
        emit(event, payload) {
          broadcasts.push({ rooms: [...targets], event, payload });
          for (const socket of sockets) {
            if (socket.connected && [...targets].some(room => socket.rooms.has(room))) {
              socket.received.push({ event, payload });
            }
          }
        },
      };
    },
  };
  configureRealtime(io);
  async function connect(auth = { token: 'valid-fixture' }, options = {}) {
    const socket = {
      handshake: { auth, query: options.query || {} }, data: {}, rooms: new Set(),
      handlers: new Map(), received: [], connected: false,
      join(rooms) {
        if (options.failJoin) return Promise.reject(new Error('private-adapter-detail'));
        rooms.forEach(room => this.rooms.add(room));
      },
      on(event, handler) { this.handlers.set(event, handler); },
      emit(event, payload) { this.received.push({ event, payload }); },
      disconnect() { this.connected = false; this.rooms.clear(); },
      async send(event, payload, withAck = true) {
        let result;
        const handler = this.handlers.get(event);
        if (handler) await handler(payload, withAck ? value => { result = value; } : undefined);
        return result;
      },
    };
    for (const fn of middleware) {
      let called = false;
      await fn(socket, error => { called = true; socket.error = error; });
      assert.equal(called, true);
      if (socket.error) return socket;
    }
    socket.connected = true;
    sockets.push(socket);
    onConnection(socket);
    await new Promise(resolve => setImmediate(resolve));
    return socket;
  }
  return { connect, broadcasts };
}

function setup(t) {
  const previous = process.env.ALLOWED_EMAIL_DOMAINS;
  process.env.ALLOWED_EMAIL_DOMAINS = 'mgit.ac.in';
  t.after(() => {
    if (previous === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
    else process.env.ALLOWED_EMAIL_DOMAINS = previous;
  });
  t.mock.method(jwt, 'verify', token => {
    if (token === 'expired-fixture') throw new jwt.TokenExpiredError('private-jwt-detail', new Date(0));
    if (!['valid-fixture', 'recipient-fixture'].includes(token)) throw new Error('private-jwt-detail');
    return {
      _id: token === 'recipient-fixture' ? recipientId : senderId,
      email: 'stale@gmail.com', name: 'Spoofed JWT name',
    };
  });
  t.mock.method(User, 'findById', id => query({ ...account, _id: id }));
  t.mock.method(Group, 'find', filter => {
    assert.deepEqual(filter, { members: senderId });
    return query([{ _id: groupId }]);
  });
  t.mock.method(Group, 'findOne', filter => {
    assert.deepEqual(filter, { _id: groupId, members: senderId });
    return query({ _id: groupId });
  });
  const writes = { personal: [], group: [] };
  t.mock.method(Message, 'create', async data => {
    writes.personal.push(data);
    return new Message(data); // Exercise actual schema-generated timestamp.
  });
  t.mock.method(GroupMessage, 'create', async data => {
    writes.group.push(data);
    return new GroupMessage(data);
  });
  return { ...transport(), writes };
}

for (const token of [undefined, null, '', ' ', {}, 'invalid-fixture', 'expired-fixture']) {
  test('handshake rejects missing/malformed/invalid/expired token: ' + String(token), async t => {
    const env = setup(t);
    const socket = await env.connect({ token });
    assert.equal(socket.connected, false);
    assert.equal(socket.error.data.code, 'UNAUTHORIZED');
    assert.equal(socket.error.message, 'Unable to connect to realtime messaging');
    assert.equal(socket.rooms.size, 0);
    assert.equal(socket.handlers.size, 0);
  });
}

test('a query-string token is not accepted as handshake authentication', async t => {
  const env = setup(t);
  const socket = await env.connect({}, { query: { token: 'valid-fixture' } });
  assert.equal(socket.error.data.code, 'UNAUTHORIZED');
});

for (const id of [undefined, 'bad-id', { $ne: null }]) {
  test('handshake rejects invalid decoded identity: ' + String(id), async t => {
    const env = setup(t);
    t.mock.method(jwt, 'verify', () => ({ _id: id }));
    assert.equal((await env.connect()).error.data.code, 'UNAUTHORIZED');
  });
}

for (const [label, user, code] of [
  ['deleted', null, 'UNAUTHORIZED'],
  ['unverified', { ...account, isVerified: false }, 'FORBIDDEN'],
  ['missing verification', { ...account, isVerified: undefined }, 'FORBIDDEN'],
  ['outside college', { ...account, email: 'student@gmail.com' }, 'FORBIDDEN'],
]) {
  test('handshake rejects ' + label + ' account', async t => {
    const env = setup(t);
    t.mock.method(User, 'findById', () => query(user));
    const socket = await env.connect();
    assert.equal(socket.error.data.code, code);
    assert.equal(socket.connected, false);
  });
}

test('identity and rooms derive from current DB account and memberships', async t => {
  const env = setup(t);
  const socket = await env.connect({
    token: 'valid-fixture', userId: recipientId, name: 'Victim', groupId: otherGroupId,
  });
  assert.equal(socket.connected, true);
  assert.deepEqual(socket.user, {
    _id: senderId, email: 'student@mgit.ac.in', name: account.name, department: 'CSE',
  });
  assert.equal(Object.isFrozen(socket.user), true);
  assert.deepEqual([...socket.rooms], ['user:' + senderId, 'group:' + groupId]);
  assert.equal(socket.handlers.has('register'), false);
  await socket.send('register', recipientId);
  assert.equal(socket.user._id, senderId);
  assert.equal(socket.rooms.has('user:' + recipientId), false);
});

for (const operation of ['user lookup', 'group lookup']) {
  test('handshake hides database failures: ' + operation, async t => {
    const env = setup(t);
    t.mock.method(operation === 'user lookup' ? User : Group,
      operation === 'user lookup' ? 'findById' : 'find',
      () => { throw new Error('private-database-detail'); });
    const socket = await env.connect();
    assert.equal(socket.error.data.code, 'SERVER_ERROR');
    assert.equal(socket.error.message.includes('private-'), false);
  });
}

test('room initialization failure disconnects safely without accepting events', async t => {
  const env = setup(t);
  const socket = await env.connect({ token: 'valid-fixture' }, { failJoin: true });
  assert.equal(socket.connected, false);
  await socket.send('send_message', { recipientId, content: 'hello' });
  assert.equal(env.writes.personal.length, 0);
  assert.equal(socket.received[0].payload.code, 'SERVER_ERROR');
});

test('personal sender, senderName and timestamp cannot be spoofed; all participant tabs receive once', async t => {
  const env = setup(t);
  t.mock.method(Group, 'find', () => query([]));
  const senderTabs = [await env.connect(), await env.connect()];
  const recipientTabs = [
    await env.connect({ token: 'recipient-fixture' }), await env.connect({ token: 'recipient-fixture' }),
  ];
  const result = await senderTabs[0].send('send_message', {
    senderId: recipientId, senderName: 'Victim', recipientId: recipientId.toUpperCase(),
    content: 'hello', timestamp: '1900-01-01', isRead: true,
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(env.writes.personal, [{ senderId, recipientId, content: 'hello' }]);
  assert.deepEqual(env.broadcasts[0].rooms, ['user:' + senderId, 'user:' + recipientId]);
  for (const socket of [...senderTabs, ...recipientTabs]) {
    assert.equal(socket.received.length, 1);
    assert.equal(socket.received[0].event, 'receive_message');
    assert.equal(socket.received[0].payload.senderId.toString(), senderId);
    assert.equal(socket.received[0].payload.senderName, undefined);
    assert.ok(socket.received[0].payload.timestamp.getFullYear() > 1900);
    assert.equal(socket.received[0].payload.isRead, false);
  }
});

test('personal self-message uses a room union without duplicate delivery', async t => {
  const env = setup(t);
  const socket = await env.connect();
  await socket.send('send_message', { recipientId: senderId, content: 'self' });
  assert.deepEqual(env.broadcasts[0].rooms, ['user:' + senderId]);
  assert.equal(socket.received.length, 1);
});

for (const payload of [
  undefined, null, {}, { recipientId: 'bad', content: 'hello' },
  { recipientId: { $ne: null }, content: 'hello' }, { recipientId, content: 1 },
  { recipientId, content: '' }, { recipientId, content: ' \n\t' },
]) {
  test('invalid personal payload is rejected: ' + JSON.stringify(payload), async t => {
    const env = setup(t);
    const socket = await env.connect();
    const result = await socket.send('send_message', payload);
    assert.equal(result.code, 'INVALID_PAYLOAD');
    assert.equal(env.writes.personal.length, 0);
    assert.equal(env.broadcasts.length, 0);
  });
}

test('valid group message checks current membership and uses trusted sender presentation', async t => {
  const env = setup(t);
  const socket = await env.connect();
  const result = await socket.send('send_group_message', {
    groupId, senderId: recipientId, senderName: 'Victim', senderAvatar: 'spoof.svg',
    content: 'group hello', timestamp: '1900-01-01',
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(env.writes.group, [{ groupId, senderId, content: 'group hello' }]);
  assert.deepEqual(env.broadcasts[0].rooms, ['group:' + groupId]);
  const message = env.broadcasts[0].payload;
  assert.equal(message.senderId.toString(), senderId);
  assert.equal(message.senderName, account.name);
  assert.equal(message.senderAvatar, account.avatar);
  assert.deepEqual(message.sender, { name: account.name, avatar: account.avatar });
  assert.ok(message.timestamp.getFullYear() > 1900);
});

test('membership revoked after connection rejects a group send without write/broadcast', async t => {
  const env = setup(t);
  const socket = await env.connect();
  assert.ok(socket.rooms.has('group:' + groupId));
  t.mock.method(Group, 'findOne', filter => {
    assert.deepEqual(filter, { _id: groupId, members: senderId });
    return query(null);
  });
  const result = await socket.send('send_group_message', { groupId, content: 'not permitted' });
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(env.writes.group.length, 0);
  assert.equal(env.broadcasts.length, 0);
});

test('a non-member cannot send to an arbitrary group', async t => {
  const env = setup(t);
  const socket = await env.connect();
  t.mock.method(Group, 'findOne', filter => {
    assert.deepEqual(filter, { _id: otherGroupId, members: senderId });
    return query(null);
  });
  assert.equal((await socket.send('send_group_message', { groupId: otherGroupId, content: 'no' })).code, 'FORBIDDEN');
  assert.equal(env.writes.group.length, 0);
  assert.equal(env.broadcasts.length, 0);
});

for (const payload of [null, {}, { groupId: 'bad', content: 'text' }, { groupId, content: ' ' }, { groupId, content: {} }]) {
  test('invalid group payload is rejected: ' + JSON.stringify(payload), async t => {
    const env = setup(t);
    const socket = await env.connect();
    assert.equal((await socket.send('send_group_message', payload)).code, 'INVALID_PAYLOAD');
    assert.equal(env.writes.group.length, 0);
    assert.equal(env.broadcasts.length, 0);
  });
}

test('typing ignores client from and targets only the recipient personal room', async t => {
  const env = setup(t);
  const socket = await env.connect();
  await socket.send('typing', { to: recipientId.toUpperCase(), from: 'victim' });
  assert.deepEqual(env.broadcasts, [{
    rooms: ['user:' + recipientId], event: 'typing', payload: { from: senderId },
  }]);
  assert.equal(env.writes.personal.length + env.writes.group.length, 0);
});

for (const payload of [null, {}, { to: 'bad' }, { to: { $ne: null } }]) {
  test('invalid typing recipient is rejected: ' + JSON.stringify(payload), async t => {
    const env = setup(t);
    const socket = await env.connect();
    assert.equal((await socket.send('typing', payload)).code, 'INVALID_PAYLOAD');
    assert.equal(env.broadcasts.length, 0);
  });
}

for (const [label, model, method, event, payload] of [
  ['personal create', Message, 'create', 'send_message', { recipientId, content: 'hello' }],
  ['membership lookup', Group, 'findOne', 'send_group_message', { groupId, content: 'hello' }],
  ['sender lookup', User, 'findById', 'send_group_message', { groupId, content: 'hello' }],
  ['group create', GroupMessage, 'create', 'send_group_message', { groupId, content: 'hello' }],
]) {
  test('async event database failure is handled without leaking details: ' + label, async t => {
    const env = setup(t);
    const socket = await env.connect();
    t.mock.method(model, method, () => {
      if (method === 'create') return Promise.reject(new Error('private-database-detail'));
      return { select: () => Promise.reject(new Error('private-database-detail')) };
    });
    const result = await socket.send(event, payload);
    assert.deepEqual(result, { ok: false, code: 'SERVER_ERROR', message: 'Unable to process realtime event' });
    assert.equal(env.broadcasts.length, 0);
  });
}

test('events without acknowledgement get a bounded error event', async t => {
  const env = setup(t);
  const socket = await env.connect();
  await socket.send('send_message', {}, false);
  assert.equal(socket.received[0].event, 'realtime_error');
  assert.equal(socket.received[0].payload.code, 'INVALID_PAYLOAD');
  assert.equal(env.broadcasts.length, 0);
});
