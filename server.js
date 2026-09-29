const readConfig = require('./config');
const connectDatabase = require('./db/conn');
const defineModels = require('./models');
const createApp = require('./app');

async function start() {
  const config = readConfig();
  const sequelize = connectDatabase(config.database);
  try {
    const models = defineModels(sequelize);
    await sequelize.authenticate();
    // Interromper a inicialização se faltarem tabelas ou se a estrutura for incompatível.
    await Promise.all(Object.values(models).map((model) => model.findOne()));
    const app = createApp({ models, jwtSecret: config.jwtSecret, corsOrigin: config.corsOrigin });
    const server = app.listen(config.port);
    server.once('listening', () => console.log(`API em execução na porta ${config.port}`));
    server.on('error', async (error) => {
      console.error(error.code === 'EADDRINUSE'
        ? `A porta ${config.port} já está em uso. Encerre a API em execução ou altere PORT no arquivo .env.`
        : `Falha no servidor HTTP: ${error.code}`);
      await sequelize.close();
      process.exitCode = 1;
    });
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        server.close(async () => { await sequelize.close(); });
      });
    }
  } catch (error) {
    await sequelize.close();
    throw error;
  }
}

start().catch((error) => {
  console.error('Falha na inicialização:', error.message);
  process.exitCode = 1;
});
