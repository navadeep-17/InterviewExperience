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
for (const file of ['HomePage.jsx', 'ProfilePage.jsx', 'PublicUserProfile.jsx']) {
  test(file + ' authenticated content reads and nesting compatibility', async () => {
    const source = fs.readFileSync(frontendPath(file), 'utf8');
    assert.ok(source.includes('const MAX_NESTING = 3;'));
    assert.ok(source.includes('MAX_NESTING={MAX_NESTING}'));
    assert.equal(source.includes('handleEditComment={() => {}}'), false);
    assert.ok(source.includes('(commentId, commentText) =>'));
    if (file === 'HomePage.jsx') {
      const gets = [...source.matchAll(/axios.get\(([\s\S]*?)\);/g)].map(match => match[1]).filter(call => /api\/(experiences|comments)/.test(call));
      assert.equal(gets.length, 3); gets.forEach(call => assert.ok(call.includes('Authorization:')));
      assert.equal((source.match(/handleContentAuthFailure\(err.response\?\.status\)/g) || []).length, 3);
    } else {
      assert.equal(/await fetch\([^\n]+\/api\/(experiences\/user|comments\/experience)/.test(source), false);
      assert.equal((source.match(/await fetchContent\(/g) || []).length, 3);
      const helper = source.slice(source.indexOf('  const fetchContent ='), source.indexOf('\n  };', source.indexOf('  const fetchContent =')) + 5);
      for (const status of [200, 401, 403, 500]) {
        const removed = []; const redirects = [];
        const ctx = vm.createContext({ localStorage: { getItem: () => 'fixture', removeItem: key => removed.push(key) }, navigate: (...args) => redirects.push(args),
          fetch: async (url, options) => { assert.equal(options.headers.Authorization, 'Bearer fixture'); return { status, ok: status === 200 }; } });
        vm.runInContext(helper + '\nglobalThis.read = fetchContent;', ctx);
        if (status === 200) await ctx.read('/fixture'); else await assert.rejects(ctx.read('/fixture'));
        assert.equal(removed.length, [401, 403].includes(status) ? 2 : 0);
        if (removed.length) { assert.equal(redirects[0][0], '/login'); assert.equal(redirects[0][1].replace, true); }
      }
    }
    if (file !== 'PublicUserProfile.jsx') {
      const helper = source.slice(source.indexOf('const experienceContent ='), source.indexOf('\n});', source.indexOf('const experienceContent =')) + 4);
      const ctx = vm.createContext({}); vm.runInContext(helper + '\nglobalThis.pick = experienceContent;', ctx);
      const picked = ctx.pick({ ...content, ...protectedFields, rounds: [{ roundName: 'HR', user: b, _id: y }] });
      assert.deepEqual(Object.keys(picked).sort(), Object.keys(content).sort());
      assert.deepEqual(Object.keys(picked.rounds[0]).sort(), ['duration', 'questions', 'roundName']);
      assert.ok(source.includes('experienceContent(editFormData)'));
      assert.equal(source.includes('JSON.stringify(editFormData)'), false);
      if (file === 'HomePage.jsx') { assert.ok(source.includes('experienceContent(formData)')); assert.equal(source.includes("department: ''"), false); }
    }
  });
}
test('CommentThread limits Reply control/input and uses consistent edit/save arguments', () => {
  const source = fs.readFileSync(frontendPath('CommentThread.jsx'), 'utf8');
  assert.ok(source.includes('{level + 1 < MAX_NESTING && <button'));
  assert.ok(source.includes('{level + 1 < MAX_NESTING && replyingTo === comment._id'));
  assert.ok(source.includes('handleEditComment(comment._id, comment.text)'));
  assert.ok(source.includes('handleEditCommentSave(expId, comment._id)'));
  const publicSource = fs.readFileSync(frontendPath('PublicUserProfile.jsx'), 'utf8');
  assert.ok(publicSource.includes('handleEditCommentSave={(postId, commentId) => handleEditCommentSave(commentId, postId)}'));
});
