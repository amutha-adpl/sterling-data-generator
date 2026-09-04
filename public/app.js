/**
 * Front-end for the Sterling sample data generator.
 *
 * The form is rendered from the metadata returned by GET /api/generators, so a
 * new generator needs no UI changes. All rendering/validation lives on the
 * server; this file only renders, previews and downloads payloads.
 */

const state = {
  generators: [],
  generatorId: null,
  fields: [],
  defaults: {},
  options: {},
  documents: [],
  bundle: { xml: null, json: null },
  format: 'xml',
  currentIndex: 0,
  requestToken: 0,
};

const els = {
  description: document.getElementById('generator-description'),
  generatorSelect: document.getElementById('generator-select'),
  resetButton: document.getElementById('reset-button'),
  form: document.getElementById('options-form'),
  formGroups: document.getElementById('form-groups'),
  status: document.getElementById('status'),
  preview: document.querySelector('#preview code'),
  segmented: document.querySelectorAll('.segmented__item'),
  orderNav: document.getElementById('order-nav'),
  orderSelect: document.getElementById('order-select'),
  orderPosition: document.getElementById('order-position'),
  prevOrder: document.getElementById('prev-order'),
  nextOrder: document.getElementById('next-order'),
  copyButton: document.getElementById('copy-button'),
  downloadOne: document.getElementById('download-one'),
  downloadAll: document.getElementById('download-all'),
  toast: document.getElementById('toast'),
};

init();

async function init() {
  bindEvents();
  const data = await fetchJson('/api/generators');
  state.generators = data.generators;

  els.generatorSelect.innerHTML = state.generators
    .map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.label)}</option>`)
    .join('');

  selectGenerator(state.generators[0]?.id);
  await generate();
}

function bindEvents() {
  els.generatorSelect.addEventListener('change', (event) => {
    selectGenerator(event.target.value);
    generate();
  });

  els.resetButton.addEventListener('click', () => {
    state.options = { ...state.defaults };
    renderForm();
    generate();
  });

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    generate();
  });

  els.form.addEventListener('input', () => {
    scheduleGenerate();
  });

  els.form.addEventListener('change', () => {
    scheduleGenerate();
  });

  for (const button of els.segmented) {
    button.addEventListener('click', () => setFormat(button.dataset.format));
  }

  els.prevOrder.addEventListener('click', () => step(-1));
  els.nextOrder.addEventListener('click', () => step(1));
  els.orderSelect.addEventListener('change', (event) => {
    state.currentIndex = Number(event.target.value);
    renderPreview();
  });

  els.copyButton.addEventListener('click', copyToClipboard);
  els.downloadOne.addEventListener('click', () => downloadCurrent());
  els.downloadAll.addEventListener('click', () => downloadAll());
}

/* ----------------- generator + form ----------------- */

function selectGenerator(id) {
  const generator = state.generators.find((g) => g.id === id);
  if (!generator) return;
  state.generatorId = generator.id;
  state.fields = generator.fields;
  state.defaults = generator.defaults;
  state.options = { ...generator.defaults };
  state.format = generator.formats[0] ?? 'xml';
  els.description.textContent = `${generator.apiName} - ${generator.description}`;
  els.generatorSelect.value = generator.id;
  syncFormatButtons();
  renderForm();
}

function renderForm() {
  const groups = new Map();
  for (const field of state.fields) {
    if (!groups.has(field.group)) groups.set(field.group, []);
    groups.get(field.group).push(field);
  }

  els.formGroups.innerHTML = '';
  for (const [group, fields] of groups) {
    const section = document.createElement('fieldset');
    section.className = 'form-group';
    section.style.border = '0';
    section.style.margin = '0';
    section.style.padding = '0';

    const title = document.createElement('h2');
    title.className = 'form-group__title';
    title.textContent = group;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'form-grid';
    for (const field of fields) {
      grid.appendChild(renderField(field));
    }
    section.appendChild(grid);
    els.formGroups.appendChild(section);
  }
}

function renderField(field) {
  if (field.kind === 'boolean') {
    return checkboxRow(field);
  }

  const row = document.createElement('div');
  row.className = `form-row${field.kind === 'select' || field.kind === 'text' ? ' form-row--full' : ''}`;

  const label = document.createElement('label');
  label.className = 'form-row__label';
  label.setAttribute('for', `field-${field.name}`);
  label.textContent = field.label;

  if (field.kind === 'select') {
    const select = document.createElement('select');
    select.id = `field-${field.name}`;
    select.name = field.name;
    select.innerHTML = field.options
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}"${option.value === state.options[field.name] ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
      )
      .join('');
    row.append(label, select);
  } else {
    const input = document.createElement('input');
    input.id = `field-${field.name}`;
    input.name = field.name;
    input.type = field.kind === 'number' ? 'number' : field.inputType ?? 'text';
    input.value = state.options[field.name] ?? '';
    if (field.kind === 'number') {
      input.min = field.min;
      input.max = field.max;
      input.step = field.step ?? 1;
    }
    if (field.maxLength) input.maxLength = field.maxLength;
    if (field.placeholder) input.placeholder = field.placeholder;
    row.append(label, input);
  }

  if (field.help) {
    const help = document.createElement('span');
    help.className = 'form-row__help';
    help.textContent = field.help;
    row.appendChild(help);
  }
  return row;
}

function checkboxRow(field) {
  const row = document.createElement('div');
  row.className = 'form-row form-row--full';

  const wrapper = document.createElement('label');
  wrapper.className = 'checkbox-row';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = field.name;
  input.checked = Boolean(state.options[field.name]);

  const text = document.createElement('span');
  text.textContent = field.label;

  wrapper.append(input, text);
  row.appendChild(wrapper);

  if (field.help) {
    const help = document.createElement('span');
    help.className = 'form-row__help';
    help.textContent = field.help;
    row.appendChild(help);
  }
  return row;
}

function readForm() {
  const options = {};
  for (const field of state.fields) {
    const input = els.form.elements.namedItem(field.name);
    if (!input) continue;
    if (field.kind === 'boolean') options[field.name] = Boolean(input.checked);
    else if (field.kind === 'number') options[field.name] = input.value === '' ? 0 : Number(input.value);
    else options[field.name] = input.value;
  }
  state.options = options;
  return options;
}

/* ----------------- generation ----------------- */

let debounceTimer = null;
function scheduleGenerate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(generate, 250);
}

async function generate() {
  const token = ++state.requestToken;
  setStatus('Generating…');

  try {
    const data = await fetchJson('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generatorId: state.generatorId, options: readForm() }),
    });
    if (token !== state.requestToken) return; // a newer request has landed

    state.documents = data.documents;
    state.bundle = data.bundle ?? { xml: null, json: null };
    state.currentIndex = Math.min(state.currentIndex, Math.max(data.documents.length - 1, 0));
    state.options = data.options;

    renderOrderNav();
    renderPreview();
    setStatus(`${data.meta.count} order(s) generated in ${data.meta.durationMs} ms`);
  } catch (error) {
    if (token !== state.requestToken) return;
    setStatus(error.message ?? 'Generation failed', true);
  }
}

function setFormat(format) {
  state.format = format;
  syncFormatButtons();
  renderPreview();
}

function syncFormatButtons() {
  for (const button of els.segmented) {
    button.classList.toggle('is-active', button.dataset.format === state.format);
  }
}

function step(delta) {
  const count = state.documents.length;
  if (count === 0) return;
  state.currentIndex = (state.currentIndex + delta + count) % count;
  els.orderSelect.value = String(state.currentIndex);
  renderPreview();
}

function renderOrderNav() {
  const count = state.documents.length;
  els.orderNav.hidden = count <= 1;
  els.downloadOne.disabled = count === 0;

  els.orderSelect.innerHTML = state.documents
    .map((doc, index) => `<option value="${index}">${escapeHtml(doc.label)}</option>`)
    .join('');
  els.orderSelect.value = String(state.currentIndex);
  renderOrderPosition();
}

function renderOrderPosition() {
  els.orderPosition.textContent = `${state.currentIndex + 1} / ${state.documents.length}`;
}

function renderPreview() {
  const document_ = state.documents[state.currentIndex];
  renderOrderPosition();

  if (!document_) {
    els.preview.innerHTML = escapeHtml('No documents generated.');
    return;
  }

  const source = state.format === 'json' ? document_.json : document_.xml;
  if (!source) {
    els.preview.innerHTML = escapeHtml(`This generator does not support ${state.format.toUpperCase()} output.`);
    return;
  }

  els.preview.innerHTML =
    state.format === 'json' ? highlightJson(source) : highlightXml(source);
}

function currentDocument() {
  return state.documents[state.currentIndex];
}

/* ----------------- download / copy ----------------- */

async function copyToClipboard() {
  const document_ = currentDocument();
  const source = document_ ? (state.format === 'json' ? document_.json : document_.xml) : null;
  if (!source) return;
  try {
    await navigator.clipboard.writeText(source);
    showToast('Copied to clipboard');
  } catch {
    showToast('Clipboard blocked by the browser - use Download instead');
  }
}

function downloadCurrent() {
  const document_ = currentDocument();
  const source = document_ ? (state.format === 'json' ? document_.json : document_.xml) : null;
  if (!source) return;
  saveFile(`${filePrefix()}_${document_.key}.${state.format}`, source, mimeType());
}

function downloadAll() {
  const source = state.format === 'json' ? state.bundle.json : state.bundle.xml;
  if (!source) return;
  const suffix = state.documents.length === 1 ? currentDocument().key : `${state.documents.length}-orders`;
  saveFile(`${filePrefix()}_${suffix}.${state.format}`, source, mimeType());
}

function saveFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast(`Saved ${fileName}`);
}

function filePrefix() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${state.generatorId}_${stamp}`;
}

function mimeType() {
  return state.format === 'json' ? 'application/json;charset=utf-8' : 'application/xml;charset=utf-8';
}

/* ----------------- helpers ----------------- */

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.issues?.length
      ? payload.error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
      : payload?.error?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle('status--error', isError);
}

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

/**
 * Escape for safe insertion into a text node: `&`, `<` and `>` only.
 * Quotes are left alone so the highlighters below can still recognise string
 * literals and attribute values.
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
}

/** Lightweight XML highlighter: escaped first, then tokenised per tag. */
function highlightXml(source) {
  return escapeHtml(source).replace(/&lt;[\s\S]*?&gt;/g, (tag) =>
    tag
      .replace(/([\w:.-]+)=("[^"]*")/g, '<span class="tok-attr">$1</span>=<span class="tok-str">$2</span>')
      .replace(/^(&lt;\/?)([\w:.-]+)/, '$1<span class="tok-tag">$2</span>'),
  );
}

/** Lightweight JSON highlighter. */
function highlightJson(source) {
  return escapeHtml(source).replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:?)|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, stringToken, keywordToken, numberToken) => {
      if (stringToken) {
        return stringToken.trimEnd().endsWith(':')
          ? `<span class="tok-key">${stringToken.replace(/:$/, '')}</span>:`
          : `<span class="tok-str">${stringToken}</span>`;
      }
      if (keywordToken) return `<span class="tok-key">${keywordToken}</span>`;
      if (numberToken) return `<span class="tok-num">${numberToken}</span>`;
      return match;
    },
  );
}
