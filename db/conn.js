const { Sequelize } = require('sequelize');

module.exports = function connectDatabase(config) {
  return new Sequelize(config.name, config.user, config.password, {
    host: config.host,
    port: config.port,
    dialect: 'mysql',
    logging: false,
    define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  });
};
