# Site de Indicação de Contatos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static GitHub Pages site (public referral form + password-gated admin painel) backed by a Google Apps Script Web App + Google Sheet, following the architecture already in production for `pesquisa-planejamento-2027`.

**Architecture:** Two static pages (`web/` form, `painel/` dashboard) share pure JS logic (`shared/logic.js`, unit-tested with `node --test`) for grouping, validation, and xlsx-row-shaping. All persistence goes through a Google Apps Script Web App (`apps-script/Code.gs`) that writes/reads a Google Sheet and gates reads/writes with a script-property password + attempt lockout. No other backend exists — GitHub Pages serves static files only.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework/bundler), Google Apps Script (`.gs`), Google Sheets, SheetJS (CDN, client-side `.xlsx` export), Node's built-in `node:test`/`node:assert` for the one testable module.

**Spec:** `docs/superpowers/specs/2026-11-08-site-indicacao-design.md`

## Global Constraints

- Hosting: GitHub Pages only, no custom server — confirmed with Helio.
- Backend: Google Apps Script Web App + Google Sheets, on Helio's **personal** Google account — confirmed with Helio.
- Brand: navy `#06152C` + gold `#C8A84B`, Poppins — per `wiki/templates/brand.md` pattern already used in GR Capital client materials.
- Form fields: `indicador` (free text, who is referring) + repeatable `contatos[]` of `{nome, telefone}` (both free text, no format validation) — confirmed with Helio.
- Painel: grouped by `indicador` and by date, each contact has a `status` of `"pendente"` or `"contatado"`, editable in the painel — confirmed with Helio.
- Painel access: single password (`PAINEL_SENHA` script property), no other users — confirmed with Helio.
- Export: `.xlsx` generated client-side from the data already loaded in the painel (SheetJS), not a manual Google Sheets download.
- Lockout default: 20 wrong password attempts → 10 minute lock, mirroring the reference project (left to builder, this is the default absent a reason to change it).
- No repo push / GitHub Pages publish without Helio's explicit go-ahead at that step.

## Review Focus

- **Empty/blank fields submitted:** `indicador` blank, or a `contato` with blank `nome` or `telefone` — form must block submit with a visible message, not send partial rows. (Task 2)
- **Zero contatos at submit time:** user adds then removes all contact rows before submitting — must block submit rather than POST an empty list. (Task 2)
- **Empty sheet / no indicações yet:** painel's first load with zero rows must render a friendly empty state, not throw on grouping/rendering. (Task 1, Task 3)
- **Freeform telefone values** (spaces, `+55`, parentheses, emoji pasted from WhatsApp) must survive grouping and `.xlsx` export without breaking rendering or the exported file. (Task 1, Task 3)
- **Repeated wrong painel password:** lockout must trigger after the configured attempt count, persist across page reloads (state lives in Script Properties server-side, not just in-memory/client), and block even a subsequently-correct password until the lock expires. (Task 4)

---

## File Structure

```
gr-capital-indicacoes/
  .gitignore
  README.md
  shared/
    logic.js          # pure JS: grouping, validation, xlsx row-shaping (Task 1)
    styles.css         # shared brand styles, navy/gold, Poppins (Task 1)
  web/
    index.html         # public referral form (Task 2)
    config.js           # WEB_APP_URL placeholder (Task 2)
    form.js             # dynamic contact rows, validation, submit (Task 2)
  painel/
    index.html          # password-gated dashboard (Task 3)
    config.js            # WEB_APP_URL placeholder (Task 3)
    painel.js             # login, fetch, grouping render, status toggle, xlsx export (Task 3)
  apps-script/
    Code.gs              # doGet/doPost, password+lockout, sheet read/write (Task 4)
  test/
    logic.test.js        # node --test coverage of shared/logic.js (Task 1)
```

---

### Task 1: Shared logic module (`shared/logic.js`) + brand styles

**Files:**
- Create: `shared/logic.js`
- Create: `shared/styles.css`
- Test: `test/logic.test.js`

**Interfaces:**
- Produces (consumed by Task 2 and Task 3 via `<script src="../shared/logic.js">`, attaching to `window.GRIndicacoes`):
  - `validateIndicacaoPayload({ indicador: string, contatos: Array<{nome: string, telefone: string}> }) -> { valid: boolean, errors: string[] }`
  - `groupByIndicadorEData(rows: Array<{id, indicador, contatoNome, contatoTelefone, status, timestamp}>) -> Array<{dateKey: string, indicador: string, contatos: Array<{id, nome, telefone, status}>}>` (sorted by `dateKey` desc, then `indicador` asc)
  - `formatDateKey(isoTimestamp: string) -> string` (`"YYYY-MM-DD"`, from an ISO timestamp, using UTC-independent local parts — no timezone library)
  - `rowsToXlsxData(rows: Array<{indicador, contatoNome, contatoTelefone, status, timestamp}>) -> Array<Array<string>>` (first row is the header `["Indicador", "Nome", "Telefone", "Status", "Data"]`, each following row the formatted values; `timestamp` rendered via `formatDateKey`)
  - `STATUS = { PENDENTE: "pendente", CONTATADO: "contatado" }`

- [ ] **Step 1: Write failing tests for `formatDateKey` and `validateIndicacaoPayload`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/logic.test.js`
Expected: FAIL with "Cannot find module '../shared/logic.js'"

- [ ] **Step 3: Implement `formatDateKey` and `validateIndicacaoPayload` in `shared/logic.js`**

Export via `module.exports = {...}` AND assign the same object to `globalThis.GRIndicacoes` (guarded with `typeof window !== 'undefined'`) so the file works both under `node --test` and as a plain `<script>` tag in the browser with no bundler. `telefone` values are free text — validation only checks non-blank after `.trim()`, no format/regex.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/logic.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Write failing tests for `groupByIndicadorEData` and `rowsToXlsxData`**

```js
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
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `node --test test/logic.test.js`
Expected: FAIL with "groupByIndicadorEData is not a function" (and same for `rowsToXlsxData`)

- [ ] **Step 7: Implement `groupByIndicadorEData`, `rowsToXlsxData`, and `STATUS` in `shared/logic.js`**

`groupByIndicadorEData` buckets by `(dateKey, indicador)` pair into one group per bucket, each with a `contatos` array; sort groups by `dateKey` descending, then `indicador` ascending (locale-aware `localeCompare`).

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test test/logic.test.js`
Expected: PASS (8 tests)

- [ ] **Step 9: Write `shared/styles.css`**

Define CSS custom properties for the brand: `--navy: #06152C; --gold: #C8A84B;` plus body background, heading color, button style (gold fill, navy text), input style, loaded from Google Fonts `Poppins`. No code block needed beyond these exact values — rest of the rules (spacing, layout primitives) are the builder's call within this palette.

- [ ] **Step 10: Commit**

```bash
git add shared/logic.js shared/styles.css test/logic.test.js
git commit -m "feat: add shared validation/grouping/export logic and brand styles"
```

---

### Task 2: Public referral form (`web/`)

**Files:**
- Create: `web/index.html`
- Create: `web/config.js`
- Create: `web/form.js`

**Interfaces:**
- Consumes: `window.GRIndicacoes.validateIndicacaoPayload` from Task 1 (`shared/logic.js`, loaded via `<script src="../shared/logic.js"></script>` before `form.js`); `WEB_APP_URL` constant from `config.js`.
- Produces: none consumed by later tasks (leaf page). Submits `POST { action: "submit", indicador, contatos }` as JSON to `WEB_APP_URL`, expects `{ ok: true }` or `{ ok: false, error }` back.

- [ ] **Step 1: Write `web/config.js`**

```js
const WEB_APP_URL = "REPLACE_WITH_APPS_SCRIPT_WEB_APP_URL";
```

- [ ] **Step 2: Write `web/index.html`**

Links `../shared/styles.css`, loads `../shared/logic.js` then `config.js` then `form.js` (in that order, before `</body>`). Contains: a heading with the GR Capital + BTG identification, an input for `indicador`, a container `#contatos` holding one contact row template (`nome` + `telefone` inputs), a "+ Adicionar contato" button, a submit button, and a `#feedback` element for success/error messages. Include the short LGPD-style notice from the spec's compliance note (one sentence: data is used only for GR Capital to get in touch about the referral).

- [ ] **Step 3: Write `web/form.js`**

Implements: adding/removing contact rows (minimum 1 row, never fewer); on submit, reads the DOM into `{ indicador, contatos }`, runs `GRIndicacoes.validateIndicacaoPayload`, and when invalid writes the first error into `#feedback` and stops (no network call) — this is the Review Focus case for blank fields and zero-contatos. When valid, `fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify(payload) })`, disables the submit button while in flight, and on success clears the form and shows a confirmation message; on failure (network error or `{ ok: false }`) shows the error and re-enables the button.

- [ ] **Step 4: Manual verification in the Browser pane**

Open `web/index.html` directly (`file://` URL) in the browser pane. Confirm: submitting with blank `indicador` shows an error and makes no network call (check via `read_network_requests`); removing all contact rows is prevented (at least one always remains) or re-blocked by validation; adding two contact rows and filling them renders correctly with brand colors (navy/gold, Poppins) applied. `WEB_APP_URL` is still a placeholder at this point, so a valid submit will fail the fetch — confirm it surfaces a clear error rather than a silent failure or a JS exception (check `read_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: add public referral form"
```

---

### Task 3: Admin painel (`painel/`)

**Files:**
- Create: `painel/index.html`
- Create: `painel/config.js`
- Create: `painel/painel.js`

**Interfaces:**
- Consumes: `window.GRIndicacoes.{groupByIndicadorEData, rowsToXlsxData}` from Task 1; `WEB_APP_URL` from `config.js`; SheetJS global `XLSX` (loaded via CDN `<script>` in `index.html`, e.g. `xlsx@0.18.5` from cdnjs, pinned version).
- Produces: none (leaf page). Sends `GET WEB_APP_URL?action=list&senha=...` expecting `{ ok: true, rows: [...] }` or `{ ok: false, error, lockedUntil? }`; sends `POST { action: "updateStatus", senha, id, status }` expecting `{ ok: true }` or `{ ok: false, error }`.

- [ ] **Step 1: Write `painel/config.js`** — same shape as `web/config.js`, same `WEB_APP_URL` value.

- [ ] **Step 2: Write `painel/index.html`**

Links `../shared/styles.css`, the SheetJS CDN script, `../shared/logic.js`, `config.js`, then `painel.js`. Contains a login view (`#login` with a password input + "Entrar" button + error slot) and a dashboard view (`#dashboard`, hidden until authenticated) with: a "Baixar .xlsx" button, a "Sair" button, and a `#grupos` container where grouped results render. Both views live in the same page; `painel.js` toggles their visibility.

- [ ] **Step 3: Write `painel/painel.js` — auth and fetch**

On "Entrar": `fetch(`${WEB_APP_URL}?action=list&senha=${encodeURIComponent(senha)}`)`. On `{ ok: true, rows }`: store `senha` in `sessionStorage` (cleared on "Sair" — per spec, "o navegador lembra a senha até você clicar em Sair"), hide `#login`, show `#dashboard`, call the render step below. On `{ ok: false, error }`: show `error` in the login error slot (this surfaces the lockout message verbatim from the backend — see Task 4). On page load, if `sessionStorage` already holds a `senha`, skip the login view and fetch immediately.

- [ ] **Step 4: Write `painel/painel.js` — render**

`renderGrupos(rows)`: calls `GRIndicacoes.groupByIndicadorEData(rows)`; when the result is `[]`, renders a single friendly empty-state message in `#grupos` (Review Focus: empty sheet) instead of an empty container. Otherwise renders one section per group (`dateKey` + `indicador` as a subheading) and one row per contact with `nome`, `telefone`, and a status control (`<select>` or toggle) initialized to the contact's current `status`.

- [ ] **Step 5: Write `painel/painel.js` — status update**

On a status control's change event: optimistically update that control's displayed state, then `fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify({ action: "updateStatus", senha: sessionStorage.getItem("senha"), id, status }) })`. On `{ ok: false }`, revert the control to its previous value and show an inline error near that row.

- [ ] **Step 6: Write `painel/painel.js` — export**

On "Baixar .xlsx": take the currently-loaded `rows` (the same data last rendered, not a fresh fetch), call `GRIndicacoes.rowsToXlsxData(rows)`, build a worksheet with `XLSX.utils.aoa_to_sheet(data)`, wrap in a workbook, and trigger a download named `indicacoes-<YYYY-MM-DD>.xlsx` (today's date) via `XLSX.writeFile`.

- [ ] **Step 7: Manual verification in the Browser pane**

Open `painel/index.html` via `file://`. Confirm the login view renders with brand styling. Since `WEB_APP_URL` is still a placeholder, confirm a login attempt surfaces a clear fetch-failure message rather than an unhandled exception (`read_console_messages`). This task cannot be fully verified end-to-end until Task 4's Web App is deployed — note that in the task's completion, and re-verify login + rendering + status toggle + export against the real deployed URL once Task 4 is done and `config.js` in both `web/` and `painel/` is updated with the real URL.

- [ ] **Step 8: Commit**

```bash
git add painel/
git commit -m "feat: add password-gated admin painel with status tracking and xlsx export"
```

---

### Task 4: Apps Script backend (`apps-script/Code.gs`)

**Files:**
- Create: `apps-script/Code.gs`

**Interfaces:**
- Consumes: nothing from this repo (runs in the Apps Script sandbox, not Node — no `require`, no access to `shared/logic.js`).
- Produces: the deployed Web App URL that `web/config.js` and `painel/config.js` both point `WEB_APP_URL` at.

Sheet schema (one sheet, tab `Respostas`), columns in this order: `Id | Timestamp | Indicador | ContatoNome | ContatoTelefone | Status`.

- [ ] **Step 1: Implement `setup()`**

One-off function Helio runs once from the Apps Script editor: creates the spreadsheet (or uses the bound one, builder's call), adds the `Respostas` sheet with the header row above, and logs the spreadsheet URL — mirrors the reference project's "Execute setup uma vez e autorize. O log mostra o link da planilha."

- [ ] **Step 2: Implement `doPost(e)` — submit action**

Parses `JSON.parse(e.postData.contents)`. When `action === "submit"`: for each item in `contatos`, appends a row `[Utilities.getUuid(), new Date().toISOString(), indicador, contatoNome, contatoTelefone, "pendente"]` to `Respostas`. Rejects (returns `{ ok: false, error }`) when `indicador` is blank or `contatos` is empty or any `contato` has a blank `nome`/`telefone` — this is the Review Focus server-side mirror of Task 2 Step 3's client validation, since the client check alone doesn't stop a direct POST. Returns `ContentService.createTextOutput(JSON.stringify({ ok: true }))` with `application/json` mime type (and CORS: Apps Script Web Apps deployed with "Anyone" access answer cross-origin GETs/POSTs without extra headers needed, per the reference project's working setup — no special CORS handling beyond matching that deployment configuration).

- [ ] **Step 3: Implement `doPost(e)` — updateStatus action**

When `action === "updateStatus"`: first runs the password+lockout check (Step 5); on failure returns the same `{ ok: false, error, lockedUntil? }` shape as the list action. On success, finds the row by `Id` column match and overwrites its `Status` cell with the given `status` (only `"pendente"` or `"contatado"` accepted; anything else returns `{ ok: false, error: "status inválido" }`).

- [ ] **Step 4: Implement `doGet(e)` — list action**

When `e.parameter.action === "list"`: runs the password+lockout check (Step 5); on success, reads all rows from `Respostas` (skip header), maps to `{ id, timestamp, indicador, contatoNome, contatoTelefone, status }` objects, returns `{ ok: true, rows }`.

- [ ] **Step 5: Implement password + lockout check `checkSenha(senha)`**

Reads `PAINEL_SENHA` from `PropertiesService.getScriptProperties()`. Tracks `FAILED_ATTEMPTS` (integer) and `LOCKED_UNTIL` (ISO timestamp) in the same script properties. If `LOCKED_UNTIL` is set and in the future: return `{ ok: false, error: "Bloqueado, tente novamente mais tarde.", lockedUntil: LOCKED_UNTIL }` — this applies even when `senha` is correct, per Review Focus (a correct password doesn't bypass an active lock). Else if `senha !== PAINEL_SENHA`: increment `FAILED_ATTEMPTS`; when it reaches 20, set `LOCKED_UNTIL` to now + 10 minutes and reset `FAILED_ATTEMPTS` to 0; return `{ ok: false, error: "Senha incorreta." }`. Else (correct password, not locked): reset `FAILED_ATTEMPTS` to 0 and return `{ ok: true }`.

- [ ] **Step 6: Manual deployment verification**

This step is this task's test, since `.gs` files don't run under `node --test`. Helio (per the design doc's division of labor) creates the Apps Script project at script.google.com, pastes `Code.gs`, runs `setup()` once and authorizes it, then deploys as a Web App ("Executar como: eu", acesso "Qualquer pessoa"). Verification: `curl` or browser-fetch the deployed URL with `?action=list&senha=<wrong>` repeated until lockout triggers, confirm the 20th attempt returns the lockout error and a 21st attempt (even with the right password) still does; then with the right password confirm `{ ok: true, rows: [] }` on the empty sheet.

- [ ] **Step 7: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat: add Apps Script backend with password lockout"
```

---

### Task 5: Wire real Web App URL, README, and final verification

**Files:**
- Modify: `web/config.js`
- Modify: `painel/config.js`
- Create: `README.md`
- Create: `.gitignore`

**Interfaces:**
- Consumes: the real Web App URL produced by Task 4 Step 6.
- Produces: nothing further (final task).

- [ ] **Step 1: Write `.gitignore`** — standard OS/editor noise (`.DS_Store`, `node_modules/`, `*.log`); nothing project-specific needs excluding since no secrets live in this repo (the password lives only in Script Properties, never in a file here).

- [ ] **Step 2: Write `README.md`**

Mirrors the reference project's structure: what the repo is, where responses live (the Sheet, via the Web App — "nenhuma resposta fica neste repositório"), how to install from zero (create the Apps Script project, run `setup()`, deploy as Web App, paste the URL into both `config.js` files), how to set/change `PAINEL_SENHA` (Script Properties, 12+ random characters, no redeploy needed), how the lockout behaves (20 attempts / 10 minutes), and how to run the tests (`node --test test/logic.test.js`).

- [ ] **Step 3: Replace the placeholder in both `config.js` files with the real deployed Web App URL** from Task 4 Step 6.

- [ ] **Step 4: End-to-end manual verification in the Browser pane**

Open `web/index.html`, submit a real referral with 2 contacts, confirm the success message. Open `painel/index.html`, log in with the real `PAINEL_SENHA`, confirm both contacts appear grouped under today's date and the submitted `indicador`, toggle one to "contatado" and reload to confirm it persisted, then click "Baixar .xlsx" and confirm the downloaded file opens with both rows and the updated status.

- [ ] **Step 5: Commit**

```bash
git add web/config.js painel/config.js README.md .gitignore
git commit -m "chore: wire deployed Web App URL and add README"
```

- [ ] **Step 6: Ask Helio before publishing** — creating the GitHub remote, pushing, and enabling GitHub Pages is a separate, explicit go-ahead per the spec's constraints; do not run `git remote add` / `git push` / enable Pages until he confirms in chat.
