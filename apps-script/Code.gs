// GR Capital — Site de Indicação — backend Apps Script
// Planilha "Respostas", colunas: Id | Timestamp | Indicador | ContatoNome | ContatoTelefone | Status

var SHEET_NAME = 'Respostas';
var STATUS_PENDENTE = 'pendente';
var STATUS_CONTATADO = 'contatado';
var MAX_ATTEMPTS = 20;
var LOCK_MINUTES = 10;
var MAX_CONTATOS = 20;
var MAX_FIELD_LEN = 200;

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  var ss;

  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('Respostas | Indicações GR Capital');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  return ss;
}

function formatColumnsAsText_(sheet) {
  // Força colunas A:F como texto simples, para que Sheets nunca converta
  // telefones em número/data nem interprete valores começados com "=" como
  // fórmula (entrada vinda de um formulário público).
  sheet.getRange('A:F').setNumberFormat('@');
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    formatColumnsAsText_(sheet);
  }
  return sheet;
}

function setup() {
  var sheet = getSheet_();
  formatColumnsAsText_(sheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Id', 'Timestamp', 'Indicador', 'ContatoNome', 'ContatoTelefone', 'Status']);
  }
  Logger.log('Planilha pronta: ' + getSpreadsheet_().getUrl());
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkSenha_(senha) {
  var props = PropertiesService.getScriptProperties();
  var painelSenha = props.getProperty('PAINEL_SENHA');

  if (!painelSenha) {
    return { ok: false, error: 'Painel não configurado. Defina PAINEL_SENHA nas Propriedades do script.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var lockedUntil = props.getProperty('LOCKED_UNTIL');
    var now = new Date();

    if (lockedUntil && new Date(lockedUntil) > now) {
      return { ok: false, error: 'Bloqueado, tente novamente mais tarde.', lockedUntil: lockedUntil };
    }

    if (typeof senha !== 'string' || senha !== painelSenha) {
      var attempts = parseInt(props.getProperty('FAILED_ATTEMPTS') || '0', 10) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        var until = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
        props.setProperty('LOCKED_UNTIL', until.toISOString());
        props.setProperty('FAILED_ATTEMPTS', '0');
        return { ok: false, error: 'Bloqueado, tente novamente mais tarde.', lockedUntil: until.toISOString() };
      }
      props.setProperty('FAILED_ATTEMPTS', String(attempts));
      return { ok: false, error: 'Senha incorreta.' };
    }

    props.setProperty('FAILED_ATTEMPTS', '0');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function listRows_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    rows.push({
      id: r[0],
      timestamp: r[1],
      indicador: r[2],
      contatoNome: r[3],
      contatoTelefone: r[4],
      status: r[5],
    });
  }
  return rows;
}

function escapeForSheet_(value) {
  // Previne CSV/fórmula injection: um valor começando com = + - @ é
  // avaliado pelo Sheets como fórmula mesmo com a coluna formatada como
  // texto. Prefixar com aspas simples força interpretação literal (o
  // próprio Sheets remove essa aspa ao armazenar o valor).
  var str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function appendIndicacao_(indicador, contatos) {
  var sheet = getSheet_();
  var timestamp = new Date().toISOString();
  var rows = contatos.map(function (contato) {
    return [
      Utilities.getUuid(),
      timestamp,
      escapeForSheet_(indicador),
      escapeForSheet_(contato.nome),
      escapeForSheet_(contato.telefone),
      STATUS_PENDENTE,
    ];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
}

function updateStatus_(id, status) {
  if (status !== STATUS_PENDENTE && status !== STATUS_CONTATADO) {
    return { ok: false, error: 'status inválido' };
  }
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 6).setValue(status);
      return { ok: true };
    }
  }
  return { ok: false, error: 'indicação não encontrada' };
}

function validateSubmit_(indicador, contatos) {
  if (!indicador || !String(indicador).trim()) {
    return 'Informe quem está indicando.';
  }
  if (!Array.isArray(contatos) || contatos.length === 0) {
    return 'Adicione ao menos um contato indicado.';
  }
  if (contatos.length > MAX_CONTATOS) {
    return 'Número de contatos acima do permitido.';
  }
  if (String(indicador).length > MAX_FIELD_LEN) {
    return 'Nome de quem indica muito longo.';
  }
  for (var i = 0; i < contatos.length; i++) {
    var nome = contatos[i].nome;
    var telefone = contatos[i].telefone;
    if (!nome || !String(nome).trim() || !telefone || !String(telefone).trim()) {
      return 'Preencha nome e telefone de todos os contatos.';
    }
    if (String(nome).length > MAX_FIELD_LEN || String(telefone).length > MAX_FIELD_LEN) {
      return 'Campo de contato muito longo.';
    }
  }
  return null;
}

function doGet(e) {
  return jsonOutput_({ ok: false, error: 'ação desconhecida' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'corpo da requisição inválido' });
  }

  if (body.action === 'submit') {
    var indicador = body.indicador;
    var contatos = body.contatos || [];

    var validationError = validateSubmit_(indicador, contatos);
    if (validationError) {
      return jsonOutput_({ ok: false, error: validationError });
    }

    appendIndicacao_(indicador, contatos);
    return jsonOutput_({ ok: true });
  }

  if (body.action === 'list') {
    var checkList = checkSenha_(body.senha);
    if (!checkList.ok) return jsonOutput_(checkList);
    return jsonOutput_({ ok: true, rows: listRows_() });
  }

  if (body.action === 'updateStatus') {
    var checkUpdate = checkSenha_(body.senha);
    if (!checkUpdate.ok) return jsonOutput_(checkUpdate);
    return jsonOutput_(updateStatus_(body.id, body.status));
  }

  return jsonOutput_({ ok: false, error: 'ação desconhecida' });
}
