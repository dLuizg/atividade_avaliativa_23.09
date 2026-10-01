# API de Agendamentos

Projeto simples em Node.js e Express para criar, consultar, editar, reagendar e cancelar
agendamentos. Utiliza Sequelize com MySQL, autenticação JWT, validação com express-validator
e proteção de senhas com bcrypt.

Cada agendamento possui identificador, data, horário, responsável e descrição opcional.
Cada usuário acessa somente os próprios agendamentos.

Atividade realizada por:

- Eduardo Baldo - 25001247
- Luiz Gustavo Paliares Diniz - 25001239
- Matteo Enrico Ferri Bonvento - 25000081

## Como executar neste computador

O banco local e o arquivo `.env` já estão configurados. Na pasta do projeto, execute:

```powershell
npm run db:start
npm start
```

A API estará disponível em `http://localhost:3030`. Mantenha esse terminal aberto.
Este projeto é uma API: não há uma interface visual ao abrir o endereço no navegador.
Utilize PowerShell, Postman ou outro cliente HTTP para enviar as requisições.

Para encerrar, pressione `Ctrl+C` no terminal da API e execute `npm run db:stop`.
Após reiniciar o Windows, execute novamente os comandos de inicialização.

Se aparecer `EADDRINUSE`, a porta 3030 já está ocupada. Encerre a instância anterior
da API antes de executar `npm start` novamente ou altere `PORT` no arquivo `.env`.

## Configuração em outro computador

É necessário ter Node.js 22 ou superior e MySQL 8. Instale as dependências com `npm ci`,
configure `.env` a partir de `.env.example`, crie o banco e execute `npm run db:sync`.
O procedimento completo está em [SETUP.md](SETUP.md).

Os comandos `db:start` e `db:stop` controlam a instância previamente configurada neste Windows;
eles não instalam nem configuram o MySQL automaticamente em outro computador.

## Comandos disponíveis

| Comando | Função |
| --- | --- |
| `npm ci` | Instalar as versões de dependências registradas no projeto |
| `npm run db:start` | Iniciar o MySQL local em `127.0.0.1:3307` |
| `npm run db:stop` | Encerrar o MySQL local |
| `npm run db:sync` | Criar tabelas e índices ausentes |
| `npm start` | Iniciar a API |
| `npm run dev` | Iniciar a API com reinicialização ao modificar arquivos |
| `npm test` | Executar os 13 testes HTTP com persistência simulada |
| `npm run test:mysql` | Testar o fluxo completo com o banco real |
| `npm audit` | Consultar vulnerabilidades conhecidas nas dependências |

## Rotas

Envie os dados como JSON, com `Content-Type: application/json`.
Todas as rotas de agendamentos exigem `Authorization: Bearer SEU_TOKEN`.

| Método | Rota | Finalidade |
| --- | --- | --- |
| POST | `/usuarios/cadastro` | Cadastrar usuário com `nome`, `email` e `senha` |
| POST | `/usuarios/entrar` | Autenticar com `email` e `senha` e receber o token |
| POST | `/agendamentos` | Criar agendamento |
| GET | `/agendamentos` | Consultar os próprios agendamentos |
| GET | `/agendamentos/:identificador` | Consultar um agendamento pelo identificador |
| PATCH | `/agendamentos/:identificador` | Editar `responsavel` e/ou `descricao` |
| PATCH | `/agendamentos/:identificador/reagendar` | Alterar `data` e `horario` juntos |
| PATCH | `/agendamentos/:identificador/cancelar` | Cancelar sem excluir o registro |

As rotas, parâmetros, campos JSON, valores de situação e mensagens da API estão em português.
Os nomes técnicos internos do banco permanecem inalterados.

## Exemplo de uso

Com a API em execução, abra outro terminal PowerShell na pasta do projeto:

```powershell
$api = 'http://localhost:3030'
$email = "teste-$([guid]::NewGuid().ToString('N'))@example.com"
$cadastro = @{ nome = 'Ana Silva'; email = $email; senha = 'SenhaDeTeste123!' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$api/usuarios/cadastro" -ContentType 'application/json' -Body $cadastro

$credenciais = @{ email = $email; senha = 'SenhaDeTeste123!' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$api/usuarios/entrar" -ContentType 'application/json' -Body $credenciais
$cabecalhos = @{ Authorization = "Bearer $($login.token)" }

$dados = @{ data = '2030-10-15'; horario = '09:30'; responsavel = 'Ana Silva'; descricao = 'Consulta inicial' } | ConvertTo-Json
$criado = Invoke-RestMethod -Method Post -Uri "$api/agendamentos" -Headers $cabecalhos -ContentType 'application/json' -Body $dados
$id = $criado.agendamento.identificador

# Consultar os agendamentos.
Invoke-RestMethod -Uri "$api/agendamentos" -Headers $cabecalhos | ConvertTo-Json -Depth 5

# Editar o responsável e a descrição.
$edicao = @{ responsavel = 'Maria Silva'; descricao = 'Consulta atualizada' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$api/agendamentos/$id" -Headers $cabecalhos -ContentType 'application/json' -Body $edicao

# Reagendar informando data e horário.
$novaData = @{ data = '2030-10-16'; horario = '14:00' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$api/agendamentos/$id/reagendar" -Headers $cabecalhos -ContentType 'application/json' -Body $novaData

# Cancelar e consultar o registro preservado.
Invoke-RestMethod -Method Patch -Uri "$api/agendamentos/$id/cancelar" -Headers $cabecalhos
Invoke-RestMethod -Uri "$api/agendamentos/$id" -Headers $cabecalhos | ConvertTo-Json -Depth 5
```

## Regras principais

- Data no formato `AAAA-MM-DD` e horário no formato `HH:mm`, usando 24 horas.
- Responsável com 1 a 120 caracteres; descrição opcional com até 1.000 caracteres.
- A edição aceita `descricao: null` ou uma descrição vazia para removê-la.
- A situação aceita `agendado` ou `cancelado`.
- O cancelamento preserva o histórico e impede edições ou reagendamentos posteriores.
- O token expira em uma hora; faça a autenticação novamente para obter outro.
- A senha exige pelo menos oito caracteres e não pode ultrapassar 72 bytes em UTF-8.
- Datas passadas e horários sobrepostos são permitidos neste escopo.

A listagem aceita os filtros `data` e `situacao` e a paginação `limite` e `deslocamento`.
Por padrão, retorna até 50 registros; o limite máximo por consulta é 100.

## Testes e documentação

```powershell
npm test
npm run test:mysql
```

O primeiro comando não precisa de MySQL. O segundo exige o banco configurado e verifica
as operações, as restrições de integridade e a persistência após reiniciar a aplicação e
suas conexões. Ele remove somente os registros temporários criados pelo próprio teste.

- [repo.md](repo.md): detalhes técnicos, requisitos atendidos e estrutura do projeto.
- [SETUP.md](SETUP.md): configuração do banco, operação local e próximas etapas opcionais.
