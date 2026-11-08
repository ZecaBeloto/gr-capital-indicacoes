# Site de Indicação de Contatos — GR Capital

## Intenção e por quê

Helio (assessor GR Capital / BTG Pactual) envia periodicamente um relatório de
performance aos seus clientes via WhatsApp. Ele quer aproveitar esse contato
para pedir indicações de potenciais investidores. Hoje não existe um canal
estruturado para isso — a ideia é um link simples, enviado junto com o
relatório, que leva a um formulário de indicação. As indicações recebidas
precisam ficar organizadas num painel só do Helio, agrupadas por quem indicou
e por data, com controle de quem já foi contatado e exportação para `.xlsx`.

## Goals

- Capturar indicações (nome + telefone) de forma simples, sem fricção, pelo
  celular (o cliente abre o link no WhatsApp).
- Permitir indicar vários contatos de uma vez no mesmo envio.
- Painel privado (só Helio) listando as indicações agrupadas por quem indicou
  e por data de envio.
- Marcar cada contato indicado como **contatado / pendente**, direto no
  painel.
- Baixar todas as indicações (ou o que estiver na tela) como arquivo `.xlsx`.
- Visual consistente com a identidade GR Capital (navy `#06152C` + dourado
  `#C8A84B`, Poppins) — mesmo padrão já usado nos materiais de divulgação.

## Non-goals

- Login/autenticação do cliente que indica — ele só digita o próprio nome no
  formulário (confirmado com Helio: não haverá link único por cliente nesta
  fase).
- Acesso de outras pessoas da equipe GR ao painel — é uso individual do
  Helio.
- Validação robusta de telefone (DDD, formato internacional) — campo de
  texto livre é suficiente por agora.
- Notificação automática (e-mail/WhatsApp) a cada nova indicação — não foi
  pedido; pode ser um incremento futuro.
- CRM completo (histórico de interações, notas, funil) — o pedido é só
  lista + status contatado/pendente.

## Anti-goals

- Não expor os dados das indicações sem senha.
- Não prometer segurança de nível empresarial: a senha do painel é uma
  barreira de acesso simples (mesmo modelo do `pesquisa-planejamento-2027`),
  não autenticação de servidor real — GitHub Pages não tem backend próprio.
- Não misturar este projeto dentro do repositório da wiki (`C:\Memorias`) —
  é um projeto separado.

## Constraints

- Hospedagem: GitHub Pages (conta `ZecaBeloto`), seguindo exatamente o
  padrão já em produção em `pesquisa-planejamento-2027`.
- Sem servidor próprio → armazenamento e leitura via Google Apps Script
  (Web App) + Google Sheets, replicando a arquitetura do projeto de
  referência.
- Site e painel devem seguir a identidade visual GR Capital já documentada
  em `wiki/templates/brand.md` (navy + dourado, Poppins).
- Campos do formulário: nome de quem indica (texto livre) + lista repetível
  de indicados (nome + telefone cada), com botão para adicionar mais
  contatos.
- Painel: agrupado por indicador e por data; status contatado/pendente por
  contato indicado (editável e persistido na planilha); botão de exportar
  `.xlsx` gerado no navegador (sem precisar abrir a planilha manualmente).
- Projeto local em `C:\Users\DELL\Documents\gr-capital-indicacoes`, novo
  repositório Git, publicado depois no GitHub (`ZecaBeloto`) com GitHub
  Pages habilitado — só com autorização explícita do Helio no momento do
  push/publicação.

## Decisões já tomadas (como vai ser feito)

- **Conta Google:** planilha e Apps Script novos ficam na conta Google
  pessoal do Helio (confirmado com ele) — não reaproveitar a planilha do
  `pesquisa-planejamento-2027`. A criação do projeto em script.google.com
  e a implantação como Web App precisam ser feitas pelo próprio Helio
  (login OAuth não pode ser feito por mim); eu preparo os arquivos
  (`apps-script/*.gs`) e o passo a passo, seguindo o mesmo roteiro do
  "Instalar do zero" do projeto de referência.
- **Backend:** Google Apps Script Web App + Google Sheets dedicados a este
  projeto. O Web App recebe o POST do formulário e
  grava linhas na planilha; o painel lê de volta pelo mesmo Web App, que
  confere a senha (`PAINEL_SENHA` nas Propriedades do Script) antes de
  liberar os dados — mesmo padrão de bloqueio após tentativas erradas do
  projeto de referência.
- **Frontend:** HTML/CSS/JS estático, sem framework — mesmo approach do
  `pesquisa-planejamento-2027`.
- **Exportação .xlsx:** gerada no próprio navegador (biblioteca SheetJS),
  a partir dos dados já carregados no painel — sem depender do usuário
  abrir a planilha do Google manualmente.
- **Identificação de quem indica:** campo de texto livre no formulário
  (confirmado com Helio — sem link único por cliente nesta fase).
- **Repositório:** `gr-capital-indicacoes`, estrutura de pastas espelhando
  `pesquisa-planejamento-2027` (`web/`, `painel/`, `apps-script/`,
  `shared/`, `scripts/`, `test/`).

## O que fica a critério de quem for construir

- Nomes exatos das propriedades do Script, nomes de abas da planilha,
  estrutura de colunas.
- Micro-copy do formulário e do painel (textos de botões, mensagens de
  confirmação de envio, mensagens de erro).
- Layout exato dentro do padrão de marca (grid, espaçamento, tipografia
  responsiva).
- Tela de confirmação após o envio do formulário (ex: "Indicação enviada
  com sucesso").
- Lógica de agrupamento visual no painel (por data decrescente, por
  indicador em ordem alfabética, etc.).
- Limite de tentativas de senha erradas antes do bloqueio temporário
  (seguir o mesmo valor do projeto de referência, 20, salvo razão em
  contrário).

## Observação de compliance

Como o formulário coleta dados pessoais de terceiros (nome e telefone de
pessoas indicadas, que não são clientes da GR Capital), vale incluir uma
linha curta no formulário avisando a finalidade do uso desses dados, e
tratar esses dados com a mesma confidencialidade de dados de cliente
(Seção H do `CLAUDE.md` do projeto da wiki). Como o link é enviado a
clientes junto com o relatório de performance, ainda que seja uma
ferramenta operacional (não um material promocional com números/retorno),
recomenda-se uma revisão rápida do Helio antes do primeiro envio em massa.
