const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');
const appointmentRoutes = require('./routes/appointments');
const { prepararEntrada } = require('./helpers/apiMapper');

module.exports = function createApp({ models, jwtSecret, corsOrigin = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '16kb' }));
  app.use(prepararEntrada);
  app.use('/usuarios', userRoutes(models.User, jwtSecret));
  app.use('/agendamentos', appointmentRoutes(models.Appointment, jwtSecret));
  app.use((req, res) => res.status(404).json({ mensagem: 'Rota não encontrada.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ mensagem: 'JSON inválido.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ mensagem: 'O corpo da requisição excede o tamanho permitido.' });
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ mensagem: 'Registro já existente.' });
    }
    // Nunca expor consultas SQL, credenciais, senhas ou detalhes internos dos erros.
    console.error('Falha na requisição:', error.name);
    return res.status(500).json({ mensagem: 'Erro interno do servidor.' });
  });
  return app;
};
