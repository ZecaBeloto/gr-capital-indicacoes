(function () {
  const contatosContainer = document.getElementById('contatos');
  const template = document.getElementById('contato-row-template');
  const addButton = document.getElementById('add-contato');
  const form = document.getElementById('indicacao-form');
  const submitBtn = document.getElementById('submit-btn');
  const feedback = document.getElementById('feedback');

  function updateRemoveButtons() {
    const rows = contatosContainer.querySelectorAll('.contato-row');
    rows.forEach((row) => {
      row.querySelector('.remove-contato').style.display = rows.length > 1 ? '' : 'none';
    });
  }

  function addContatoRow() {
    const clone = template.content.cloneNode(true);
    clone.querySelector('.remove-contato').addEventListener('click', (event) => {
      event.target.closest('.contato-row').remove();
      updateRemoveButtons();
    });
    contatosContainer.appendChild(clone);
    updateRemoveButtons();
  }

  function readContatos() {
    const rows = contatosContainer.querySelectorAll('.contato-row');
    return Array.from(rows).map((row) => ({
      nome: row.querySelector('.contato-nome').value,
      telefone: row.querySelector('.contato-telefone').value,
    }));
  }

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = 'feedback ' + type;
  }

  function clearForm() {
    document.getElementById('indicador').value = '';
    contatosContainer.innerHTML = '';
    addContatoRow();
  }

  addButton.addEventListener('click', addContatoRow);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      indicador: document.getElementById('indicador').value,
      contatos: readContatos(),
    };

    const result = GRIndicacoes.validateIndicacaoPayload(payload);
    if (!result.valid) {
      showFeedback(result.errors[0], 'error');
      return;
    }

    submitBtn.disabled = true;
    showFeedback('Enviando...', '');

    try {
      const response = await fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'submit', ...payload }),
      });
      const data = await response.json();

      if (data.ok) {
        showFeedback('Indicação enviada com sucesso. Obrigado!', 'success');
        clearForm();
      } else {
        showFeedback(data.error || 'Não foi possível enviar. Tente novamente.', 'error');
      }
    } catch (err) {
      showFeedback('Não foi possível enviar. Verifique sua conexão e tente novamente.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  addContatoRow();
})();
