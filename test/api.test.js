const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const createApp = require('../app');

const secret = 'test-only-secret-with-at-least-32-bytes';
const users = [];
const appointments = [];
const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);

// Somente a persistência é simulada. HTTP, validadores, bcrypt e JWT são reais.
const models = {
  User: {
    scope() { return this; },
    async findOne({ where }) { return users.find((row) => matches(row, where)) || null; },
    async create(values) {
      const user = { id: users.length + 1, ...values };
      users.push(user);
      return user;
    },
  },
  Appointment: {
    async create(values) {
      const appointment = { id: appointments.length + 1, status: 'scheduled', ...values };
      appointments.push(appointment);
      return appointment;
    },
    async findOne({ where }) { return appointments.find((row) => matches(row, where)) || null; },
    async findAndCountAll({ where, limit, offset }) {
      const rows = appointments.filter((row) => matches(row, where))
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id - b.id);
      return { rows: rows.slice(offset, offset + limit), count: rows.length };
    },
    async update(values, { where }) {
      const row = appointments.find((item) => matches(item, where));
      if (!row) return [0];
      Object.assign(row, values);
      return [1];
    },
  },
};

let server;
let baseUrl;
let token;
let otherToken;
let appointmentId;

before(async () => {
  server = createApp({ models, jwtSecret: secret }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function request(method, path, body, bearer) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test('cadastro sanitiza os valores, gera o hash da senha e omite dados sensíveis', async () => {
  const result = await request('POST', '/users/register', {
    name: '  Ana Silva  ', email: '  ANA@EXAMPLE.COM  ', password: 'StrongPass123!',
  });
  assert.equal(result.status, 201);
  assert.deepEqual(result.body.user, { id: 1, name: 'Ana Silva', email: 'ana@example.com' });
  assert.notEqual(users[0].passwordHash, 'StrongPass123!');
  assert.equal(await bcrypt.compare('StrongPass123!', users[0].passwordHash), true);
  assert.equal(bcrypt.getRounds(users[0].passwordHash), 12);
});

test('cadastro rejeita e-mails duplicados, dados inválidos e senhas acima do limite do bcrypt', async () => {
  assert.equal((await request('POST', '/users/register', {
    name: 'Ana', email: 'ANA@EXAMPLE.COM', password: 'StrongPass123!',
  })).status, 409);
  for (const body of [
    { name: '', email: 'invalid', password: 'short' },
    { name: 'Ana', email: 'new@example.com', password: 'é'.repeat(37) },
    { name: {}, email: [], password: {} },
  ]) {
    const result = await request('POST', '/users/register', body);
    assert.equal(result.status, 422);
    assert.ok(result.body.errors.every((error) => !Object.hasOwn(error, 'value')));
  }
});

test('autenticação verifica a senha com bcrypt e emite um JWT com validade', async () => {
  assert.equal((await request('POST', '/users/login', {
    email: 'ana@example.com', password: 'wrong-password',
  })).status, 401);
  const result = await request('POST', '/users/login', { email: 'ana@example.com', password: 'StrongPass123!' });
  assert.equal(result.status, 200);
  token = result.body.token;
  const payload = jwt.verify(token, secret);
  assert.equal(payload.sub, '1');
  assert.equal(payload.exp - payload.iat, 3600);
  await request('POST', '/users/register', { name: 'Bruno', email: 'bruno@example.com', password: 'StrongPass123!' });
  otherToken = (await request('POST', '/users/login', {
    email: 'bruno@example.com', password: 'StrongPass123!',
  })).body.token;
});

test('rotas de agendamentos rejeitam tokens ausentes, inválidos, expirados ou com assinatura incorreta', async () => {
  const claims = { sub: '1', iss: 'appointment-api', aud: 'appointment-client' };
  const expired = jwt.sign(claims, secret, { expiresIn: -1 });
  const forged = jwt.sign(claims, 'different-secret');
  const wrongAlgorithm = jwt.sign(claims, secret, { algorithm: 'HS384' });
  for (const bearer of [undefined, 'invalid', expired, forged, wrongAlgorithm]) {
    for (const [method, path] of [
      ['GET', '/appointments'], ['GET', '/appointments/1'], ['POST', '/appointments'],
      ['PATCH', '/appointments/1'], ['PATCH', '/appointments/1/reschedule'], ['PATCH', '/appointments/1/cancel'],
    ]) {
      assert.equal((await request(method, path, undefined, bearer)).status, 401);
    }
  }
});

test('criação sanitiza os campos e ignora proprietário e situação enviados pelo cliente', async () => {
  const result = await request('POST', '/appointments', {
    date: '2030-10-15', time: '09:30', responsible: '  Ana  ', description: '  Consulta  ',
    userId: 2, status: 'cancelled', id: 900,
  }, token);
  assert.equal(result.status, 201);
  const appointment = result.body.appointment;
  appointmentId = appointment.id;
  assert.equal(appointment.responsible, 'Ana');
  assert.equal(appointment.description, 'Consulta');
  assert.equal(appointment.userId, 1);
  assert.equal(appointment.status, 'scheduled');
  assert.notEqual(appointment.id, 900);
});

test('criação valida datas reais, horários, tipos e campos obrigatórios', async () => {
  const valid = { date: '2030-10-15', time: '09:30', responsible: 'Ana' };
  for (const patch of [
    { date: '2030-02-30' }, { date: '2030-02-29' }, { date: '2030-10-15T09:30:00Z' },
    { date: '0000-01-01' }, { time: '24:00' }, { time: '09:60' }, { time: '9:30' },
    { responsible: ' ' }, { responsible: null }, { description: 123 }, { date: ['2030-10-15'] },
  ]) {
    assert.equal((await request('POST', '/appointments', { ...valid, ...patch }, token)).status, 422);
  }
  assert.equal((await request('POST', '/appointments', {}, token)).status, 422);
  const result = await request('POST', '/appointments', { ...valid, date: '2032-02-29' }, token);
  assert.equal(result.status, 201);
  assert.equal(result.body.appointment.description, null);
});

test('outro usuário não pode consultar, editar, reagendar ou cancelar um agendamento', async () => {
  assert.equal((await request('GET', '/appointments', undefined, otherToken)).body.total, 0);
  for (const [method, suffix, body] of [
    ['GET', '', undefined], ['PATCH', '', { responsible: 'Bruno' }],
    ['PATCH', '/reschedule', { date: '2030-11-20', time: '14:00' }], ['PATCH', '/cancel', undefined],
  ]) {
    assert.equal((await request(method, `/appointments/${appointmentId}${suffix}`, body, otherToken)).status, 404);
  }
});

test('edição altera detalhes, permite remover a descrição e preserva a data, o horário e o proprietário', async () => {
  const result = await request('PATCH', `/appointments/${appointmentId}`, {
    responsible: '  Maria  ', description: null, userId: 2, date: '2040-01-01', id: 2,
  }, token);
  assert.equal(result.status, 200);
  assert.equal(result.body.appointment.id, appointmentId);
  assert.equal(result.body.appointment.responsible, 'Maria');
  assert.equal(result.body.appointment.description, null);
  assert.equal(result.body.appointment.date, '2030-10-15');
  assert.equal(result.body.appointment.userId, 1);
  for (const body of [{}, { date: '2040-01-01' }, { responsible: ' ' }]) {
    assert.equal((await request('PATCH', `/appointments/${appointmentId}`, body, token)).status, 422);
  }
});

test('reagendamento exige data e horário e preserva os detalhes', async () => {
  assert.equal((await request('PATCH', `/appointments/${appointmentId}/reschedule`, { time: '12:00' }, token)).status, 422);
  const result = await request('PATCH', `/appointments/${appointmentId}/reschedule`, {
    date: '2030-11-20', time: '14:00', responsible: 'Ignorado',
  }, token);
  assert.equal(result.status, 200);
  assert.equal(result.body.appointment.date, '2030-11-20');
  assert.equal(result.body.appointment.time, '14:00');
  assert.equal(result.body.appointment.responsible, 'Maria');
});

test('listagem filtra e pagina os agendamentos e valida os parâmetros', async () => {
  const result = await request('GET', '/appointments?date=2030-11-20&status=scheduled&limit=1&offset=0', undefined, token);
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.appointments[0].id, appointmentId);
  for (const path of ['/appointments?limit=101', '/appointments?offset=-1', '/appointments?status=invalid', '/appointments/nope']) {
    assert.equal((await request('GET', path, undefined, token)).status, 422);
  }
  assert.equal((await request('GET', '/appointments/9999', undefined, token)).status, 404);
});

test('cancelamento preserva o histórico e impede alterações posteriores', async () => {
  const result = await request('PATCH', `/appointments/${appointmentId}/cancel`, undefined, token);
  assert.equal(result.status, 200);
  assert.equal(result.body.appointment.status, 'cancelled');
  for (const [suffix, body] of [
    ['', { responsible: 'Ana' }], ['/reschedule', { date: '2030-12-01', time: '10:00' }], ['/cancel', undefined],
  ]) {
    assert.equal((await request('PATCH', `/appointments/${appointmentId}${suffix}`, body, token)).status, 409);
  }
  assert.equal((await request('GET', `/appointments/${appointmentId}`, undefined, token)).status, 200);
  assert.equal((await request('GET', '/appointments?status=cancelled', undefined, token)).body.total, 1);
});

test('JSON malformado e requisições muito grandes retornam erros controlados', async () => {
  const response = await fetch(`${baseUrl}/users/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'JSON inválido.' });
  assert.equal((await request('POST', '/users/login', { password: 'x'.repeat(17000) })).status, 413);
  assert.equal((await request('GET', '/missing')).status, 404);
});

test('falhas do banco chegam ao tratamento centralizado sem expor detalhes internos', async () => {
  const original = models.Appointment.findAndCountAll;
  models.Appointment.findAndCountAll = async () => { throw new Error('detalhes SQL sensíveis'); };
  try {
    const result = await request('GET', '/appointments', undefined, token);
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { message: 'Erro interno do servidor.' });
  } finally {
    models.Appointment.findAndCountAll = original;
  }
});
