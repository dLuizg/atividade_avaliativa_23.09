const { validationResult, matchedData } = require('express-validator');
const { camposSaida } = require('../helpers/apiMapper');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      mensagem: 'Requisição inválida.',
      erros: errors.array({ onlyFirstError: true }).map((error) => ({
        campo: camposSaida[error.path] || error.path, mensagem: error.msg,
      })),
    });
  }
  req.input = matchedData(req, { locations: ['body', 'params', 'query'] });
  return next();
};
