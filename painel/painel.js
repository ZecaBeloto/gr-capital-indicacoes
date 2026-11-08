(function () {
  const loginSection = document.getElementById('login');
  const dashboardSection = document.getElementById('dashboard');
  const senhaInput = document.getElementById('senha');
  const entrarBtn = document.getElementById('entrar-btn');
  const loginFeedback = document.getElementById('login-feedback');
  const gruposEl = document.getElementById('grupos');
  const exportarBtn = document.getElementById('exportar-btn');
  const sairBtn = document.getElementById('sair-btn');

  let currentRows = [];

  function showLoginError(message) {
    loginFeedback.textContent = message;
    loginFeedback.className = 'feedback error';
  }

  async function fetchRows(senha) {
    const url = `${WEB_APP_URL}?action=list&senha=${encodeURIComponent(senha)}`;
    const response = await fetch(url);
    return response.json();
  }

  function renderGrupos(rows) {
    currentRows = rows;
    const grupos = GRIndicacoes.groupByIndicadorEData(rows);

    if (grupos.length === 0) {
      gruposEl.innerHTML = '<div class="empty-state">Nenhuma indicação recebida ainda.</div>';
      return;
    }

    gruposEl.innerHTML = '';
    grupos.forEach((grupo) => {
      const grupoEl = document.createElement('div');
      grupoEl.className = 'grupo';

      const heading = document.createElement('h3');
      heading.textContent = grupo.indicador;
      grupoEl.appendChild(heading);

      const dataEl = document.createElement('div');
      dataEl.className = 'data';
      dataEl.textContent = grupo.dateKey;
      grupoEl.appendChild(dataEl);

      grupo.contatos.forEach((contato) => {
        const item = document.createElement('div');
        item.className = 'contato-item';

        const info = document.createElement('div');
        info.textContent = `${contato.nome} · ${contato.telefone}`;
        item.appendChild(info);

        const select = document.createElement('select');
        select.className = 'status';
        [GRIndicacoes.STATUS.PENDENTE, GRIndicacoes.STATUS.CONTATADO].forEach((value) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value === GRIndicacoes.STATUS.PENDENTE ? 'Pendente' : 'Contatado';
          if (value === contato.status) option.selected = true;
          select.appendChild(option);
        });

        select.addEventListener('change', async () => {
          const previous = contato.status;
          const next = select.value;
          contato.status = next;

          try {
            const senha = sessionStorage.getItem('senha');
            const response = await fetch(WEB_APP_URL, {
              method: 'POST',
              body: JSON.stringify({ action: 'updateStatus', senha, id: contato.id, status: next }),
            });
            const data = await response.json();
            if (!data.ok) {
              select.value = previous;
              contato.status = previous;
            }
          } catch (err) {
            select.value = previous;
            contato.status = previous;
          }
        });

        item.appendChild(select);
        grupoEl.appendChild(item);
      });

      gruposEl.appendChild(grupoEl);
    });
  }

  async function login(senha) {
    loginFeedback.textContent = '';
    entrarBtn.disabled = true;

    try {
      const data = await fetchRows(senha);
      if (data.ok) {
        sessionStorage.setItem('senha', senha);
        loginSection.hidden = true;
        dashboardSection.hidden = false;
        renderGrupos(data.rows);
      } else {
        showLoginError(data.error || 'Senha incorreta.');
      }
    } catch (err) {
      showLoginError('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
      entrarBtn.disabled = false;
    }
  }

  entrarBtn.addEventListener('click', () => {
    login(senhaInput.value);
  });

  sairBtn.addEventListener('click', () => {
    sessionStorage.removeItem('senha');
    dashboardSection.hidden = true;
    loginSection.hidden = false;
    senhaInput.value = '';
  });

  exportarBtn.addEventListener('click', () => {
    const data = GRIndicacoes.rowsToXlsxData(currentRows);
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Indicações');
    const today = GRIndicacoes.formatDateKey(new Date().toISOString());
    XLSX.writeFile(workbook, `indicacoes-${today}.xlsx`);
  });

  const storedSenha = sessionStorage.getItem('senha');
  if (storedSenha) {
    login(storedSenha);
  }
})();
