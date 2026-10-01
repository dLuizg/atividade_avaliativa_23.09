const camposEntrada = {
  nome: 'name', senha: 'password', data: 'date', horario: 'time',
  responsavel: 'responsible', descricao: 'description', situacao: 'status',
  limite: 'limit', deslocamento: 'offset', identificador: 'id',
};

const camposSaida = {
  id: 'identificador', name: 'nome', passwordHash: 'senhaHash', date: 'data',
  time: 'horario', responsible: 'responsavel', description: 'descricao',
  status: 'situacao', userId: 'usuarioId', tokenType: 'tipoToken',
  expiresIn: 'expiraEm', appointments: 'agendamentos', appointment: 'agendamento',
  user: 'usuario', limit: 'limite', offset: 'deslocamento', errors: 'erros',
  field: 'campo', message: 'mensagem', createdAt: 'criadoEm', updatedAt: 'atualizadoEm',
};

function traduzirEntrada(dados = {}) {
  return Object.fromEntries(Object.entries(dados).map(([chave, valor]) => [camposEntrada[chave] || chave, valor]));
}

function traduzirSaida(valor) {
  if (Array.isArray(valor)) return valor.map(traduzirSaida);
  if (!valor || typeof valor !== 'object') return valor === 'scheduled' ? 'agendado' : valor === 'cancelled' ? 'cancelado' : valor;
  if (valor instanceof Date) return valor.toISOString();
  const dados = typeof valor.toJSON === 'function' ? valor.toJSON() : valor;
  return Object.fromEntries(Object.entries(dados).map(([chave, item]) => [camposSaida[chave] || chave, traduzirSaida(item)]));
}

function prepararEntrada(req, res, next) {
  req.body = traduzirEntrada(req.body);
  const [caminho, consulta] = req.url.split('?', 2);
  if (consulta) {
    const parametros = new URLSearchParams(consulta);
    for (const [chave, valor] of [...parametros]) {
      const chaveInterna = camposEntrada[chave];
      if (chaveInterna) {
        parametros.delete(chave);
        parametros.append(chaveInterna, valor);
      }
    }
    req.url = `${caminho}?${parametros.toString()}`;
  }
  next();
}

module.exports = { prepararEntrada, traduzirSaida, camposSaida };
