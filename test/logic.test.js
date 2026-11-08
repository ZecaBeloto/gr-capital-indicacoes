const test = require('node:test');
const assert = require('node:assert/strict');
const { formatDateKey, validateIndicacaoPayload, groupByIndicadorEData, rowsToXlsxData, STATUS } = require('../shared/logic.js');

test('formatDateKey extracts YYYY-MM-DD from an ISO timestamp', () => {
  assert.equal(formatDateKey('2026-11-08T17:45:00.000Z'), '2026-11-08');
});

test('validateIndicacaoPayload rejects blank indicador', () => {
  const result = validateIndicacaoPayload({ indicador: '   ', contatos: [{ nome: 'Ana', telefone: '11999990000' }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateIndicacaoPayload rejects a contato with blank nome or telefone', () => {
  const result = validateIndicacaoPayload({ indicador: 'Carlos', contatos: [{ nome: '', telefone: '11999990000' }] });
  assert.equal(result.valid, false);
});

test('validateIndicacaoPayload rejects zero contatos', () => {
  const result = validateIndicacaoPayload({ indicador: 'Carlos', contatos: [] });
  assert.equal(result.valid, false);
});

test('validateIndicacaoPayload accepts a well-formed payload', () => {
  const result = validateIndicacaoPayload({ indicador: 'Carlos', contatos: [{ nome: 'Ana', telefone: '(11) 99999-0000' }] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('groupByIndicadorEData groups rows by date then indicador, sorted desc/asc', () => {
  const rows = [
    { id: '1', indicador: 'Bruna', contatoNome: 'Ana', contatoTelefone: '111', status: STATUS.PENDENTE, timestamp: '2026-11-08T10:00:00.000Z' },
    { id: '2', indicador: 'Ana', contatoNome: 'Rui', contatoTelefone: '222', status: STATUS.CONTATADO, timestamp: '2026-11-09T10:00:00.000Z' },
  ];
  const grouped = groupByIndicadorEData(rows);
  assert.equal(grouped[0].dateKey, '2026-11-09');
  assert.equal(grouped[1].dateKey, '2026-11-08');
});

test('groupByIndicadorEData returns an empty array for no rows', () => {
  assert.deepEqual(groupByIndicadorEData([]), []);
});

test('rowsToXlsxData produces a header row plus one row per contact', () => {
  const rows = [{ indicador: 'Bruna', contatoNome: 'Ana', contatoTelefone: '111', status: STATUS.PENDENTE, timestamp: '2026-11-08T10:00:00.000Z' }];
  const data = rowsToXlsxData(rows);
  assert.deepEqual(data[0], ['Indicador', 'Nome', 'Telefone', 'Status', 'Data']);
  assert.deepEqual(data[1], ['Bruna', 'Ana', '111', STATUS.PENDENTE, '2026-11-08']);
});
