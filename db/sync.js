const readConfig = require('../config');
const connectDatabase = require('./conn');
const defineModels = require('../models');

async function sync() {
  const sequelize = connectDatabase(readConfig().database);
  try {
    defineModels(sequelize);
    await sequelize.authenticate();
    // Criar tabelas e índices ausentes, sem excluir tabelas nem usar force ou alter.
    await sequelize.sync();
    console.log('As tabelas do banco de dados estão prontas.');
  } finally {
    await sequelize.close();
  }
}

sync().catch((error) => {
  console.error('Falha na configuração do banco de dados:', error.message);
  process.exitCode = 1;
});
