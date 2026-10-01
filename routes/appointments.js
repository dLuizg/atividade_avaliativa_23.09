const { Router } = require('express');
const rules = require('../helpers/validators');
const validate = require('../middleware/validate');
const verifyToken = require('../middleware/verifyToken');
const { traduzirSaida } = require('../helpers/apiMapper');

module.exports = function appointmentRoutes(Appointment, secret) {
  const router = Router();
  router.use(verifyToken(secret));

  router.post('/', rules.create(), validate, async (req, res) => {
    const { date, time, responsible, description } = req.input;
    const appointment = await Appointment.create({
      date, time, responsible, description: description || null, userId: req.userId,
    });
    res.status(201).json(traduzirSaida({ appointment }));
  });

  router.get('/', rules.list(), validate, async (req, res) => {
    const { date, status, limit = 50, offset = 0 } = req.input;
    const where = { userId: req.userId };
    if (date) where.date = date;
    if (status) where.status = status;
    const result = await Appointment.findAndCountAll({
      where, limit, offset, order: [['date', 'ASC'], ['time', 'ASC'], ['id', 'ASC']],
    });
    res.json(traduzirSaida({ appointments: result.rows, total: result.count, limit, offset }));
  });

  router.get('/:id', rules.id(), validate, async (req, res) => {
    const appointment = await Appointment.findOne({ where: { id: req.input.id, userId: req.userId } });
    if (!appointment) return res.status(404).json({ mensagem: 'Agendamento não encontrado.' });
    return res.json(traduzirSaida({ appointment }));
  });

  function update(values) {
    return async (req, res) => {
      const where = { id: req.input.id, userId: req.userId };
      // A condição de situação também protege contra cancelamentos simultâneos.
      const [affected] = await Appointment.update(values(req.input), {
        where: { ...where, status: 'scheduled' },
      });
      const appointment = await Appointment.findOne({ where });
      if (!appointment) return res.status(404).json({ mensagem: 'Agendamento não encontrado.' });
      if (!affected && appointment.status === 'cancelled') {
        return res.status(409).json({ mensagem: 'Agendamentos cancelados não podem ser alterados.' });
      }
      return res.json(traduzirSaida({ appointment }));
    };
  }

  router.patch('/:id', rules.id(), rules.edit(), validate, (req, res, next) => {
    if (req.input.responsible === undefined && req.input.description === undefined) {
      return res.status(422).json({ mensagem: 'Informe o responsável ou a descrição.' });
    }
    return next();
  }, update((input) => {
    const values = {};
    if (input.responsible !== undefined) values.responsible = input.responsible;
    if (input.description !== undefined) values.description = input.description || null;
    return values;
  }));
  router.patch('/:id/reagendar', rules.id(), rules.reschedule(), validate,
    update(({ date, time }) => ({ date, time })));
  router.patch('/:id/cancelar', rules.id(), validate, update(() => ({ status: 'cancelled' })));
  return router;
};
