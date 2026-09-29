require('dotenv').config({ quiet: true });

function readConfig() {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET']) {
    if (!process.env[key]) throw new Error(`Variável de ambiente não informada: ${key}`);
  }
  if (Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    throw new Error('JWT_SECRET deve conter pelo menos 32 bytes.');
  }
  function port(key, fallback) {
    const value = Number(process.env[key] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`${key} deve ser um número inteiro entre 1 e 65535.`);
    }
    return value;
  }
  return {
    port: port('PORT', 3030),
    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: process.env.CORS_ORIGIN || false,
    database: {
      host: process.env.DB_HOST,
      port: port('DB_PORT', 3306),
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
  };
}

module.exports = readConfig;
