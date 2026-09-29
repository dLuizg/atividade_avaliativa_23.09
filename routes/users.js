const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rules = require('../helpers/validators');
const validate = require('../middleware/validate');

module.exports = function userRoutes(User, secret) {
  const router = Router();
  router.post('/register', rules.register(), validate, async (req, res) => {
    const { name, email, password } = req.input;
    if (await User.findOne({ where: { email } })) {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  });

  router.post('/login', rules.login(), validate, async (req, res) => {
    const { email, password } = req.input;
    const user = await User.scope('withPassword').findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }
    const token = jwt.sign({}, secret, {
      subject: String(user.id), expiresIn: '1h', algorithm: 'HS256',
      issuer: 'appointment-api', audience: 'appointment-client',
    });
    return res.json({ token, tokenType: 'Bearer', expiresIn: 3600 });
  });
  return router;
};
