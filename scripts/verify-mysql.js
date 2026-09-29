const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const bcrypt = require('bcrypt');
const readConfig = require('../config');
const connectDatabase = require('../db/conn');
const defineModels = require('../models');
const createApp = require('../app');

// Usar o MySQL configurado, sem sincronizar ou excluir tabelas. Remover somente
// as contas e os agendamentos temporários criados nesta execução.
async function verify() {
  const config = readConfig();
  let db;
  let server;
  let models;
  let baseUrl;
  const emails = [];
  async function connect() {
    db = connectDatabase(config.database);
    models = defineModels(db);
    await db.authenticate();
    server = createApp({ models, jwtSecret: config.jwtSecret }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  async function disconnect() {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      server = null;
    }
    if (db) {
      await db.close();
      db = null;
    }
  }
  async function request(method, path, body, token, expected = 200) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    await connect();
    const tokens = [];
    const password = randomUUID();
    for (const name of ['Titular do teste MySQL', 'Outro usuário do teste MySQL']) {
      const email = `mysql-check-${randomUUID()}@example.com`;
      emails.push(email);
      const registration = await request('POST', '/users/register', { name, email, password }, null, 201);
      assert.equal(registration.user.passwordHash, undefined);
      const user = await models.User.scope('withPassword').findOne({ where: { email } });
      assert.equal(await bcrypt.compare(password, user.passwordHash), true);
      tokens.push((await request('POST', '/users/login', { email, password })).token);
    }
    const [ownerToken, otherToken] = tokens;
    await request('POST', '/users/register', { name: 'Duplicado', email: emails[0], password }, null, 409);
    const owner = await models.User.findOne({ where: { email: emails[0] } });
    await assert.rejects(models.User.create({ name: 'Duplicado', email: emails[0], passwordHash: 'x' }),
      { name: 'SequelizeUniqueConstraintError' });
    await assert.rejects(models.Appointment.create({
      date: '2030-10-15', time: '09:30', responsible: 'Teste de integridade', userId: 0,
    }), (error) => ['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'].includes(error.parent?.code));

    const created = await request('POST', '/appointments', {
      date: '2030-10-15', time: '09:30', responsible: '  Ana Silva  ', description: '  Teste MySQL  ', userId: 0,
    }, ownerToken, 201);
    const id = created.appointment.id;
    assert.equal(created.appointment.userId, owner.id);
    assert.equal(created.appointment.responsible, 'Ana Silva');
    await request('GET', `/appointments/${id}`, undefined, undefined, 401);
    await request('GET', `/appointments/${id}`, undefined, otherToken, 404);
    assert.equal((await request('GET', '/appointments', undefined, otherToken)).total, 0);
    for (const [suffix, body] of [
      ['', { responsible: 'Outro usuário' }],
      ['/reschedule', { date: '2030-10-16', time: '14:00' }],
      ['/cancel', undefined],
    ]) {
      await request('PATCH', `/appointments/${id}${suffix}`, body, otherToken, 404);
    }
    await request('POST', '/appointments', { date: '2030-02-30', time: '24:00', responsible: 'Ana' }, ownerToken, 422);
    await request('PATCH', `/appointments/${id}`, { responsible: 'Maria Silva', description: null }, ownerToken);
    await request('PATCH', `/appointments/${id}/reschedule`, { date: '2030-10-16', time: '14:00' }, ownerToken);
    let appointment = (await request('GET', `/appointments/${id}`, undefined, ownerToken)).appointment;
    assert.equal(appointment.description, null);
    assert.equal(appointment.date, '2030-10-16');
    assert.equal(appointment.time, '14:00:00');
    assert.equal((await request('GET', '/appointments?date=2030-10-16&status=scheduled', undefined, ownerToken)).total, 1);
    await request('PATCH', `/appointments/${id}/cancel`, undefined, ownerToken);
    await request('PATCH', `/appointments/${id}`, { responsible: 'Ana' }, ownerToken, 409);
    await request('PATCH', `/appointments/${id}/reschedule`, { date: '2030-10-17', time: '10:00' }, ownerToken, 409);
    await request('PATCH', `/appointments/${id}/cancel`, undefined, ownerToken, 409);

    // Reiniciar a aplicação HTTP e descartar todas as conexões com o banco.
    await disconnect();
    await connect();
    appointment = (await request('GET', `/appointments/${id}`, undefined, ownerToken)).appointment;
    assert.equal(appointment.status, 'cancelled');
    assert.equal(appointment.responsible, 'Maria Silva');
    assert.equal(appointment.date, '2030-10-16');
    assert.equal(appointment.time, '14:00:00');
    console.log('Verificação com MySQL aprovada: autenticação, ciclo completo de agendamentos, acesso por usuário,');
    console.log('validação, unicidade, chave estrangeira e persistência após reiniciar a aplicação e suas conexões.');
  } finally {
    // Limitar a limpeza aos e-mails aleatórios registrados nesta execução.
    try {
      if (!db && emails.length) {
        db = connectDatabase(config.database);
        models = defineModels(db);
      }
      if (db) {
        for (const email of emails) {
          const user = await models.User.findOne({ where: { email } });
          if (user) {
            await models.Appointment.destroy({ where: { userId: user.id } });
            await models.User.destroy({ where: { id: user.id } });
          }
        }
      }
    } finally {
      await disconnect();
    }
  }
}

verify().catch((error) => {
  console.error('Falha na verificação com MySQL:', error.message);
  process.exitCode = 1;
});
