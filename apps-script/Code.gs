// GR Capital — Site de Indicação — backend Apps Script
// Planilha "Respostas", colunas: Id | Timestamp | Indicador | ContatoNome | ContatoTelefone | Status

var SHEET_NAME = 'Respostas';
var STATUS_PENDENTE = 'pendente';
var STATUS_CONTATADO = 'contatado';
var MAX_ATTEMPTS = 20;
var LOCK_MINUTES = 10;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function setup() {
  var sheet = getSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Id', 'Timestamp', 'Indicador', 'ContatoNome', 'ContatoTelefone', 'Status']);
  }
  Logger.log('Planilha pronta: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkSenha_(senha) {
  var props = PropertiesService.getScriptProperties();
  var painelSenha = props.getProperty('PAINEL_SENHA');
  var lockedUntil = props.getProperty('LOCKED_UNTIL');
  var now = new Date();

  if (lockedUntil && new Date(lockedUntil) > now) {
    return { ok: false, error: 'Bloqueado, tente novamente mais tarde.', lockedUntil: lockedUntil };
  }

  if (senha !== painelSenha) {
    var attempts = parseInt(props.getProperty('FAILED_ATTEMPTS') || '0', 10) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      var until = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
      props.setProperty('LOCKED_UNTIL', until.toISOString());
      props.setProperty('FAILED_ATTEMPTS', '0');
    } else {
      props.setProperty('FAILED_ATTEMPTS', String(attempts));
    }
    return { ok: false, error: 'Senha incorreta.' };
  }

  props.setProperty('FAILED_ATTEMPTS', '0');
  return { ok: true };
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

function appendIndicacao_(indicador, contatos) {
  var sheet = getSheet_();
  contatos.forEach(function (contato) {
    sheet.appendRow([
      Utilities.getUuid(),
      new Date().toISOString(),
      indicador,
      contato.nome,
      contato.telefone,
      STATUS_PENDENTE,
    ]);
  });
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

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'list') {
    var check = checkSenha_(e.parameter.senha);
    if (!check.ok) return jsonOutput_(check);
    return jsonOutput_({ ok: true, rows: listRows_() });
  }

  return jsonOutput_({ ok: false, error: 'ação desconhecida' });
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);

  if (body.action === 'submit') {
    var indicador = body.indicador;
    var contatos = body.contatos || [];

    if (!indicador || !String(indicador).trim()) {
      return jsonOutput_({ ok: false, error: 'Informe quem está indicando.' });
    }
    if (contatos.length === 0) {
      return jsonOutput_({ ok: false, error: 'Adicione ao menos um contato indicado.' });
    }
    for (var i = 0; i < contatos.length; i++) {
      if (!contatos[i].nome || !String(contatos[i].nome).trim() || !contatos[i].telefone || !String(contatos[i].telefone).trim()) {
        return jsonOutput_({ ok: false, error: 'Preencha nome e telefone de todos os contatos.' });
      }
    }

    appendIndicacao_(indicador, contatos);
    return jsonOutput_({ ok: true });
  }

  if (body.action === 'updateStatus') {
    var check = checkSenha_(body.senha);
    if (!check.ok) return jsonOutput_(check);
    return jsonOutput_(updateStatus_(body.id, body.status));
  }

  return jsonOutput_({ ok: false, error: 'ação desconhecida' });
}
