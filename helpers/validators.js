const { body, param, query } = require('express-validator');

const text = (field, max) => body(field, `Informe um texto entre 1 e ${max} caracteres.`)
  .isString().bail().trim().isLength({ min: 1, max });
const email = () => body('email', 'Informe um e-mail válido com até 254 caracteres.').isString().bail().trim().isEmail().bail()
  .isLength({ max: 254 }).toLowerCase();
const password = (min) => body('password', `Informe uma senha com pelo menos ${min} caractere(s).`).isString().bail()
  .isLength({ min }).bail().custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
  .withMessage('A senha não pode exceder 72 bytes em UTF-8.');
const date = (chain) => chain.isString().withMessage('Informe a data como texto.').bail().trim()
  .matches(/^[1-9]\d{3}-\d{2}-\d{2}$/).withMessage('Informe a data no formato AAAA-MM-DD.').bail()
  .isISO8601({ strict: true }).withMessage('Informe uma data válida.');
const time = () => body('time', 'Informe um horário válido no formato HH:mm, entre 00:00 e 23:59.')
  .isString().bail().trim().matches(/^([01]\d|2[0-3]):[0-5]\d$/);
const description = () => body('description', 'A descrição deve ser um texto de até 1.000 caracteres.').optional({ values: 'null' })
  .isString().bail().trim().isLength({ max: 1000 });

module.exports = {
  register: () => [text('name', 120), email(), password(8)],
  login: () => [email(), password(1)],
  id: () => param('id', 'Informe um identificador inteiro entre 1 e 4294967295.').isInt({ min: 1, max: 4294967295 }).toInt(),
  create: () => [date(body('date')), time(), text('responsible', 120), description()],
  edit: () => [
    text('responsible', 120).optional(),
    // O valor null remove a descrição.
    body('description', 'A descrição deve ser um texto de até 1.000 caracteres ou null.').optional().custom((value) => value === null || typeof value === 'string')
      .bail().customSanitizer((value) => typeof value === 'string' ? value.trim() : value)
      .custom((value) => value === null || value.length <= 1000),
  ],
  reschedule: () => [date(body('date')), time()],
  list: () => [
    date(query('date').optional()),
    query('status', 'A situação deve ser agendado ou cancelado.').optional().customSanitizer((value) => ({ agendado: 'scheduled', cancelado: 'cancelled' }[value] || value)).isIn(['scheduled', 'cancelled']),
    query('limit', 'O limite deve ser um número inteiro entre 1 e 100.').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset', 'O deslocamento deve ser um número inteiro entre 0 e 2147483647.').optional().isInt({ min: 0, max: 2147483647 }).toInt(),
  ],
};
