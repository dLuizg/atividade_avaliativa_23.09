const jwt = require('jsonwebtoken');

module.exports = function tokenMiddleware(secret) {
  return function verifyToken(req, res, next) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({ mensagem: 'Informe um token de autenticação do tipo Bearer.' });
    try {
      const payload = jwt.verify(match[1], secret, {
        algorithms: ['HS256'], issuer: 'appointment-api', audience: 'appointment-client',
      });
      if (!/^[1-9]\d*$/.test(payload.sub) || !Number.isSafeInteger(Number(payload.sub))) {
        throw new Error('Identificador de usuário inválido');
      }
      req.userId = Number(payload.sub);
    } catch {
      return res.status(401).json({ mensagem: 'Token inválido ou expirado.' });
    }
    return next();
  };
};
