# API de Agendamentos

Projeto simples em Node.js e Express para criar, consultar, editar, reagendar e cancelar
agendamentos. Utiliza Sequelize com MySQL, autenticação JWT, validação com express-validator
e proteção de senhas com bcrypt.

Cada agendamento possui identificador, data, horário, responsável e descrição opcional.
Cada usuário acessa somente os próprios agendamentos.

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
| POST | `/users/register` | Cadastrar usuário com `name`, `email` e `password` |
| POST | `/users/login` | Autenticar com `email` e `password` e receber o token |
| POST | `/appointments` | Criar agendamento |
| GET | `/appointments` | Consultar os próprios agendamentos |
| GET | `/appointments/:id` | Consultar um agendamento pelo identificador |
| PATCH | `/appointments/:id` | Editar `responsible` e/ou `description` |
| PATCH | `/appointments/:id/reschedule` | Alterar `date` e `time` juntos |
| PATCH | `/appointments/:id/cancel` | Cancelar sem excluir o registro |

As mensagens e a documentação estão em português. Os identificadores técnicos de rotas,
campos JSON, variáveis de ambiente e banco foram mantidos para preservar a compatibilidade.

## Exemplo de uso

Com a API em execução, abra outro terminal PowerShell na pasta do projeto:

```powershell
$api = 'http://localhost:3030'
$email = "teste-$([guid]::NewGuid().ToString('N'))@example.com"
$cadastro = @{ name = 'Ana Silva'; email = $email; password = 'SenhaDeTeste123!' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$api/users/register" -ContentType 'application/json' -Body $cadastro

$credenciais = @{ email = $email; password = 'SenhaDeTeste123!' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$api/users/login" -ContentType 'application/json' -Body $credenciais
$cabecalhos = @{ Authorization = "Bearer $($login.token)" }

$dados = @{ date = '2030-10-15'; time = '09:30'; responsible = 'Ana Silva'; description = 'Consulta inicial' } | ConvertTo-Json
$criado = Invoke-RestMethod -Method Post -Uri "$api/appointments" -Headers $cabecalhos -ContentType 'application/json' -Body $dados
$id = $criado.appointment.id

# Consultar os agendamentos.
Invoke-RestMethod -Uri "$api/appointments" -Headers $cabecalhos | ConvertTo-Json -Depth 5

# Editar o responsável e a descrição.
$edicao = @{ responsible = 'Maria Silva'; description = 'Consulta atualizada' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$api/appointments/$id" -Headers $cabecalhos -ContentType 'application/json' -Body $edicao

# Reagendar informando data e horário.
$novaData = @{ date = '2030-10-16'; time = '14:00' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$api/appointments/$id/reschedule" -Headers $cabecalhos -ContentType 'application/json' -Body $novaData

# Cancelar e consultar o registro preservado.
Invoke-RestMethod -Method Patch -Uri "$api/appointments/$id/cancel" -Headers $cabecalhos
Invoke-RestMethod -Uri "$api/appointments/$id" -Headers $cabecalhos | ConvertTo-Json -Depth 5
```

## Regras principais

- Data no formato `AAAA-MM-DD` e horário no formato `HH:mm`, usando 24 horas.
- Responsável com 1 a 120 caracteres; descrição opcional com até 1.000 caracteres.
- A edição aceita `description: null` ou uma descrição vazia para removê-la.
- A situação `scheduled` significa agendado; `cancelled` significa cancelado.
- O cancelamento preserva o histórico e impede edições ou reagendamentos posteriores.
- O token expira em uma hora; faça a autenticação novamente para obter outro.
- A senha exige pelo menos oito caracteres e não pode ultrapassar 72 bytes em UTF-8.
- Datas passadas e horários sobrepostos são permitidos neste escopo.

A listagem aceita os filtros `date` e `status` e a paginação `limit` e `offset`.
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
