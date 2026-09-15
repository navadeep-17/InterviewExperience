const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Experience = require('../models/Experience');
const Comment = require('../models/Comment');
const experienceRouter = require('../routes/experienceRoutes');
const commentRouter = require('../routes/commentRoutes');

const a = '111111111111111111111111';
const b = '222222222222222222222222';
const x = '333333333333333333333333';
const y = '444444444444444444444444';
const root = '555555555555555555555555';
const reply = '666666666666666666666666';
const leaf = '777777777777777777777777';
const content = { company: ' Example ', role: ' Engineer ', difficulty: 'Medium', roundDate: '2026-09-01', description: '', tips: '', rounds: [] };
const protectedFields = { user: b, department: 'ECE', upvotes: 999, downvotes: 888, upvotedBy: [b], downvotedBy: [b], _id: y, createdAt: '1900-01-01', updatedAt: '1900-01-01', __v: 99, unknown: 'ignored', $set: { user: b } };
const object = value => value?.toObject ? value.toObject() : value;
const same = (left, right) => String(left) === String(right);

function request(server, method, url, body, token = a) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };
    if (data !== undefined) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method, headers }, res => {
      let text = '';
      res.setEncoding('utf8'); res.on('data', part => { text += part; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

test('experience/comment HTTP integrity matrix with isolated model and JWT mocks', async t => {
  const previous = process.env.ALLOWED_EMAIL_DOMAINS;
  process.env.ALLOWED_EMAIL_DOMAINS = 'mgit.ac.in';
  t.after(() => {
    if (previous === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
    else process.env.ALLOWED_EMAIL_DOMAINS = previous;
  });
  let db;
  const reset = () => { db = { experiences: new Map(), comments: new Map(), calls: [], department: 'CSE' }; };
  reset();
  const note = (name, ...args) => db.calls.push({ name, args });
  const calls = name => db.calls.filter(call => call.name === name);
  const user = id => ({ _id: id, name: 'DB Student', avatar: 'safe.svg', department: db.department, graduationYear: '2027', email: 'student@mgit.ac.in', isVerified: true, password: 'private', otp: 'private', phoneNumber: 'private' });
  t.mock.method(jwt, 'verify', token => {
    if (![a, b].includes(token)) throw new Error('Invalid fixture');
    return { _id: token, department: 'JWT department', name: 'Stale JWT' };
  });
  function query(value, label) {
    const actions = [];
    const chain = {};
    for (const action of ['select', 'populate', 'sort', 'skip', 'limit', 'lean']) {
      chain[action] = (...args) => { note(label + '.' + action, ...args); actions.push([action, args]); return chain; };
    }
    chain.then = (resolve, reject) => Promise.resolve().then(() => {
      let result = typeof value === 'function' ? value() : value;
      for (const [action, args] of actions) {
        if (action === 'sort' && Array.isArray(result)) {
          const [key, order] = Object.entries(args[0])[0];
          result = [...result].sort((l, r) => (new Date(l[key] || 0) - new Date(r[key] || 0)) * order);
        }
        if (action === 'skip') result = result.slice(args[0]);
        if (action === 'limit') result = result.slice(0, args[0]);
        if (action === 'populate') {
          const [field, fields] = args;
          assert.equal(field, 'user');
          const allowed = label.startsWith('Experience') ? ['_id', 'name', 'department', 'graduationYear', 'avatar'] : ['_id', 'name', 'avatar'];
          assert.deepEqual(fields.split(' ').sort(), allowed.sort());
          result = result.map(doc => ({ ...object(doc), user: Object.fromEntries(fields.split(' ').map(key => [key, user(String(doc.user))[key]])) }));
        }
        if (action === 'lean') result = result.map(object);
      }
      return result;
    }).then(resolve, reject);
    return chain;
  }
  t.mock.method(User, 'findById', id => { note('User.findById', id); return query(user(id), 'User'); });
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && '$in' in value) return value.$in.some(id => same(doc[key], id));
    if (value && typeof value === 'object' && '$regex' in value) return new RegExp(value.$regex, value.$options).test(doc[key]);
    return same(doc[key], value);
  });
  for (const [model, collection, label] of [[Experience, 'experiences', 'Experience'], [Comment, 'comments', 'Comment']]) {
    t.mock.method(model, 'findById', id => { note(label + '.findById', id); return query(db[collection].get(String(id).toLowerCase()) || null, label); });
    t.mock.method(model, 'find', filter => { note(label + '.find', filter); return query(() => [...db[collection].values()].filter(doc => matches(doc, filter)), label); });
    t.mock.method(model, 'countDocuments', async filter => { note(label + '.countDocuments', filter); return [...db[collection].values()].filter(doc => matches(doc, filter)).length; });
    t.mock.method(model, 'deleteMany', async filter => {
      note(label + '.deleteMany', filter);
      let deletedCount = 0;
      for (const [id, doc] of db[collection]) if (matches(doc, filter)) { db[collection].delete(id); deletedCount++; }
      return { deletedCount };
    });
    t.mock.method(model.prototype, 'save', async function () {
      note(label + '.save', object(this));
      const error = this.validateSync();
      if (error) throw error;
      db[collection].set(String(this._id), this);
      return this;
    });
    t.mock.method(model.prototype, 'deleteOne', async function () { note(label + '.deleteOne', this._id); db[collection].delete(String(this._id)); });
  }
  t.mock.method(Comment, 'aggregate', async pipeline => { note('Comment.aggregate', pipeline); return []; });
  const seedExperience = (changes = {}) => {
    const doc = new Experience({ ...content, _id: x, user: a, department: 'CSE', ...changes });
    db.experiences.set(String(doc._id), doc); return doc;
  };
  const seedComment = (changes = {}) => {
    const doc = new Comment({ _id: root, experienceId: x, user: a, text: 'original', ...changes });
    db.comments.set(String(doc._id), doc); return doc;
  };
  const app = express(); app.use(express.json());
  app.use('/api/experiences', experienceRouter); app.use('/api/comments', commentRouter);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const send = (...args) => request(server, ...args);
  const check = (name, fn) => t.test(name, async t => { reset(); await fn(t); });
  const privateArraysAbsent = value => {
    const json = JSON.stringify(value);
    assert.equal(json.includes('upvotedBy'), false); assert.equal(json.includes('downvotedBy'), false);
  };
  const noWrites = () => assert.equal(db.calls.filter(call => /save|delete/.test(call.name)).length, 0);

  for (const [method, url] of [
    ['POST', '/api/experiences'], ['GET', '/api/experiences'], ['GET', '/api/experiences/user/' + a],
    ['PUT', '/api/experiences/' + x], ['DELETE', '/api/experiences/' + x],
    ['POST', '/api/experiences/' + x + '/upvote'], ['POST', '/api/experiences/' + x + '/downvote'],
    ['POST', '/api/comments'], ['GET', '/api/comments/experience/' + x], ['GET', '/api/comments/experience/' + x + '/count'],
    ['PUT', '/api/comments/' + root], ['DELETE', '/api/comments/' + root],
  ]) await check('authentication required: ' + method + ' ' + url, async () => {
    assert.equal((await send(method, url, {}, null)).status, 401); assert.equal(db.calls.length, 0);
  });
  for (const id of ['bad', a + '%0A', '%7B%22%24ne%22%3Anull%7D']) {
    await check('strict URL IDs: ' + id, async () => {
      for (const [method, url] of [
        ['GET', '/api/experiences/user/' + id], ['PUT', '/api/experiences/' + id], ['DELETE', '/api/experiences/' + id],
        ['POST', '/api/experiences/' + id + '/upvote'], ['POST', '/api/experiences/' + id + '/downvote'],
        ['GET', '/api/comments/experience/' + id], ['GET', '/api/comments/experience/' + id + '/count'],
        ['PUT', '/api/comments/' + id], ['DELETE', '/api/comments/' + id],
      ]) assert.equal((await send(method, url, {})).status, 400);
      assert.equal(db.calls.filter(call => !call.name.startsWith('User')).length, 0);
    });
  }
  for (const key of ['page', 'limit']) for (const value of ['0', '-1', 'NaN', '1abc', '1.5', '1%0A', '9007199254740992', '']) {
    await check('invalid pagination ' + key + '=' + value, async () => {
      assert.equal((await send('GET', '/api/experiences?' + key + '=' + value)).status, 400);
      assert.equal(calls('Experience.find').length, 0);
    });
  }
  for (const key of ['page', 'limit', 'company', 'role', 'department', 'difficulty', 'sortOrder']) {
    await check('reject object/array/duplicate query ' + key, async () => {
      for (const tail of ['[$ne]=x', '[]=x', '=1&' + key + '=2']) {
        assert.equal((await send('GET', '/api/experiences?' + key + tail)).status, 400);
      }
    });
  }
  await check('unsafe skip, unsupported sort and difficulty rejected', async () => {
    for (const query of ['page=9007199254740991&limit=50', 'sortOrder=random', 'difficulty=.*']) {
      assert.equal((await send('GET', '/api/experiences?' + query)).status, 400);
    }
  });
  for (const [label, queryString, skip, limit, sort] of [
    ['defaults', '', 0, 10, -1], ['second page', '?page=2&limit=5', 5, 5, -1],
    ['capped oldest', '?limit=100&sortOrder=oldest', 0, 50, 1],
  ]) await check('authenticated listing: ' + label, async () => {
    seedExperience({ upvotedBy: [b], downvotedBy: [a], upvotes: 1, downvotes: 1 });
    const result = await send('GET', '/api/experiences' + queryString);
    assert.equal(result.status, 200); privateArraysAbsent(result.body);
    assert.equal(calls('Experience.skip')[0].args[0], skip);
    assert.equal(calls('Experience.limit')[0].args[0], limit);
    assert.equal(calls('Experience.sort')[0].args[0].createdAt, sort);
    assert.equal(JSON.stringify(result.body).includes('email'), false);
  });
  await check('literal text filters and canonical difficulty', async () => {
    const literal = 'A.*+$(){}|[]\\?^';
    const result = await send('GET', '/api/experiences?company=' + encodeURIComponent(literal) + '&role=Engineer&department=CSE&difficulty=Easy');
    assert.equal(result.status, 200);
    const filter = calls('Experience.find')[0].args[0];
    assert.equal(filter.difficulty, 'Easy');
    assert.ok(new RegExp(filter.company.$regex).test(literal));
    assert.equal(new RegExp(filter.company.$regex).test('Aanything'), false);
  });
  await check('user posts select only requested author and hide voters', async () => {
    seedExperience({ upvotedBy: [b] }); seedExperience({ _id: y, user: b });
    const result = await send('GET', '/api/experiences/user/' + a);
    assert.equal(result.status, 200); assert.equal(result.body.length, 1);
    assert.deepEqual(calls('Experience.find')[0].args[0], { user: a }); privateArraysAbsent(result.body);
    assert.deepEqual(Object.keys(result.body[0].user).sort(), ['_id', 'avatar', 'department', 'graduationYear', 'name']);
  });
  await check('create strips protected fields and derives identity/department without extra user lookup', async () => {
    const result = await send('POST', '/api/experiences', { ...content, ...protectedFields, rounds: [{ roundName: 'HR', duration: '10m', questions: 'Hello', _id: y, evil: true }] });
    assert.equal(result.status, 201);
    const saved = [...db.experiences.values()][0];
    assert.equal(String(saved.user), a); assert.equal(saved.department, 'CSE');
    assert.equal(saved.company, 'Example'); assert.equal(saved.role, 'Engineer');
    assert.equal(saved.upvotes, 0); assert.equal(saved.downvotes, 0);
    assert.equal(saved.upvotedBy.length + saved.downvotedBy.length, 0);
    assert.notEqual(String(saved._id), y); assert.equal(saved.__v, undefined);
    assert.equal(saved.createdAt, undefined); assert.equal(saved.get('unknown'), undefined);
    assert.notEqual(String(saved.rounds[0]._id), y); assert.equal(saved.rounds[0].get('evil'), undefined);
    assert.equal(calls('User.findById').length, 1); privateArraysAbsent(result.body);
  });
  const invalidContent = [
    ['company', undefined], ['company', ' '], ['company', 123], ['role', undefined], ['role', ' '], ['role', {}],
    ['difficulty', undefined], ['difficulty', 'easy'], ['difficulty', {}], ['roundDate', undefined],
    ['roundDate', 'bad'], ['roundDate', '2026-02-30'], ['roundDate', {}], ['roundDate', null],
    ['description', {}], ['tips', []], ['rounds', {}], ['rounds', [null]], ['rounds', [[]]], ['rounds', [{ questions: 2 }]],
  ];
  for (const [key, value] of invalidContent) await check('create validates ' + key + ': ' + JSON.stringify(value), async () => {
    assert.equal((await send('POST', '/api/experiences', { ...content, [key]: value })).status, 400); noWrites();
  });
  for (const department of [undefined, '', ' ', null, {}]) await check('missing usable department rejects client fallback: ' + JSON.stringify(department), async () => {
    db.department = department;
    assert.equal((await send('POST', '/api/experiences', { ...content, department: 'ECE' })).status, 400); noWrites();
  });
  await check('owner update strips protected values and only changes content', async () => {
    const original = seedExperience({ upvotes: 2, downvotes: 1, upvotedBy: [a, b], downvotedBy: [b] });
    const result = await send('PUT', '/api/experiences/' + x, { ...protectedFields, company: ' New Company ' });
    assert.equal(result.status, 200); assert.equal(original.company, 'New Company');
    assert.equal(String(original.user), a); assert.equal(original.department, 'CSE');
    assert.equal(original.upvotes, 2); assert.equal(original.downvotes, 1);
    assert.deepEqual(original.upvotedBy.map(String), [a, b]); assert.deepEqual(original.downvotedBy.map(String), [b]);
    assert.equal(String(original._id), x); privateArraysAbsent(result.body);
  });
  await check('protected-only or empty update rejected', async () => {
    seedExperience();
    for (const body of [protectedFields, {}, []]) assert.equal((await send('PUT', '/api/experiences/' + x, body)).status, 400);
    noWrites();
  });
  for (const [key, value] of invalidContent.filter(([, value]) => value !== undefined)) await check('update validates supplied ' + key + ': ' + JSON.stringify(value), async () => {
    seedExperience(); assert.equal((await send('PUT', '/api/experiences/' + x, { [key]: value })).status, 400); noWrites();
  });
  for (const method of ['PUT', 'DELETE']) {
    await check('experience ' + method + ' is owner-only', async () => {
      seedExperience({ user: b }); assert.equal((await send(method, '/api/experiences/' + x, content)).status, 403); noWrites();
    });
    await check('experience ' + method + ' missing returns 404', async () => {
      assert.equal((await send(method, '/api/experiences/' + x, content)).status, 404); noWrites();
    });
  }
  await check('experience deletion cascades all same-experience comments before success', async () => {
    seedExperience(); seedComment(); seedComment({ _id: reply, parentCommentId: root }); seedComment({ _id: leaf, experienceId: y });
    assert.equal((await send('DELETE', '/api/experiences/' + x)).status, 200);
    assert.equal(db.experiences.size, 0); assert.deepEqual([...db.comments.keys()], [leaf]);
    assert.ok(db.calls.findIndex(call => call.name === 'Comment.deleteMany') < db.calls.findIndex(call => call.name === 'Experience.deleteOne'));
  });
  await check('failed comment cleanup prevents successful experience deletion', async t => {
    seedExperience(); t.mock.method(Comment, 'deleteMany', async () => { throw new Error('private-db'); });
    assert.equal((await send('DELETE', '/api/experiences/' + x)).status, 500); assert.equal(db.experiences.size, 1);
  });
  for (const direction of ['upvote', 'downvote']) {
    await check(direction + ' missing experience', async () => { assert.equal((await send('POST', '/api/experiences/' + x + '/' + direction)).status, 404); });
    await check(direction + ' first vote and toggle ignore body identity', async () => {
      const doc = seedExperience();
      const field = direction === 'upvote' ? 'upvotedBy' : 'downvotedBy';
      for (const count of [1, 0]) {
        const result = await send('POST', '/api/experiences/' + x + '/' + direction, { user: b, userId: b });
        assert.equal(result.status, 200); assert.equal(doc[field].length, count);
        if (count) assert.equal(String(doc[field][0]), a);
        assert.equal(doc.upvotes, doc.upvotedBy.length); assert.equal(doc.downvotes, doc.downvotedBy.length);
        assert.deepEqual(Object.keys(result.body).sort(), ['downvotes', 'upvotes']);
      }
    });
    await check(direction + ' switches from opposite vote', async () => {
      const opposite = direction === 'upvote' ? 'downvotedBy' : 'upvotedBy';
      const doc = seedExperience({ [opposite]: [a], upvotes: 99, downvotes: 51 });
      assert.equal((await send('POST', '/api/experiences/' + x + '/' + direction)).status, 200);
      assert.equal(doc[opposite].length, 0); assert.equal(doc.upvotes + doc.downvotes, 1);
    });
    await check(direction + ' normalizes duplicates and both-array membership; repairs stale counters', async () => {
      const doc = seedExperience({ upvotedBy: [a, a, b, b], downvotedBy: [a, a, b, b], upvotes: -5, downvotes: 999 });
      const result = await send('POST', '/api/experiences/' + x + '/' + direction);
      assert.equal(result.status, 200); assert.deepEqual(doc.upvotedBy.map(String), [b]); assert.deepEqual(doc.downvotedBy.map(String), [b]);
      assert.deepEqual(result.body, { upvotes: 1, downvotes: 1 });
    });
  }
  await check('comment read privacy and count response', async () => {
    seedComment();
    const result = await send('GET', '/api/comments/experience/' + x);
    assert.equal(result.status, 200); assert.deepEqual(Object.keys(result.body[0].user).sort(), ['_id', 'avatar', 'name']);
    for (const field of ['email', 'password', 'phoneNumber', 'rollNumber', 'otp', 'otpExpiry']) assert.equal(JSON.stringify(result.body).includes(field), false);
    assert.deepEqual((await send('GET', '/api/comments/experience/' + x + '/count')).body, { count: 1 });
  });
  await check('root comment trims text and ignores author/relationship extras', async () => {
    seedExperience();
    const result = await send('POST', '/api/comments', { experienceId: x, text: ' hello ', user: b, _id: y, createdAt: '1900-01-01' });
    assert.equal(result.status, 201); assert.equal(result.body.user, a); assert.equal(result.body.text, 'hello');
    assert.equal(result.body.parentCommentId, null); assert.notEqual(result.body._id, y);
  });
  await check('missing target experience does not create comment', async () => {
    assert.equal((await send('POST', '/api/comments', { experienceId: x, text: 'hello' })).status, 404); noWrites();
  });
  for (const experienceId of [undefined, null, {}, [], 'bad', x + '\n']) await check('comment rejects experienceId ' + JSON.stringify(experienceId), async () => {
    assert.equal((await send('POST', '/api/comments', { experienceId, text: 'hello' })).status, 400); noWrites();
  });
  for (const text of [undefined, null, '', ' \n\t', {}, [], 123]) await check('comment create/edit rejects text ' + JSON.stringify(text), async () => {
    seedExperience(); seedComment();
    assert.equal((await send('POST', '/api/comments', { experienceId: x, text })).status, 400);
    assert.equal((await send('PUT', '/api/comments/' + root, { text })).status, 400); noWrites();
  });
  for (const parentCommentId of [{}, [], '', 'bad', root + '\n']) await check('comment rejects parent ID ' + JSON.stringify(parentCommentId), async () => {
    seedExperience(); assert.equal((await send('POST', '/api/comments', { experienceId: x, text: 'hello', parentCommentId })).status, 400); noWrites();
  });
  await check('parent must exist in same experience', async () => {
    seedExperience();
    assert.equal((await send('POST', '/api/comments', { experienceId: x, text: 'hello', parentCommentId: root })).status, 404);
    seedComment({ experienceId: y });
    assert.equal((await send('POST', '/api/comments', { experienceId: x, text: 'hello', parentCommentId: root })).status, 400); noWrites();
  });
  for (const depth of [1, 2, 3]) await check('server nesting accepts only new levels 0 through 2; requested level ' + depth, async () => {
    seedExperience(); seedComment(); seedComment({ _id: reply, parentCommentId: root }); seedComment({ _id: leaf, parentCommentId: reply });
    const result = await send('POST', '/api/comments', { experienceId: x, text: 'child', parentCommentId: [root, reply, leaf][depth - 1] });
    assert.equal(result.status, depth < 3 ? 201 : 400);
    assert.ok(calls('Comment.findById').length <= 2);
    if (depth === 3) noWrites();
  });
  await check('cyclic and cross-experience ancestor chains are rejected with bounded traversal', async () => {
    seedExperience(); const parent = seedComment({ parentCommentId: root });
    assert.equal((await send('POST', '/api/comments', { experienceId: x, text: 'child', parentCommentId: root })).status, 400);
    parent.parentCommentId = reply; seedComment({ _id: reply, experienceId: y });
    assert.equal((await send('POST', '/api/comments', { experienceId: x, text: 'child', parentCommentId: root })).status, 400); noWrites();
  });
  await check('comment author edit changes only trimmed text', async () => {
    const doc = seedComment();
    const result = await send('PUT', '/api/comments/' + root, { text: ' updated ', user: b, experienceId: y, parentCommentId: reply, _id: y, createdAt: '1900-01-01' });
    assert.equal(result.status, 200); assert.equal(doc.text, 'updated'); assert.equal(String(doc.user), a);
    assert.equal(String(doc.experienceId), x); assert.equal(doc.parentCommentId, null); assert.equal(String(doc._id), root);
  });
  for (const method of ['PUT', 'DELETE']) {
    await check('non-author comment ' + method + ' rejected', async () => {
      seedComment({ user: b }); assert.equal((await send(method, '/api/comments/' + root, { text: 'hello', user: a })).status, 403); noWrites();
    });
    await check('missing comment ' + method + ' returns 404', async () => {
      assert.equal((await send(method, '/api/comments/' + root, { text: 'hello' })).status, 404); noWrites();
    });
  }
  await check('comment delete removes descendants including other authors and survives legacy cycles', async () => {
    seedComment({ parentCommentId: leaf }); seedComment({ _id: reply, parentCommentId: root, user: b }); seedComment({ _id: leaf, parentCommentId: reply });
    seedComment({ _id: y, experienceId: y, parentCommentId: root });
    assert.equal((await send('DELETE', '/api/comments/' + root)).status, 200);
    assert.deepEqual([...db.comments.keys()], [y]); assert.equal(calls('Comment.find').length, 3);
  });
  for (const [label, model, method, verb, url, body] of [
    ['experience list', Experience, 'countDocuments', 'GET', '/api/experiences'],
    ['experience create', Experience.prototype, 'save', 'POST', '/api/experiences', content],
    ['experience update', Experience, 'findById', 'PUT', '/api/experiences/' + x, content],
    ['experience delete', Experience, 'findById', 'DELETE', '/api/experiences/' + x],
    ['upvote', Experience, 'findById', 'POST', '/api/experiences/' + x + '/upvote'],
    ['downvote', Experience, 'findById', 'POST', '/api/experiences/' + x + '/downvote'],
    ['comment list', Comment, 'find', 'GET', '/api/comments/experience/' + x],
    ['comment count', Comment, 'countDocuments', 'GET', '/api/comments/experience/' + x + '/count'],
    ['comment create', Experience, 'findById', 'POST', '/api/comments', { experienceId: x, text: 'hello' }],
    ['comment edit', Comment, 'findById', 'PUT', '/api/comments/' + root, { text: 'hello' }],
    ['comment delete', Comment, 'findById', 'DELETE', '/api/comments/' + root],
  ]) await check('bounded DB error: ' + label, async t => {
    t.mock.method(model, method, () => { throw new Error('private-database-detail'); });
    const result = await send(verb, url, body); assert.equal(result.status, 500);
    assert.deepEqual(Object.keys(result.body), ['message']); assert.equal(JSON.stringify(result.body).includes('private-'), false);
  });
});

const frontendPath = file => path.join(__dirname, '../../Frontend/interviewhub/src/components', file);
const apiClientSource = () => fs.readFileSync(path.join(__dirname,
  '../../Frontend/interviewhub/src/services/apiClient.js'), 'utf8');

test('shared API client derives current auth and normalizes data/errors without session side effects', async () => {
  const source = apiClientSource();
  assert.ok(source.includes('import.meta.env.VITE_API_URL'));
  let token = 'first-token';
  const requests = [];
  const payload = { content: 'fixture' };
  let response = { data: payload };
  let failure;
  const ctx = vm.createContext({
    localStorage: { getItem(key) { assert.equal(key, 'authToken'); return token; },
      removeItem() { assert.fail('Transport must not clear auth'); } },
    navigate() { assert.fail('Transport must not navigate'); },
    axios: { create(options) {
      assert.equal(options.baseURL, 'https://api.invalid');
      return { async request(config) { requests.push(config); if (failure) throw failure; return response; } };
    } },
  });
  vm.runInContext(source.replace(/^import axios[^\n]+\n/m, '')
    .replace('import.meta.env.VITE_API_URL', JSON.stringify('https://api.invalid'))
    .replace(/^export /gm, '') + '\nglobalThis.request = apiRequest; globalThis.ErrorType = ApiError;', ctx);
  assert.equal(await ctx.request('/api/comments', { method: 'POST', data: payload }), payload);
  assert.equal(requests[0].headers.Authorization, 'Bearer first-token');
  assert.equal(requests[0].data, payload);
  assert.equal(requests[0].method, 'POST');
  token = 'replacement-token';
  await ctx.request('/api/experiences', { params: { page: 2 } });
  assert.equal(requests[1].headers.Authorization, 'Bearer replacement-token');
  assert.equal(requests[1].params.page, 2);
  assert.equal(requests[1].method, 'GET');
  await ctx.request('/api/auth/login', { method: 'POST', auth: false, data: payload });
  assert.equal(requests.at(-1).headers.Authorization, undefined);
  for (token of [null, '', undefined]) {
    await ctx.request('/api/auth/me');
    assert.equal(requests.at(-1).headers.Authorization, undefined);
  }
  response = { data: '' };
  assert.equal(await ctx.request('/empty'), '');
  for (const status of [401, 403, 404, 500, undefined]) {
    const data = { message: 'Bounded server message' };
    failure = status === undefined ? new Error('private-network-detail') : { response: { status, data } };
    await assert.rejects(ctx.request('/fixture'), error => {
      assert.ok(error instanceof ctx.ErrorType);
      assert.equal(error.status, status);
      assert.equal(error.data, status === undefined ? undefined : data);
      assert.equal(error.message, status === undefined
        ? 'Unable to reach the server. Please try again.' : data.message);
      return true;
    });
  }
  failure = { response: { status: 502, data: '<html>upstream</html>' } };
  await assert.rejects(ctx.request('/fixture'), error => error.message === 'Request failed. Please try again.');
});

test('frontend HTTP consumers centralize transport and public auth explicitly opts out', () => {
  for (const file of ['A.jsx', 'HomePage.jsx', 'ProfilePage.jsx', 'PublicUserProfile.jsx', '../hooks/useMessaging.js']) {
    const source = fs.readFileSync(frontendPath(file), 'utf8');
    assert.match(source, /import \{[^}]*apiRequest[^}]*\} from ['"]\.\.\/services\/apiClient['"]/);
    assert.equal(/\bfetch\s*\(|\baxios\b|Authorization|VITE_API_URL/.test(source), false);
    if (file !== 'A.jsx') assert.equal(/auth:\s*false/.test(source), false);
  }
  const auth = fs.readFileSync(frontendPath('A.jsx'), 'utf8');
  for (const endpoint of ['login', 'register', 'verify-otp', 'forgot-password', 'reset-password']) {
    assert.match(auth, new RegExp("apiRequest\\('/api/auth/" + endpoint + "', \\{\\s*method: 'POST', auth: false"));
  }
  assert.ok(auth.includes("apiRequest('/api/auth/me')"));
  const messages = fs.readFileSync(frontendPath('../hooks/useMessaging.js'), 'utf8');
  assert.ok(messages.includes('io(API_BASE_URL, { autoConnect: false })'));
  assert.ok(messages.includes('socket.auth = { token: authToken }'));
  const card = fs.readFileSync(frontendPath('ExperienceCard.jsx'), 'utf8');
  assert.ok(card.includes("import { API_BASE_URL } from '../services/apiClient'"));
  assert.equal(card.includes('VITE_API_URL'), false);
  assert.ok(card.includes('handleUpvote(exp._id)'));
  assert.ok(card.includes('handleDownvote(exp._id)'));
  const profile = fs.readFileSync(frontendPath('PublicUserProfile.jsx'), 'utf8');
  assert.ok(profile.includes('apiRequest(`/api/users/${id}`)'));
});

test('login session validation preserves credentials on connectivity failures and ignores obsolete responses', async () => {
  const source = fs.readFileSync(frontendPath('A.jsx'), 'utf8');
  const start = source.indexOf('  useEffect(() => {');
  const effect = source.slice(start, source.indexOf('  }, [navigate]);', start) + '  }, [navigate]);'.length);
  for (const scenario of ['none', 'valid', 401, 403, 500, 'network', 'unmount', 'replacement']) {
    const storage = new Map(scenario === 'none' ? [] : [['authToken', 'fixture'], ['user', 'old-user']]);
    const redirects = [];
    let cleanup; let resolve; let reject; let calls = 0;
    vm.runInNewContext(effect, {
      localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      navigate: (...args) => redirects.push(args),
      useEffect: fn => { cleanup = fn(); },
      apiRequest: url => { assert.equal(url, '/api/auth/me'); calls++; return new Promise((yes, no) => { resolve = yes; reject = no; }); },
    });
    if (scenario === 'none') { assert.equal(calls, 0); continue; }
    if (scenario === 'unmount') cleanup();
    if (scenario === 'replacement') storage.set('authToken', 'new-token');
    if (['valid', 'unmount', 'replacement'].includes(scenario)) resolve({ _id: a });
    else reject({ status: scenario === 'network' ? undefined : scenario });
    await new Promise(done => setImmediate(done));
    assert.equal(storage.has('authToken'), ![401, 403].includes(scenario));
    assert.equal(storage.has('user'), ![401, 403].includes(scenario));
    assert.equal(redirects.length, scenario === 'valid' ? 1 : 0);
    if (scenario === 'valid') {
      assert.equal(redirects[0][0], '/home'); assert.equal(redirects[0][1].replace, true);
      assert.equal(JSON.parse(storage.get('user'))._id, a);
    }
    if (scenario === 'replacement') assert.equal(storage.get('authToken'), 'new-token');
  }
});

for (const file of ['HomePage.jsx', 'ProfilePage.jsx', 'PublicUserProfile.jsx']) {
  test(file + ' authenticated content reads and nesting compatibility', async () => {
    const source = fs.readFileSync(frontendPath(file), 'utf8');
    const feedSource = file === 'HomePage.jsx' ? fs.readFileSync(frontendPath('home/ExperienceFeed.jsx'), 'utf8') : fs.readFileSync(frontendPath('profile/ProfileExperienceFeed.jsx'), 'utf8');
    const dataSource = file === 'HomePage.jsx' ? fs.readFileSync(frontendPath('../hooks/useHomeExperiences.js'), 'utf8') : fs.readFileSync(frontendPath('../hooks/useProfileExperiences.js'), 'utf8');
    assert.ok(source.includes("import { apiRequest } from '../services/apiClient'"));
    assert.equal(/\bfetch\s*\(|\baxios\s*\.|Authorization|auth:\s*false/.test(source), false);
    assert.ok(feedSource.includes('const MAX_NESTING = 3;'));
    assert.ok(feedSource.includes('MAX_NESTING={MAX_NESTING}'));
    assert.equal(feedSource.includes('handleEditComment={() => {}}'), false);
    assert.ok(feedSource.includes('(commentId, commentText) =>'));
    if (file === 'HomePage.jsx') {
      const gets = [...dataSource.matchAll(/apiRequest\(([\s\S]*?)\);/g)].map(match => match[1])
        .filter(call => /api\/(experiences|comments)/.test(call) && !call.includes('method:'));
      assert.equal(gets.length, 3); gets.forEach(call => assert.equal(call.includes('auth: false'), false));
      assert.equal((dataSource.match(/onAuthFailure\(err.status\)/g) || []).length, 3);
    } else {
      assert.equal(/\/api\/(experiences|comments)/.test(source), false);
      const begin = source.indexOf('  const handleContentAuthFailure =');
      const policy = source.slice(begin, source.indexOf('  }, [navigate]);', begin) + '  }, [navigate]);'.length);
      const readStart = dataSource.indexOf('  const readContent =');
      const helper = dataSource.slice(readStart, dataSource.indexOf('  }, [onAuthFailure]);', readStart) + '  }, [onAuthFailure]);'.length);
      for (const status of [200, 401, 403, 500, undefined]) {
        const removed = []; const redirects = [];
        const ctx = vm.createContext({ useCallback: fn => fn, localStorage: { removeItem: key => removed.push(key) }, navigate: (...args) => redirects.push(args),
          apiRequest: async url => { assert.equal(url, '/fixture'); if (status !== 200) throw { status }; return ['parsed-content']; } });
        vm.runInContext(policy + '\nconst onAuthFailure = handleContentAuthFailure;\n' + helper + '\nglobalThis.read = readContent;', ctx);
        if (status === 200) await ctx.read('/fixture'); else await assert.rejects(ctx.read('/fixture'));
        assert.equal(removed.length, [401, 403].includes(status) ? 2 : 0);
        if (removed.length) { assert.equal(redirects[0][0], '/login'); assert.equal(redirects[0][1].replace, true); }
      }
    }
    if (file !== 'PublicUserProfile.jsx') {
      const helper = dataSource.slice(dataSource.indexOf('const experienceContent ='), dataSource.indexOf('\n});', dataSource.indexOf('const experienceContent =')) + 4);
      const ctx = vm.createContext({}); vm.runInContext(helper + '\nglobalThis.pick = experienceContent;', ctx);
      const picked = ctx.pick({ ...content, ...protectedFields, rounds: [{ roundName: 'HR', user: b, _id: y }] });
      assert.deepEqual(Object.keys(picked).sort(), Object.keys(content).sort());
      assert.deepEqual(Object.keys(picked.rounds[0]).sort(), ['duration', 'questions', 'roundName']);
      assert.equal(dataSource.includes('JSON.stringify(editFormData)'), false);
      if (file === 'HomePage.jsx') {
        assert.equal((dataSource.match(/data: experienceContent\(formData\)/g) || []).length, 2);
        assert.equal(helper.includes('department'), false);
      } else assert.ok(dataSource.includes('experienceContent(editFormData)'));
    }
  });
}
test('CommentThread limits Reply control/input and uses consistent edit/save arguments', () => {
  const source = fs.readFileSync(frontendPath('CommentThread.jsx'), 'utf8');
  assert.ok(source.includes('{level + 1 < MAX_NESTING && <button'));
  assert.ok(source.includes('{level + 1 < MAX_NESTING && replyingTo === comment._id'));
  assert.ok(source.includes('handleEditComment(comment._id, comment.text)'));
  assert.ok(source.includes('handleEditCommentSave(expId, comment._id)'));
  const profileFeed = fs.readFileSync(frontendPath('profile/ProfileExperienceFeed.jsx'), 'utf8');
  assert.ok(profileFeed.includes('handleEditCommentSave={handleEditCommentSave}'));
  assert.ok(profileFeed.includes('data.editComment(postId, commentId, editingCommentText,'));
});

test('HomePage composes one feed hook and extracted UI without duplicating transport', () => {
  const home = fs.readFileSync(frontendPath('HomePage.jsx'), 'utf8');
  for (const component of ['ExperienceFilters', 'ExperienceFeed', 'ExperienceFormModal']) {
    assert.ok(home.includes(`import ${component} from './home/${component}'`));
    assert.ok(home.includes(`<${component} `));
  }
  assert.ok(home.includes("import useHomeExperiences from '../hooks/useHomeExperiences'"));
  assert.equal((home.match(/useHomeExperiences\(/g) || []).length, 1);
  assert.equal(/<form|\/api\/experiences|\/api\/comments|\/upvote|\/downvote/.test(home), false);
  assert.ok(home.includes('onAuthFailure: handleContentAuthFailure'));
  const hook = fs.readFileSync(frontendPath('../hooks/useHomeExperiences.js'), 'utf8');
  assert.ok(hook.includes("import { apiRequest } from '../services/apiClient'"));
  assert.equal(/\bfetch\s*\(|\baxios\b|VITE_API_URL|Authorization|auth:\s*false|localStorage|useNavigate/.test(hook), false);
  for (const file of ['ExperienceFilters', 'ExperienceFeed', 'ExperienceFormModal']) {
    const source = fs.readFileSync(frontendPath(`home/${file}.jsx`), 'utf8');
    assert.equal(/apiRequest|useHomeExperiences|\bfetch\s*\(|\baxios\b|Authorization/.test(source), false);
  }
  const feed = fs.readFileSync(frontendPath('home/ExperienceFeed.jsx'), 'utf8');
  for (const [prop, handler] of Object.entries({
    handleEditExperience: 'onEditExperience', handleDeleteExperience: 'deleteExperience',
    handleUpvote: 'upvote', handleDownvote: 'downvote', handleDeleteComment: 'deleteComment',
    handlePostComment: 'handlePostComment', handleEditComment: 'handleEditComment',
    handleEditCommentSave: 'handleEditCommentSave', toggleDescription: 'toggleDescription',
    toggleRounds: 'toggleRounds', toggleComments: 'toggleComments',
  })) assert.ok(feed.includes(`${prop}={${handler}}`));
  assert.ok(feed.includes('editComment(expId, commentId, editingCommentText,'));
});

// Exercise the actual hook with mocked transport and a minimal state/effect scheduler.
// This is intentionally isolated Node coverage, not a replacement for React/browser testing.
function homeHookHarness(respond, configuration = {}) {
  const slots = []; const effects = []; const calls = []; const auth = []; const alerts = []; const confirmations = []; const fatal = [];
  let cursor = 0; let dirty = true; let current; let confirmResult = true;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const ctx = vm.createContext({
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => {
        const value = typeof next === 'function' ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] || (slots[index] = { current: initial }); },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index], deps)) { slots[index] = deps; effects.push(fn); }
    },
    apiRequest: async (url, options = {}) => { calls.push({ url, ...options }); return respond(url, options); },
    alert: message => alerts.push(message), console: { error() {} },
    window: { confirm: message => { confirmations.push(message); return confirmResult; } },
  });
  const source = fs.readFileSync(frontendPath(configuration.source || '../hooks/useHomeExperiences.js'), 'utf8');
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export default ', '') + '\nglobalThis.mount = ' + (configuration.name || 'useHomeExperiences') + ';', ctx);
  const onAuthFailure = status => auth.push(status);
  let props = { ...configuration.props, onAuthFailure, onFatalReadFailure: () => fatal.push(true) };
  return {
    calls, auth, alerts, confirmations, fatal,
    setProps(next) { props = { ...props, ...next }; dirty = true; },
    get data() { return current; },
    set confirm(value) { confirmResult = value; },
    async flush() {
      for (let turn = 0; turn < 30; turn++) {
        if (dirty) { cursor = 0; dirty = false; current = ctx.mount(props); }
        effects.splice(0).forEach(effect => effect());
        await new Promise(done => setImmediate(done));
        if (!dirty && effects.length === 0) return;
      }
      assert.fail('Home hook did not settle');
    },
  };
}
const feedReads = harness => harness.calls.filter(call => call.url === '/api/experiences' && !call.method);
const plain = value => JSON.parse(JSON.stringify(value));
function homeResponse(url, options) {
  if (url.endsWith('/count')) return { count: 2 };
  if (url.startsWith('/api/comments/experience/')) return [{ _id: root, text: 'comment' }];
  if (options.method) return { _id: reply, upvotes: 7, downvotes: 1 };
  return { experiences: [{ _id: options.params.page === 1 ? x : y, upvotes: 0, downvotes: 0 }], totalPages: 4 };
}

test('Home hook replaces page one, appends later pages, and preserves filter/search/sort behavior', async () => {
  const h = homeHookHarness(homeResponse); await h.flush();
  assert.deepEqual(plain(h.data.experiences.map(exp => exp._id)), [x]);
  assert.equal(h.data.loading, false); assert.equal(h.data.totalPages, 4);
  assert.deepEqual(plain(feedReads(h)[0].params), { page: 1, limit: 10, sortOrder: 'latest' });
  const filters = { company: 'Example', role: 'Engineer', department: 'CSE', difficulty: 'Medium' };
  h.data.setFilters(filters); await h.flush();
  assert.equal(feedReads(h).length, 1, 'typing must not fetch');
  h.data.loadMore(); await h.flush();
  assert.equal(h.data.page, 2);
  assert.deepEqual(plain(h.data.experiences.map(exp => exp._id)), [x, y]);
  assert.deepEqual(plain(feedReads(h).at(-1).params), { page: 2, limit: 10, ...filters, sortOrder: 'latest' });
  h.data.setSortOrder('oldest'); await h.flush();
  assert.equal(h.data.page, 2, 'sort retains the current page');
  assert.equal(feedReads(h).at(-1).params.sortOrder, 'oldest');
  assert.equal(feedReads(h).at(-1).params.page, 2);
  assert.deepEqual(plain(h.data.experiences.map(exp => exp._id)), [x, y, y]);
  await h.data.search({ company: 'Changed' }); await h.flush();
  assert.equal(h.data.page, 1);
  assert.deepEqual(plain(h.data.experiences.map(exp => exp._id)), [x]);
  assert.deepEqual(plain(feedReads(h).at(-1).params), { page: 1, limit: 10, company: 'Changed', sortOrder: 'oldest' });
});

test('Home create/update/delete refresh page one, allowlist content, and retain delete confirmation', async () => {
  const h = homeHookHarness(homeResponse); await h.flush();
  const draft = { ...content, ...protectedFields, rounds: [{ roundName: 'HR', questions: 'Why?', duration: '30', user: b, _id: y }] };
  for (const action of ['createExperience', 'updateExperience', 'deleteExperience']) {
    h.data.loadMore(); await h.flush();
    const before = h.calls.length;
    const result = await (action === 'createExperience' ? h.data[action](draft) : h.data[action](x, draft));
    await h.flush();
    if (action !== 'deleteExperience') assert.equal(result, true);
    assert.equal(h.data.page, 1);
    assert.deepEqual(plain(h.data.experiences.map(exp => exp._id)), [x]);
    assert.ok(h.calls.slice(before).some(call => call.params?.page === 1));
    const write = h.calls.slice(before).find(call => call.method);
    assert.equal(write.url, action === 'createExperience' ? '/api/experiences' : `/api/experiences/${x}`);
    assert.equal(write.method, { createExperience: 'POST', updateExperience: 'PUT', deleteExperience: 'DELETE' }[action]);
    if (write.method !== 'DELETE') {
      assert.deepEqual(Object.keys(write.data).sort(), Object.keys(content).sort());
      assert.deepEqual(plain(write.data.rounds), [{ roundName: 'HR', questions: 'Why?', duration: '30' }]);
      for (const field of Object.keys(protectedFields)) assert.equal(field in write.data, false);
    }
  }
  assert.deepEqual(h.confirmations, ['Are you sure you want to delete this experience?']);
  h.confirm = false; const before = h.calls.length;
  await h.data.deleteExperience(x); await h.flush();
  assert.equal(h.calls.length, before);
});

test('Home votes update only the target counts and preserve per-experience loading and empty payloads', async () => {
  let release;
  const h = homeHookHarness((url, options) => options.method ? new Promise(resolve => { release = resolve; }) : homeResponse(url, options));
  await h.flush(); h.data.loadMore(); await h.flush();
  for (const action of ['upvote', 'downvote']) {
    const untouched = h.data.experiences[1];
    const pending = h.data[action](x); await h.flush();
    assert.equal(h.data.voteLoading[x], true); assert.equal(h.data.voteLoading[y], undefined);
    const write = h.calls.findLast(call => call.method);
    assert.equal(write.url, `/api/experiences/${x}/${action}`);
    assert.equal(write.method, 'POST'); assert.deepEqual(plain(write.data), {});
    release({ upvotes: 7, downvotes: 1 }); await pending; await h.flush();
    assert.equal(h.data.voteLoading[x], false);
    assert.equal(h.data.experiences[0].upvotes, 7); assert.equal(h.data.experiences[0].downvotes, 1);
    assert.equal(h.data.experiences[1], untouched);
  }
});

test('Home root/reply/edit/delete comment mutations refresh comments and count with content-only payloads', async () => {
  const h = homeHookHarness(homeResponse); await h.flush();
  for (const action of ['root', 'reply', 'edit', 'delete']) {
    let cleared = false; const before = h.calls.length;
    const clear = () => { cleared = true; assert.equal(h.calls.length, before + 1, 'clear draft after write, before refresh'); };
    if (action === 'root' || action === 'reply') {
      const pending = h.data.postComment(x, 'draft', action === 'reply' ? root : null, clear);
      await h.flush(); assert.equal((await pending)._id, reply);
    } else if (action === 'edit') await h.data.editComment(x, root, 'edited', clear);
    else await h.data.deleteComment(x, root);
    await h.flush();
    const calls = h.calls.slice(before);
    assert.deepEqual(calls.map(call => call.url), [
      ['root', 'reply'].includes(action) ? '/api/comments' : `/api/comments/${root}`,
      `/api/comments/experience/${x}`, `/api/comments/experience/${x}/count`,
    ]);
    assert.equal(calls[0].method, { root: 'POST', reply: 'POST', edit: 'PUT', delete: 'DELETE' }[action]);
    if (['root', 'reply'].includes(action)) assert.deepEqual(plain(calls[0].data), { experienceId: x, text: 'draft', parentCommentId: action === 'root' ? null : root });
    if (action === 'edit') assert.deepEqual(plain(calls[0].data), { text: 'edited' });
    assert.equal(cleared, action !== 'delete');
    assert.equal(h.data.commentCounts[x], 2);
    assert.equal(h.data.allComments[x][0]._id, root);
    assert.equal(h.data.commentLoading[x], false);
  }
});

test('Home malformed read responses remain bounded with safe array/count fallbacks', async () => {
  for (const response of [null, {}, { experiences: {} }]) {
    const h = homeHookHarness(() => response); await h.flush();
    assert.equal(h.data.error, 'Failed to load experiences.');
    assert.equal(h.data.loading, false); assert.deepEqual(plain(h.data.experiences), []);
  }
  for (const count of [-1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1, null]) {
    const h = homeHookHarness((url, options) => url.endsWith('/count') ? { count }
      : url.startsWith('/api/comments/experience/') ? { comments: [] } : homeResponse(url, options));
    await h.flush();
    assert.equal(h.data.error, null); assert.equal(h.data.commentCounts[x], 0);
    assert.deepEqual(plain(h.data.allComments[x]), []);
  }
});

test('Home read failures delegate status and retain the page-owned 401/403 logout policy', async () => {
  for (const endpoint of ['/api/experiences', `/api/comments/experience/${x}`, `/api/comments/experience/${x}/count`]) {
    for (const status of [401, 403, 500, undefined]) {
      const h = homeHookHarness((url, options) => { if (url === endpoint) throw { status }; return homeResponse(url, options); });
      await h.flush(); assert.deepEqual(h.auth, [status]);
    }
  }
  const home = fs.readFileSync(frontendPath('HomePage.jsx'), 'utf8');
  const start = home.indexOf('  const handleContentAuthFailure =');
  const policy = home.slice(start, home.indexOf('  }, [navigate]);', start) + '  }, [navigate]);'.length);
  for (const status of [401, 403, 500, undefined]) {
    const removed = []; const redirects = [];
    const ctx = vm.createContext({ useCallback: fn => fn, localStorage: { removeItem: key => removed.push(key) }, navigate: (...args) => redirects.push(args) });
    vm.runInContext(policy + '\nglobalThis.fail = handleContentAuthFailure;', ctx); ctx.fail(status);
    assert.deepEqual(removed, [401, 403].includes(status) ? ['authToken', 'user'] : []);
    assert.equal(redirects.length, [401, 403].includes(status) ? 1 : 0);
    if (redirects.length) { assert.equal(redirects[0][0], '/login'); assert.equal(redirects[0][1].replace, true); }
  }
});

test('Home failed writes keep existing alerts, drafts, and mutation auth policy without refresh', async () => {
  const h = homeHookHarness((url, options) => { if (options.method) throw { status: 401 }; return homeResponse(url, options); });
  await h.flush(); const readsBefore = h.calls.length; let cleared = false;
  assert.equal(await h.data.createExperience(content), false);
  assert.equal(await h.data.updateExperience(x, content), false);
  await h.data.deleteExperience(x);
  assert.equal(await h.data.postComment(x, 'draft', null, () => { cleared = true; }), null);
  await h.data.editComment(x, root, 'draft', () => { cleared = true; });
  await h.data.deleteComment(x, root); await h.data.upvote(x); await h.data.downvote(x); await h.flush();
  assert.equal(cleared, false); assert.deepEqual(h.auth, []);
  assert.equal(h.calls.length, readsBefore + 8);
  assert.equal(h.data.commentLoading[x], false); assert.equal(h.data.voteLoading[x], false);
  assert.deepEqual(h.alerts, ['Failed to post experience', 'Failed to update experience', 'Failed to delete experience',
    'Failed to post comment', 'Failed to update comment', 'Failed to delete comment', 'Failed to upvote', 'Failed to downvote']);
});

test('Home modal drafts start clean and edit rounds cannot alias the selected feed experience', () => {
  const source = fs.readFileSync(frontendPath('home/ExperienceFormModal.jsx'), 'utf8');
  const helpers = source.slice(source.indexOf('const blankDraft'), source.indexOf('export default'));
  const ctx = vm.createContext({}); vm.runInContext(helpers + '\nglobalThis.blank = blankDraft; globalThis.edit = editDraft;', ctx);
  const first = ctx.blank(); const second = ctx.blank();
  first.rounds[0].questions = 'new question'; assert.equal(second.rounds[0].questions, '');
  assert.deepEqual(Object.keys(second).sort(), Object.keys(content).sort());
  const selected = { ...content, ...protectedFields, roundDate: '2026-09-01T00:00:00.000Z', rounds: [{ roundName: 'HR', questions: 'Original', duration: '30' }] };
  const draft = ctx.edit(selected); draft.rounds[0].questions = 'Unsaved';
  assert.equal(selected.rounds[0].questions, 'Original');
  assert.deepEqual(Object.keys(draft).sort(), Object.keys(content).sort());
  assert.ok(source.includes("new Date(formData.roundDate).toISOString().slice(0, 10)"));
  assert.ok(source.includes("required={mode === 'create'}"));
  assert.ok(source.includes("if (mode === 'create') setFormData(blankDraft())"));
});

const profileFixture = { _id: a, name: 'Viewed author', department: 'CSE' };
const profileSource = file => fs.readFileSync(frontendPath(file), 'utf8');
const profileResponse = (url, options) => {
  if (options.method) return { _id: x, ...content, upvotes: 5, downvotes: 2, user: { _id: b } };
  if (url.startsWith('/api/experiences/user/')) return [{ _id: x, ...content }, { _id: y, ...content }];
  return [{ _id: root, experienceId: x, text: 'comment' }];
};
async function profileHarness(mode = 'own', respond = profileResponse) {
  const h = homeHookHarness(respond, { source: '../hooks/useProfileExperiences.js', name: 'useProfileExperiences', props: { profileUser: profileFixture, mode } });
  await h.flush();
  if (mode === 'public') { await h.data.loadExperiences(profileFixture); await h.flush(); }
  return h;
}

test('profile architecture shares feed/state, preserves viewer identity, and keeps page-specific transport', () => {
  for (const file of ['ProfilePage.jsx', 'PublicUserProfile.jsx']) {
    const source = profileSource(file);
    assert.ok(source.includes("import useProfileExperiences from '../hooks/useProfileExperiences'"));
    assert.ok(source.includes("import ProfileExperienceFeed from './profile/ProfileExperienceFeed'"));
    assert.ok(source.includes('<ProfileExperienceFeed '));
    assert.equal(/<ExperienceCard|MAX_NESTING|\/api\/comments|\/api\/experiences|expandedDescriptions|editingCommentId|buildCommentTree|handlePostComment|handleUpvote/.test(source), false);
  }
  const own = profileSource('ProfilePage.jsx'); const publicPage = profileSource('PublicUserProfile.jsx');
  assert.ok(own.includes('viewer={userData}')); assert.ok(publicPage.includes('viewer={currentUser}'));
  assert.ok(publicPage.includes('profileUser: userInfo')); assert.ok(own.includes('profileUser: userData'));
  assert.ok(publicPage.includes('await loadExperiences(userData)'));
  assert.ok(publicPage.includes('useCallback(() => setUserInfo(null), [])'));
  const hook = profileSource('../hooks/useProfileExperiences.js');
  assert.ok(hook.includes("import { apiRequest } from '../services/apiClient'"));
  assert.equal(/\bfetch\s*\(|\baxios\b|Authorization|VITE_API_URL|auth:\s*false|localStorage|useNavigate|useParams|\/api\/auth\/me|\/api\/users\/|\/count/.test(hook), false);
  const feed = profileSource('profile/ProfileExperienceFeed.jsx');
  assert.ok(feed.includes("import ExperienceCard from '../ExperienceCard'"));
  assert.ok(feed.includes('user={viewer}'));
  assert.ok(feed.includes("handleEditExperience={mode === 'own' ? onEditExperience : undefined}"));
  assert.ok(feed.includes("handleDeleteExperience={mode === 'own' ? data.deleteExperience : undefined}"));
  assert.ok(feed.includes("voteLoading={mode === 'own' ? false : data.voteLoading[post._id]}"));
  assert.equal(/apiRequest|\bfetch\s*\(|\baxios\b|localStorage|react-router|parentName|setHighlightedCommentId/.test(feed), false);
});

for (const mode of ['own', 'public']) {
  test('profile ' + mode + ' loads author-mapped experiences and derives counts from validated comment arrays', async () => {
    const h = await profileHarness(mode);
    assert.equal(h.calls.filter(c => c.url === `/api/experiences/user/${a}`).length, 1);
    assert.equal(h.calls.filter(c => c.url.startsWith('/api/comments/experience/')).length, 2);
    assert.equal(h.data.experiences[0].user, profileFixture);
    assert.equal(h.data.postsLoading, false); assert.equal(h.data.commentCounts[x], 1); assert.equal(h.data.commentCounts[y], 1);
    assert.equal(typeof h.data.commentLoading, 'boolean'); assert.deepEqual(h.fatal, []);
    const before = h.calls.length; h.setProps({ profileUser: { ...profileFixture, name: 'Updated' } }); await h.flush();
    assert.equal(h.calls.length, before, 'profile details changes alone do not reload experiences');
  });

  for (const kind of ['experience', 'comment']) {
    test('profile ' + mode + ' preserves initial ' + kind + ' failure semantics', async () => {
      for (const malformed of [false, true]) {
        const h = await profileHarness(mode, (url, options) => {
          if ((kind === 'experience' && url.startsWith('/api/experiences/user/')) || (kind === 'comment' && url.endsWith('/' + x))) {
            if (malformed) return { invalid: [] };
            throw { status: 500 };
          }
          return profileResponse(url, options);
        });
        assert.equal(h.data.postsLoading, false);
        if (mode === 'public') { assert.equal(h.fatal.length, 1); assert.deepEqual(plain(h.data.experiences), []); }
        else {
          assert.deepEqual(h.fatal, []);
          assert.equal(h.data.experiences.length, kind === 'experience' ? 0 : 2);
          if (kind === 'comment') { assert.deepEqual(plain(h.data.allComments[x]), []); assert.equal(h.data.commentCounts[x], 0); assert.equal(h.data.commentCounts[y], 1); }
        }
      }
    });
  }
}

test('profile protected reads delegate status while malformed refresh preserves loaded comments', async () => {
  for (const target of [`/api/experiences/user/${a}`, `/api/comments/experience/${x}`]) {
    for (const status of [401, 403, undefined]) {
      const h = await profileHarness('own', (url, options) => { if (url === target) throw { status }; return profileResponse(url, options); });
      assert.deepEqual(h.auth, [status]); assert.deepEqual(h.fatal, []);
    }
  }
  let malformed = false;
  const h = await profileHarness('public', (url, options) => malformed && url.startsWith('/api/comments/') ? {} : profileResponse(url, options));
  const before = h.data.allComments[x]; malformed = true;
  await h.data.fetchComments(x); await h.flush();
  assert.equal(h.data.allComments[x], before); assert.equal(h.data.commentCounts[x], 1); assert.deepEqual(h.fatal, []);
});

for (const mode of ['own', 'public']) {
  test('profile ' + mode + ' comment writes preserve payloads, draft callbacks and refresh timing', async () => {
    let reject = false; let defer; let hold = false;
    const h = await profileHarness(mode, (url, options) => {
      if (options.method && hold) return new Promise(resolve => { defer = resolve; });
      if (options.method && reject) throw { status: 401 };
      return profileResponse(url, options);
    });
    for (const action of ['root', 'reply', 'edit', 'delete']) {
      for (reject of [true, false]) {
        const before = h.calls.length; let cleared = false;
        const clear = () => { cleared = true; assert.equal(h.calls.length, before + 1); };
        if (action === 'root' || action === 'reply') await h.data.postComment(x, ' draft ', action === 'reply' ? root : undefined, clear);
        else if (action === 'edit') await h.data.editComment(x, root, ' edited ', clear);
        else await h.data.deleteComment(x, root);
        await h.flush();
        const calls = h.calls.slice(before); assert.equal(calls.length, reject ? 1 : 2);
        assert.equal(cleared, !reject && action !== 'delete');
        const write = calls[0]; assert.equal(write.url, ['root', 'reply'].includes(action) ? '/api/comments' : `/api/comments/${root}`);
        assert.equal(write.method, { root: 'POST', reply: 'POST', edit: 'PUT', delete: 'DELETE' }[action]);
        if (action === 'root') assert.deepEqual(plain(write.data), { text: 'draft', experienceId: x });
        if (action === 'reply') assert.deepEqual(plain(write.data), { text: 'draft', experienceId: x, parentCommentId: root });
        if (action === 'edit') assert.deepEqual(plain(write.data), { text: 'edited' });
        if (!reject) assert.equal(calls[1].url, `/api/comments/experience/${x}`);
        assert.equal(h.data.commentLoading, false); assert.deepEqual(h.auth, []);
      }
    }
    const before = h.calls.length;
    await h.data.postComment(x, '  ', undefined, () => assert.fail('empty draft cleared'));
    await h.data.editComment(x, root, ' ', () => assert.fail('empty editor cleared'));
    assert.equal(h.calls.length, before);
    hold = true; const pending = h.data.postComment(x, 'held', undefined, () => {}); await h.flush();
    assert.equal(h.data.commentLoading, true); defer({}); await pending; await h.flush(); assert.equal(h.data.commentLoading, false);
  });

  test('profile ' + mode + ' vote payload, target update, error and loading differences remain', async () => {
    let release; let failure;
    const h = await profileHarness(mode, (url, options) => {
      if (options.method) return new Promise((resolve, reject) => { release = () => failure ? reject(failure) : resolve({ upvotes: 7, downvotes: 2 }); });
      return profileResponse(url, options);
    });
    for (const action of ['upvote', 'downvote']) {
      const other = h.data.experiences[1]; const pending = h.data[action](x); await h.flush();
      assert.equal(h.data.voteLoading[x], mode === 'public' ? true : undefined);
      const write = h.calls.findLast(c => c.method);
      assert.equal(write.url, `/api/experiences/${x}/${action}`); assert.equal(write.method, 'POST'); assert.equal(write.data, undefined);
      release(); await pending; await h.flush();
      assert.equal(h.data.experiences[0].upvotes, 7); assert.equal(h.data.experiences[0].downvotes, 2); assert.equal(h.data.experiences[1], other);
      assert.equal(h.data.voteLoading[x], mode === 'public' ? false : undefined);
      for (const status of [401, 403, undefined]) {
        failure = { status }; const alertsBefore = h.alerts.length; const previous = h.data.experiences[0];
        const failed = h.data[action](x); release(); await failed; await h.flush();
        assert.equal(h.alerts.length, alertsBefore + (mode === 'own' && status === undefined ? 1 : 0));
        if (mode === 'own' && status === undefined) assert.equal(h.alerts.at(-1), 'Failed to ' + action);
        assert.equal(h.data.experiences[0], previous); assert.deepEqual(h.auth, []);
      }
      failure = undefined;
    }
  });
}

test('own profile experience delete confirms and removes only after success without a list refetch', async () => {
  let failure = true;
  const h = await profileHarness('own', (url, options) => { if (options.method && failure) throw { status: 403 }; return profileResponse(url, options); });
  h.confirm = false; const before = h.calls.length; await h.data.deleteExperience(x); await h.flush(); assert.equal(h.calls.length, before);
  assert.equal(h.confirmations[0], 'Are you sure you want to delete this post?');
  h.confirm = true; await h.data.deleteExperience(x); await h.flush(); assert.equal(h.data.experiences.length, 2);
  failure = false; await h.data.deleteExperience(x); await h.flush();
  assert.deepEqual(plain(h.data.experiences.map(p => p._id)), [y]); assert.deepEqual(h.auth, []);
  assert.equal(h.calls.filter(c => c.url === `/api/experiences/user/${a}`).length, 1);
  assert.ok(h.calls.some(c => c.url === `/api/experiences/${x}` && c.method === 'DELETE'));
});

test('own profile experience update allowlists fields, preserves failures and replaces only the response target', async () => {
  let failure = true;
  const h = await profileHarness('own', (url, options) => { if (options.method && failure) throw { status: 403 }; return profileResponse(url, options); });
  const draft = { ...content, ...protectedFields, rounds: [{ roundName: 'HR', questions: 'Why?', duration: '30', _id: root, user: b }] };
  const original = h.data.experiences[0]; const other = h.data.experiences[1];
  assert.equal(await h.data.updateExperience(x, draft), false); await h.flush();
  assert.equal(h.data.experiences[0], original); assert.deepEqual(h.alerts, ['Failed to update experience']);
  failure = false; assert.equal(await h.data.updateExperience(x, draft), true); await h.flush();
  assert.equal(h.data.experiences[0].user, profileFixture); assert.equal(h.data.experiences[1], other);
  const write = h.calls.find(c => c.method === 'PUT'); assert.equal(write.url, `/api/experiences/${x}`);
  assert.deepEqual(Object.keys(write.data).sort(), Object.keys(content).sort());
  assert.deepEqual(plain(write.data.rounds), [{ roundName: 'HR', questions: 'Why?', duration: '30' }]);
  for (const key of Object.keys(protectedFields)) assert.equal(key in write.data, false);
  assert.deepEqual(h.auth, []);
  const publicHook = await profileHarness('public'); const before = publicHook.calls.length;
  assert.equal(await publicHook.data.updateExperience(x, draft), false); await publicHook.data.deleteExperience(x);
  assert.equal(publicHook.calls.length, before);
});

test('shared profile feed preserves tree/sort, draft callbacks, expansion and normalized comment signatures', async () => {
  const source = profileSource('profile/ProfileExperienceFeed.jsx');
  const prefix = source.replace(/^import .*;\r?\n/gm, '').replace('export default ', '').split("  if (mode === 'own' && postsLoading)")[0];
  let slots = []; let cursor = 0; let allowWrite = false; const calls = [];
  const ctx = vm.createContext({ useEffect: fn => fn(), useState: initial => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  } });
  vm.runInContext(prefix + '\nreturn { buildCommentTree, sortedComments, handlePostComment, handlePostReply, handleEditComment, handleEditCommentSave, toggleComments, toggleDescription, toggleRounds, setCommentInputs, setReplyInputs, setReplyingTo, commentInputs, replyInputs, replyingTo, editingCommentId, editingCommentText, expandedDescriptions, expandedRounds }; }\nglobalThis.mount = ProfileExperienceFeed;', ctx);
  const data = { allComments: {}, fetchComments: id => calls.push(['read', id]),
    postComment: async (...args) => { calls.push(args.slice(0,3)); if (allowWrite) args[3](); },
    editComment: async (...args) => { calls.push(args.slice(0,3)); if (allowWrite) args[3](); } };
  const retainedState = { current: null };
  const render = (mode, retain = false) => { cursor = 0; return ctx.mount({ data, mode, viewer: { _id: b }, retainedState: retain ? retainedState : undefined }); };
  let feed = render('own');
  const comments = [{ _id: root, createdAt: '2026-01-01' }, { _id: reply, parentCommentId: root, createdAt: '2026-01-02' }];
  const sorted = feed.sortedComments(comments); assert.equal(sorted[0]._id, reply); assert.equal(comments[0]._id, root);
  const tree = feed.buildCommentTree(sorted); assert.equal(tree[0].replies[0]._id, reply); assert.equal('parentName' in tree[0].replies[0], false);
  assert.deepEqual(plain(feed.buildCommentTree(null)), []);
  feed.toggleDescription(x); feed.toggleRounds(y); feed.toggleComments(x); feed = render('own');
  assert.equal(feed.expandedDescriptions[x], true); assert.equal(feed.expandedRounds[y], true); assert.deepEqual(calls.pop(), ['read', x]);
  slots = []; feed = render('public'); feed.toggleComments(x); assert.equal(calls.length, 0);
  feed.setCommentInputs({ [x]: 'root draft' }); feed.setReplyInputs({ [root]: 'reply draft' }); feed.setReplyingTo(root); feed.handleEditComment(reply, 'edit draft'); feed = render('own');
  await feed.handlePostComment(x); await feed.handlePostReply(x, root); await feed.handleEditCommentSave(x, reply); feed = render('own');
  assert.equal(feed.commentInputs[x], 'root draft'); assert.equal(feed.replyInputs[root], 'reply draft'); assert.equal(feed.editingCommentId, reply);
  const beforeEmptyReply = calls.length;
  await feed.handlePostReply(x, 'missing-reply');
  assert.equal(calls[beforeEmptyReply][1], '', 'an absent reply must not reuse the top-level draft');
  allowWrite = true;
  await feed.handlePostComment(x); await feed.handlePostReply(x, root); await feed.handleEditCommentSave(x, reply); feed = render('own');
  assert.equal(feed.commentInputs[x], ''); assert.equal(feed.replyInputs[root], ''); assert.equal(feed.replyingTo, null); assert.equal(feed.editingCommentId, null); assert.equal(feed.editingCommentText, '');
  assert.deepEqual(calls.at(-1), [x, reply, 'edit draft']);
  feed = render('public', true);
  feed.setCommentInputs({ [x]: 'retained draft' }); feed.toggleDescription(x);
  feed = render('public', true);
  const expandedBeforeUnmount = feed.expandedDescriptions[x];
  slots = []; feed = render('public', true);
  assert.equal(feed.commentInputs[x], 'retained draft');
  assert.equal(feed.expandedDescriptions[x], expandedBeforeUnmount);
  assert.ok(profileSource('PublicUserProfile.jsx').includes('retainedState={feedState}'));
  for (const text of ['MAX_NESTING = 3', 'MAX_NESTING={MAX_NESTING}', 'handleDeleteComment={data.deleteComment}', 'handleEditCommentSave={handleEditCommentSave}', 'highlightedCommentId = null']) assert.ok(source.includes(text));
});

for (const own of [true, false]) {
  test((own ? 'own' : 'public') + ' page user fetch preserves session, missing-token and loading policies', async () => {
    const source = profileSource(own ? 'ProfilePage.jsx' : 'PublicUserProfile.jsx');
    const marker = own ? '  useEffect(() => {\n    const fetchUser =' : '  // Fetch user info, experiences, and comments';
    const start = source.indexOf(marker); const end = source.indexOf(own ? '  }, [navigate]);' : '  }, [id, navigate, loadExperiences]);', start);
    const effect = source.slice(start, end + (own ? '  }, [navigate]);'.length : '  }, [id, navigate, loadExperiences]);'.length));
    for (const status of ['no-token', 200, 401, 403, 500, undefined]) {
      const storage = new Map([['authToken', 'fixture'], ['user', 'stored']]); if (status === 'no-token') storage.delete('authToken');
      const redirects = []; const loads = []; let user; let loading; let finishContent;
      vm.runInNewContext(effect, { id: a, navigate: (...args) => redirects.push(args), useEffect: fn => fn(),
        localStorage: { getItem: key => storage.get(key), removeItem: key => storage.delete(key) },
        setLoading: value => { loading = value; }, setUserData: value => { user = value; }, setFormData() {}, setUserInfo: value => { user = value; },
        loadExperiences: value => { loads.push(value); return new Promise(resolve => { finishContent = resolve; }); },
        apiRequest: async url => { assert.equal(url, own ? '/api/auth/me' : `/api/users/${a}`); if (status !== 200) throw { status }; return profileFixture; },
      });
      await new Promise(resolve => setImmediate(resolve));
      if (status === 200 && !own) { assert.equal(loading, true); assert.equal(loads[0], profileFixture); finishContent(true); await new Promise(resolve => setImmediate(resolve)); }
      assert.equal(loading, false);
      assert.equal(storage.has('user'), ![401, 403].includes(status));
      assert.equal(redirects.length, [401, 403].includes(status) || (!own && status === 'no-token') ? 1 : 0);
      if ([401, 403].includes(status)) { assert.equal(redirects[0][0], '/login'); assert.equal(redirects[0][1].replace, true); }
      if (!own && status === 'no-token') assert.deepEqual(redirects[0], ['/login']);
      if (status === 200) assert.equal(user, profileFixture);
      if (!own && [500, undefined].includes(status)) assert.equal(user, null);
    }
  });
}

test('own profile update and experience modal retain page-specific state, copy and failure behavior', async () => {
  const source = profileSource('ProfilePage.jsx');
  const start = source.indexOf('  const handleSubmit ='); const helper = source.slice(start, source.indexOf('\n  };', start) + 5);
  for (const status of [200, 403, undefined]) {
    const state = {}; const storage = new Map(); const formData = { name: 'Updated', email: 'unchanged-form-field' };
    const ctx = vm.createContext({ formData, setMsg: v => { state.msg = v; }, setError: v => { state.error = v; }, setSubmitting: v => { state.submitting = v; },
      setUserData: v => { state.user = v; }, setIsEditing: v => { state.editing = v; }, localStorage: { setItem: (k,v) => storage.set(k,v) },
      apiRequest: async (url, options) => { assert.equal(url, '/api/auth/me'); assert.equal(options.method, 'PUT'); assert.equal(options.data, formData); if (status !== 200) throw { status }; return profileFixture; },
    });
    vm.runInContext(helper + '\nglobalThis.submit = handleSubmit;', ctx); await ctx.submit({ preventDefault() {} });
    assert.equal(state.submitting, false);
    if (status === 200) { assert.equal(state.msg, 'Profile updated!'); assert.equal(state.editing, false); assert.deepEqual(JSON.parse(storage.get('user')), profileFixture); }
    else { assert.equal(state.error, status === undefined ? 'Failed to update profile. Please try again.' : 'Failed to update profile.'); assert.equal(storage.size, 0); }
  }
  for (const text of ['Go to Home', 'Your Posts', 'Choose an Avatar', 'Save Changes', 'Cancel', 'Edit Your Interview Experience',
    'if (await data.updateExperience(editFormData._id, editFormData))', 'setEditFormData(exp)', 'newRounds[index].roundName = e.target.value']) assert.ok(source.includes(text));
  const publicPage = profileSource('PublicUserProfile.jsx');
  for (const text of ['User not found.', 'Loading...', 'Send Message', 'navigate(`/message?user=${userInfo._id}`)', 'navigate(-1)', 'localStorage.getItem("user")']) assert.ok(publicPage.includes(text));
});


test('own profile initializes navigate before effect dependencies (authorized baseline fix)', () => {
  const source = profileSource('ProfilePage.jsx');
  const start = source.indexOf('const ProfilePage = () => {');
  const declaration = source.indexOf('const navigate = useNavigate();', start);
  assert.ok(declaration > start);
  assert.ok(declaration < source.indexOf('[navigate]', start));
  assert.equal((source.match(/const navigate = useNavigate\(\);/g) || []).length, 1);
});

test('RoundRelay branding is consistent across public copy and package metadata', () => {
  const landing = fs.readFileSync(frontendPath('LandingPage.jsx'), 'utf8');
  const home = fs.readFileSync(frontendPath('HomePage.jsx'), 'utf8');
  const frontendRoot = path.resolve(frontendPath('.'), '../..');
  const html = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package-lock.json'), 'utf8'));
  const tagline = 'Real interview experiences, passed forward.';
  assert.match(landing, /RoundRelay/);
  assert.ok(landing.includes(tagline));
  assert.match(landing, /Peer Shared/);
  assert.match(landing, /real, peer-shared experiences/);
  assert.doesNotMatch(landing, /Verified Stories|real, verified experiences/i);
  assert.match(home, />RoundRelay<\/h2>/);
  assert.ok(html.includes('<title>RoundRelay | Real Interview Experiences</title>'));
  assert.ok(html.includes('<meta name="description" content="RoundRelay helps students share real interview experiences and pass useful interview knowledge forward." />'));
  assert.doesNotMatch(html, /vite\.svg|rel="icon"/);
  assert.match(readme, /^# RoundRelay\r?\n/);
  assert.ok(readme.includes('> ' + tagline));
  assert.equal(packageJson.name, 'roundrelay');
  assert.equal(lock.name, 'roundrelay');
  assert.equal(lock.packages[''].name, 'roundrelay');
  for (const source of [landing, home, html, readme]) {
    // The retained technical frontend directory is not a visible product label.
    assert.doesNotMatch(source.replace(/Frontend\/interview(?:hub)\/?/g, ''), /(?:Career|Carer)Stories|Interview(?:Hub)/i);
    for (const name of source.match(/roundrelay/gi) || []) assert.equal(name, 'RoundRelay');
  }
});
