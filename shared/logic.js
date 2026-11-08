const STATUS = {
  PENDENTE: 'pendente',
  CONTATADO: 'contatado',
};

function formatDateKey(isoTimestamp) {
  return String(isoTimestamp).slice(0, 10);
}

function validateIndicacaoPayload({ indicador, contatos }) {
  const errors = [];

  if (!indicador || !String(indicador).trim()) {
    errors.push('Informe quem está indicando.');
  }

  if (!Array.isArray(contatos) || contatos.length === 0) {
    errors.push('Adicione ao menos um contato indicado.');
  } else {
    contatos.forEach((contato, index) => {
      if (!contato.nome || !String(contato.nome).trim()) {
        errors.push(`Informe o nome do contato ${index + 1}.`);
      }
      if (!contato.telefone || !String(contato.telefone).trim()) {
        errors.push(`Informe o telefone do contato ${index + 1}.`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function groupByIndicadorEData(rows) {
  const buckets = new Map();

  rows.forEach((row) => {
    const dateKey = formatDateKey(row.timestamp);
    const bucketKey = `${dateKey}__${row.indicador}`;
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { dateKey, indicador: row.indicador, contatos: [] });
    }
    buckets.get(bucketKey).contatos.push({
      id: row.id,
      nome: row.contatoNome,
      telefone: row.contatoTelefone,
      status: row.status,
    });
  });

  return Array.from(buckets.values()).sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? 1 : -1;
    return a.indicador.localeCompare(b.indicador);
  });
}

function rowsToXlsxData(rows) {
  const header = ['Indicador', 'Nome', 'Telefone', 'Status', 'Data'];
  const body = rows.map((row) => [
    row.indicador,
    row.contatoNome,
    row.contatoTelefone,
    row.status,
    formatDateKey(row.timestamp),
  ]);
  return [header, ...body];
}

const GRIndicacoes = { STATUS, formatDateKey, validateIndicacaoPayload, groupByIndicadorEData, rowsToXlsxData };

if (typeof window !== 'undefined') {
  window.GRIndicacoes = GRIndicacoes;
}

if (typeof module !== 'undefined') {
  module.exports = GRIndicacoes;
}
