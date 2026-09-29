const { validationResult, matchedData } = require('express-validator');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Requisição inválida.',
      errors: errors.array({ onlyFirstError: true }).map((error) => ({
        field: error.path, message: error.msg,
      })),
    });
  }
  req.input = matchedData(req, { locations: ['body', 'params', 'query'] });
  return next();
};
