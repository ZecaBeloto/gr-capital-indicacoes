# GR Capital — Site de Indicação de Contatos

Formulário enviado aos clientes junto com o relatório de performance, para indicarem
contatos de potenciais investidores. A página fica no GitHub Pages e grava as
indicações em uma planilha do Google, por meio de um Web App do Apps Script.
Nenhuma indicação fica neste repositório.

## Instalar do zero

1. Acesse [script.google.com](https://script.google.com) com sua conta Google pessoal
   e crie um novo projeto.
2. Cole o conteúdo de `apps-script/Code.gs` no editor do projeto.
3. Execute a função `setup()` uma vez e autorize o acesso pedido. O log (Ver > Registros)
   mostra o link da planilha criada — guarde esse link.
4. Em **Implantar > Nova implantação**, escolha tipo "App da Web", execute como você,
   acesso "Qualquer pessoa", e implante. Copie a URL gerada.
5. Cole essa URL em `WEB_APP_URL` nos dois arquivos `web/config.js` e `painel/config.js`.
6. Em **Configurações do projeto > Propriedades do script**, crie a propriedade
   `PAINEL_SENHA` com uma senha aleatória (mínimo 12 caracteres, de preferência gerada
   por um gerenciador de senhas — evite palavras óbvias).
7. Publique a página (`git push` depois de habilitar o GitHub Pages no repositório).

## Trocar a senha do painel

No Apps Script, abra **Configurações do projeto > Propriedades do script** e edite
`PAINEL_SENHA`. Não precisa reimplantar.

## Notificação por e-mail

Toda nova indicação envia um e-mail automático para a conta Google que fez o deploy
do Apps Script (`Session.getActiveUser().getEmail()`), com o nome de quem indicou e
a lista de contatos enviados. Não precisa configurar nada além do deploy inicial —
se o envio falhar por qualquer motivo, a indicação é salva normalmente na planilha
mesmo assim.

## Bloqueio por tentativas erradas

Depois de 20 tentativas de senha incorreta, a leitura e a atualização de status ficam
bloqueadas por 10 minutos para qualquer pessoa, inclusive com a senha certa.

## Baixar como Excel

O painel tem um botão "Baixar .xlsx" que gera o arquivo direto no navegador, com os
dados que estiverem carregados na tela. Não é necessário abrir a planilha do Google
manualmente.

## Rodar os testes

```bash
node --test test/logic.test.js
```

## Estrutura

```
web/        formulário público de indicação
painel/     painel administrativo (protegido por senha)
shared/     lógica e estilos compartilhados entre web/ e painel/
apps-script/ backend (Google Apps Script)
test/       testes de shared/logic.js
```
