const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const appointmentRoutes = require('./routes/appointments');

module.exports = function createApp({ models, jwtSecret, corsOrigin = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/users', userRoutes(models.User, jwtSecret));
  app.use('/appointments', appointmentRoutes(models.Appointment, jwtSecret));
  app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'JSON inválido.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ message: 'O corpo da requisição excede o tamanho permitido.' });
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Registro já existente.' });
    }
    // Nunca expor consultas SQL, credenciais, senhas ou detalhes internos dos erros.
    console.error('Falha na requisição:', error.name);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  });
  return app;
};
