import QRCode from "qrcode";
import "./style.css";

const STORAGE_KEY = "qr-code-studio-history-v1";
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const state = {
  currentDataUrl: "",
  currentSvg: "",
  currentRecord: null,
  history: loadHistory(),
  batchResults: [],
  activeTab: "create",
};

function loadHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history.slice(0, 250)));
    return true;
  } catch (error) {
    showToast("Could not save history in this browser. Export your QR codes to keep a copy.", "error");
    return false;
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function slugify(value) {
  return String(value || "qr-code")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "qr-code";
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function getContrastRatio(foreground, background) {
  const luminance = color => {
    const channels = color.match(/[a-f\d]{2}/gi)?.map(channel => parseInt(channel, 16) / 255);
    if (!channels || channels.length !== 3) return 0;
    const [red, green, blue] = channels.map(channel =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function showToast(message, kind = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show ${kind}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.className = "toast", 3600);
}

function getFormRecord() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name: $("#qrName").value.trim() || "Untitled QR Code",
    url: normalizeUrl($("#qrUrl").value),
    subtitle: $("#qrSubtitle").value.trim(),
    footer: $("#qrFooter").value.trim(),
    color: $("#qrColor").value,
    background: $("#qrBackground").value,
    errorCorrection: $("#qrErrorCorrection").value,
    createdAt: new Date().toISOString(),
  };
}

async function renderQr(record) {
  if (!record.url || !validUrl(record.url)) {
    showToast("Enter a complete http:// or https:// URL.", "error");
    $("#qrUrl").focus();
    return false;
  }

  const options = {
    errorCorrectionLevel: record.errorCorrection || "H",
    margin: 4,
    width: 640,
    color: { dark: record.color || "#111111", light: record.background || "#ffffff" },
  };

  try {
    state.currentDataUrl = await QRCode.toDataURL(record.url, options);
    state.currentSvg = await QRCode.toString(record.url, {
      ...options, type: "svg", width: 640
    });
    state.currentRecord = record;

    $("#previewQr").src = state.currentDataUrl;
    $("#previewQr").alt = `QR code for ${record.name}`;
    $("#previewName").textContent = record.name;
    $("#previewSubtitle").textContent = record.subtitle;
    $("#previewFooter").textContent = record.footer;
    $("#previewSubtitle").hidden = !record.subtitle;
    $("#previewFooter").hidden = !record.footer;
    const contrast = getContrastRatio(options.color.dark, options.color.light);
    const contrastText = `${contrast.toFixed(1)}:1 contrast`;
    const scanAssessment = $("#scanAssessment");
    scanAssessment.classList.toggle("warning", contrast < 4.5);
    scanAssessment.innerHTML = contrast < 4.5
      ? `<strong>Low contrast: ${contrastText}</strong><span>Choose darker modules or a lighter background. This is a visual check, not a scan guarantee.</span>`
      : `<strong>Good contrast: ${contrastText}</strong><span>${new TextEncoder().encode(record.url).length} URL bytes encoded. Longer links create denser codes; test the printed result with a phone.</span>`;
    scanAssessment.hidden = false;
    $("#previewEmpty").hidden = true;
    $("#previewCard").hidden = false;
    $("#downloadPng").disabled = false;
    $("#downloadSvg").disabled = false;
    $("#printCurrent").disabled = false;
    return true;
  } catch (error) {
    console.error(error);
    showToast("QR generation failed. Try a shorter URL or a different colour.", "error");
    return false;
  }
}

function upsertHistory(record) {
  const saved = { ...record, updatedAt: new Date().toISOString() };
  state.history = [saved, ...state.history.filter(item => item.url !== saved.url || item.name !== saved.name)].slice(0, 250);
  saveHistory();
  renderHistory();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadCurrent(format) {
  if (!state.currentRecord) return;
  const base = slugify(state.currentRecord.name);
  if (format === "png") {
    const a = document.createElement("a");
    a.href = state.currentDataUrl;
    a.download = `${base}.png`;
    a.click();
  } else {
    downloadBlob(new Blob([state.currentSvg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
  }
}

function printRecords(records) {
  if (!records.length) {
    showToast("Generate or select at least one QR code to print.", "error");
    return;
  }

  const cards = records.map(record => `
    <article class="print-card">
      <h2>${escapeHtml(record.name)}</h2>
      ${record.subtitle ? `<p class="subtitle">${escapeHtml(record.subtitle)}</p>` : ""}
      <img alt="QR code" src="${record.dataUrl}" />
      <p class="scan">Scan to open</p>
      <p class="url">${escapeHtml(record.url)}</p>
      ${record.footer ? `<p class="footer">${escapeHtml(record.footer)}</p>` : ""}
    </article>
  `).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Your browser blocked the print window. Allow pop-ups for this app and try again.", "error");
    return;
  }
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR Code Print Sheet</title>
    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; color: #16191d; }
      .sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10mm; }
      .print-card { border: 1px solid #ddd; border-radius: 8px; padding: 8mm; text-align: center; break-inside: avoid; overflow-wrap: anywhere; }
      h2 { font-size: 16pt; margin: 0 0 4mm; }
      .subtitle { margin: 0 0 4mm; font-size: 10pt; }
      img { display: block; width: 52mm; height: 52mm; object-fit: contain; margin: 0 auto; }
      .scan { font-weight: bold; margin: 3mm 0 1mm; }
      .url { font-size: 7pt; color: #444; }
      .footer { border-top: 2px solid #f15a24; padding-top: 3mm; font-size: 8pt; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body><main class="sheet">${cards}</main>
    <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script></body></html>`);
  printWindow.document.close();
}

function renderHistory() {
  const container = $("#historyList");
  const query = $("#historySearch").value.trim().toLowerCase();
  const items = state.history.filter(item =>
    `${item.name} ${item.url} ${item.subtitle || ""}`.toLowerCase().includes(query)
  );

  $("#historyCount").textContent = `${state.history.length} saved`;
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div><strong>${state.history.length ? "No matching QR codes" : "Your QR library is empty"}</strong><p>Generate a code and save it to your local history.</p></div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <article class="history-item" data-id="${escapeHtml(item.id)}">
      <div class="history-thumb"><img alt="" src="${item.thumbnail || ""}" loading="lazy" /></div>
      <div class="history-info">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.url)}</span>
        <small>${new Date(item.updatedAt || item.createdAt).toLocaleString()}</small>
      </div>
      <div class="history-actions">
        <button class="btn btn-small btn-secondary" data-action="load" data-id="${escapeHtml(item.id)}">Open</button>
        <button class="btn btn-small btn-ghost" data-action="delete" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)}">Delete</button>
      </div>
    </article>
  `).join("");

  // Re-create thumbnails on render when missing, while keeping localStorage compact.
  items.forEach(async item => {
    if (item.thumbnail) return;
    try {
      const thumb = await QRCode.toDataURL(item.url, { width: 100, margin: 1, errorCorrectionLevel: item.errorCorrection || "H" });
      const target = $(`.history-item[data-id="${CSS.escape(item.id)}"] .history-thumb img`);
      if (target) target.src = thumb;
      item.thumbnail = thumb;
    } catch { /* ignore malformed legacy record */ }
  });
}

function recordForPrinting(record) {
  return QRCode.toDataURL(record.url, {
    width: 600, margin: 4, errorCorrectionLevel: record.errorCorrection || "H",
    color: { dark: record.color || "#111111", light: record.background || "#ffffff" }
  }).then(dataUrl => ({ ...record, dataUrl }));
}

async function saveCurrent() {
  if (!state.currentRecord || !state.currentDataUrl) {
    showToast("Generate a QR code first.", "error");
    return;
  }
  const record = { ...state.currentRecord, thumbnail: await QRCode.toDataURL(state.currentRecord.url, { width: 120, margin: 1 }) };
  upsertHistory(record);
  showToast("Saved to this browser's history.");
}

async function loadRecord(id) {
  const record = state.history.find(item => item.id === id);
  if (!record) return;
  $("#qrName").value = record.name || "";
  $("#qrUrl").value = record.url || "";
  $("#qrSubtitle").value = record.subtitle || "";
  $("#qrFooter").value = record.footer || "";
  $("#qrColor").value = record.color || "#111111";
  $("#qrBackground").value = record.background || "#ffffff";
  $("#qrErrorCorrection").value = record.errorCorrection || "H";
  setTab("create");
  await renderQr(record);
  showToast("QR code loaded into the editor.");
}

function setTab(tab) {
  state.activeTab = tab;
  $$(".nav-tab").forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$(".tab-panel").forEach(panel => panel.hidden = panel.id !== `tab-${tab}`);
}

function parseCsv(text) {
  // Supports quoted fields and commas/newlines inside quoted cells.
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(v => v.trim())) rows.push(row);
  if (!rows.length) return [];

  const first = rows[0].map(v => v.trim().toLowerCase());
  const hasHeader = first.some(v => ["name", "url", "subtitle", "footer"].includes(v));
  const headers = hasHeader ? first : ["name", "url", "subtitle", "footer"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((cells, index) => {
    const item = {};
    headers.forEach((header, i) => item[header] = (cells[i] || "").trim());
    return {
      name: item.name || `QR_${index + 1}`,
      url: item.url || "",
      subtitle: item.subtitle || "",
      footer: item.footer || "",
    };
  });
}

function downloadBatchTemplate() {
  const csv = "name,url,subtitle,footer\nHQ Incident Report,https://example.com/incident,Report incidents and near misses,SAFETY IN ACTION\nWarehouse Safety,https://example.com/warehouse,Warehouse reporting,";
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "qr-batch-template.csv");
}

function renderBatchPreview(records) {
  $("#batchResults").innerHTML = records.map((record, index) => `
    <article class="batch-item">
      <div class="batch-number">${index + 1}</div>
      <div class="batch-info"><strong>${escapeHtml(record.name)}</strong><span>${escapeHtml(record.url)}</span></div>
      <span class="status ${validUrl(record.url) ? "valid" : "invalid"}">${validUrl(record.url) ? "Ready" : "Invalid URL"}</span>
    </article>
  `).join("");
  $("#batchSummary").textContent = `${records.filter(r => validUrl(r.url)).length} valid of ${records.length} rows`;
  $("#generateBatch").disabled = !records.some(r => validUrl(r.url));
}

async function generateBatch() {
  const valid = state.batchResults.filter(record => validUrl(record.url));
  if (!valid.length) return;
  const generated = [];
  for (const record of valid) {
    const options = { width: 640, margin: 4, errorCorrectionLevel: "H", color: { dark: "#111111", light: "#ffffff" } };
    const dataUrl = await QRCode.toDataURL(record.url, options);
    const svg = await QRCode.toString(record.url, { ...options, type: "svg" });
    generated.push({ ...record, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, dataUrl, svg, createdAt: new Date().toISOString() });
  }
  state.batchResults = generated;
  $("#batchResults").innerHTML = generated.map((record, index) => `
    <article class="batch-item batch-ready">
      <div class="batch-number">${index + 1}</div>
      <img class="batch-qr" src="${record.dataUrl}" alt="QR code for ${escapeHtml(record.name)}" />
      <div class="batch-info"><strong>${escapeHtml(record.name)}</strong><span>${escapeHtml(record.url)}</span></div>
      <button class="btn btn-small btn-secondary" data-batch-download="${index}">PNG</button>
    </article>
  `).join("");
  $("#batchSummary").textContent = `${generated.length} QR code(s) generated`;
  $("#downloadBatchZip").disabled = false;
  $("#printBatch").disabled = false;
  $("#generateBatch").disabled = false;
  showToast(`Generated ${generated.length} QR code(s).`);
}

function downloadBatchFiles() {
  // No ZIP library is required: save individual PNG/SVG files from the results.
  // A ZIP is intentionally not simulated; users can download each item separately.
  showToast("Use the PNG/SVG buttons on each result to download files individually.", "error");
}

function exportHistory() {
  const data = state.history.map(({ thumbnail, ...record }) => record);
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "qr-code-studio-history.json");
}

function importHistoryFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported)) throw new Error("Expected an array");
      const clean = imported.filter(item => item && item.name && validUrl(item.url)).map(item => ({
        id: item.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
        name: String(item.name), url: String(item.url), subtitle: String(item.subtitle || ""),
        footer: String(item.footer || ""), color: item.color || "#111111",
        background: item.background || "#ffffff", errorCorrection: item.errorCorrection || "H",
        createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
      }));
      const map = new Map([...clean, ...state.history].map(item => [`${item.name}|${item.url}`, item]));
      state.history = [...map.values()].slice(0, 250);
      saveHistory();
      renderHistory();
      showToast(`Imported ${clean.length} valid QR record(s).`);
    } catch {
      showToast("Could not import this file. Choose a QR Code Studio JSON export.", "error");
    }
  };
  reader.readAsText(file);
}

function init() {
  $("#app").innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">QR</div>
          <div><strong>QR Code Studio</strong><span>LOCAL-FIRST GENERATOR</span></div>
        </div>
        <div class="sidebar-label">WORKSPACE</div>
        <nav class="nav-tabs" role="tablist" aria-label="Main sections">
          <button class="nav-tab active" data-tab="create" role="tab" aria-selected="true"><span>＋</span> Create QR code</button>
          <button class="nav-tab" data-tab="batch" role="tab" aria-selected="false"><span>▦</span> Batch generator</button>
          <button class="nav-tab" data-tab="history" role="tab" aria-selected="false"><span>◷</span> Saved library <span class="nav-count" id="sidebarCount">0</span></button>
        </nav>
        <div class="sidebar-bottom">
          <div class="local-badge"><span></span><div><strong>Local-first privacy</strong><small>QR generation happens in your browser.</small></div></div>
          <p>Static QR codes encode their destination directly. They do not need a QR subscription.</p>
          <span class="version">QR CODE STUDIO · 1.0.0</span>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div><div class="eyebrow">QR WORKSPACE</div><h1 id="pageTitle">Create a QR code</h1></div>
          <div class="top-actions"><span class="online-chip"><i></i> Ready to generate</span></div>
        </header>

        <section class="tab-panel" id="tab-create">
          <div class="intro"><h2>Turn any URL into a scannable code.</h2><p>Add a destination, customise the label, then download or print.</p></div>
          <div class="create-grid">
            <section class="panel editor-panel">
              <div class="panel-heading"><div><span class="step">01</span><h3>Destination & label</h3></div><span class="required-note">URL required</span></div>
              <form id="qrForm">
                <label for="qrName">QR code name <span>Required for file naming</span></label>
                <input id="qrName" value="HQ Incident Report" maxlength="100" placeholder="e.g. HQ Incident Report" required />
                <label for="qrUrl">Destination URL <span>Use the full link</span></label>
                <input id="qrUrl" type="url" value="https://docs.google.com/forms/d/e/1FAIpQLScUoxfo-xoAIc950cezs8iqc7t6tn7RiPm4ZbDcnr1ywGzXTA/viewform?usp=dialog" placeholder="https://example.com/form" required />
                <div class="field-hint">The link is encoded directly into the QR code. Keep the destination active.</div>
                <div class="field-row">
                  <div class="field-grow"><label for="qrSubtitle">Poster subtitle <span>Optional</span></label><input id="qrSubtitle" value="Scan to report an incident at HQ" maxlength="120" placeholder="Scan to open the form" /></div>
                  <div class="field-grow"><label for="qrFooter">Footer text <span>Optional</span></label><input id="qrFooter" value="SAFER PEOPLE | SAFER OPERATIONS" maxlength="120" placeholder="Company name or safety slogan" /></div>
                </div>
                <div class="field-row color-row">
                  <div class="field-grow"><label for="qrColor">QR foreground</label><div class="color-input"><input id="qrColor" type="color" value="#111111" /><span>Code colour</span></div></div>
                  <div class="field-grow"><label for="qrBackground">QR background</label><div class="color-input"><input id="qrBackground" type="color" value="#ffffff" /><span>Background colour</span></div></div>
                  <div class="field-grow"><label for="qrErrorCorrection">Error correction</label><select id="qrErrorCorrection"><option value="H" selected>High</option><option value="Q">Quartile</option><option value="M">Medium</option><option value="L">Low</option></select></div>
                </div>
                <button class="btn btn-primary btn-full" type="submit"><span>✦</span> Generate QR code</button>
              </form>
              <div class="form-bottom"><span>✓ No account required</span><span>✓ No QR expiry date</span><span>✓ Works offline after app files load</span></div>
            </section>

            <section class="panel preview-panel">
              <div class="panel-heading"><div><span class="step">02</span><h3>Live preview</h3></div><span class="preview-tag">PREVIEW</span></div>
              <div id="previewEmpty" class="empty-state"><div class="empty-icon">▦</div><strong>Your QR code will appear here</strong><p>Generate a code to preview the design.</p></div>
              <div id="previewCard" class="preview-card" hidden>
                <div class="preview-label">QR CODE</div>
                <h2 id="previewName"></h2>
                <p id="previewSubtitle"></p>
                <div class="qr-frame"><img id="previewQr" alt="Generated QR code preview" /></div>
                <div class="scan-label">SCAN TO OPEN</div>
                <p id="previewFooter" class="preview-footer"></p>
                <div id="scanAssessment" class="scan-assessment" role="status" aria-live="polite" hidden></div>
              </div>
              <div class="download-actions">
                <button class="btn btn-secondary" id="downloadPng" disabled>↓ PNG</button>
                <button class="btn btn-secondary" id="downloadSvg" disabled>↗ SVG</button>
                <button class="btn btn-ghost" id="saveCurrent" disabled>♡ Save</button>
              </div>
              <button class="btn btn-outline btn-full" id="printCurrent" disabled>▤ Create print sheet</button>
              <p class="small-note">SVG is best for large-format printing. Always scan-test before distributing.</p>
            </section>
          </div>
        </section>

        <section class="tab-panel" id="tab-batch" hidden>
          <div class="intro"><h2>Generate many QR codes at once.</h2><p>Import a CSV file with one destination per row, then download or print the results.</p></div>
          <div class="panel batch-panel">
            <div class="panel-heading"><div><span class="step">01</span><h3>Import URL list</h3></div><button class="btn btn-secondary btn-small" id="downloadTemplate">↓ Download CSV template</button></div>
            <div class="upload-zone" id="dropZone">
              <div class="upload-icon">↑</div><strong>Choose a CSV file</strong><p>Recommended columns: <code>name,url,subtitle,footer</code></p>
              <input type="file" id="csvFile" accept=".csv,text/csv" />
              <label for="csvFile" class="btn btn-outline">Browse files</label>
              <span class="small-note">Your CSV is processed in this browser; it is not uploaded to a server.</span>
            </div>
            <div class="batch-toolbar"><div><h3>Import preview</h3><p id="batchSummary">No CSV imported yet</p></div><div class="button-row"><button class="btn btn-primary" id="generateBatch" disabled>Generate all</button><button class="btn btn-secondary" id="printBatch" disabled>Print all</button></div></div>
            <div id="batchResults" class="batch-results"><div class="empty-state compact"><strong>No batch loaded</strong><p>Download the CSV template to see the format.</p></div></div>
          </div>
        </section>

        <section class="tab-panel" id="tab-history" hidden>
          <div class="intro"><h2>Your saved QR library.</h2><p>History is stored in this browser on this device, not in a cloud database.</p></div>
          <div class="panel history-panel">
            <div class="history-toolbar"><div><h3>Saved QR codes <span id="historyCount" class="count-pill">0 saved</span></h3><p>Up to 250 entries per browser profile.</p></div><div class="button-row"><button class="btn btn-secondary btn-small" id="exportHistory">Export JSON</button><label class="btn btn-secondary btn-small import-label">Import JSON<input type="file" id="importHistory" accept=".json,application/json" hidden /></label><button class="btn btn-ghost btn-small" id="clearHistory">Clear history</button></div></div>
            <div class="search-box"><span>⌕</span><input id="historySearch" placeholder="Search by name or URL..." /></div>
            <div id="historyList"></div>
          </div>
        </section>

        <footer class="app-footer"><span>QR CODE STUDIO · BRIGHT_ARM ENTERPRISE</span><span>Static QR codes · Local-first · No database required</span></footer>
      </main>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </div>
  `;

  $("#qrForm").addEventListener("submit", async event => {
    event.preventDefault();
    const record = getFormRecord();
    if (await renderQr(record)) {
      $("#saveCurrent").disabled = false;
      showToast("QR code generated successfully.");
    }
  });
  $("#downloadPng").addEventListener("click", () => downloadCurrent("png"));
  $("#downloadSvg").addEventListener("click", () => downloadCurrent("svg"));
  $("#saveCurrent").addEventListener("click", saveCurrent);
  $("#printCurrent").addEventListener("click", async () => {
    if (!state.currentRecord) return;
    printRecords([await recordForPrinting(state.currentRecord)]);
  });
  $$(".nav-tab").forEach(button => button.addEventListener("click", () => {
    setTab(button.dataset.tab);
    $("#pageTitle").textContent = ({ create: "Create a QR code", batch: "Batch generator", history: "Saved QR library" })[button.dataset.tab];
  }));

  $("#downloadTemplate").addEventListener("click", downloadBatchTemplate);
  $("#csvFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state.batchResults = parseCsv(await file.text());
      renderBatchPreview(state.batchResults);
      showToast(`Loaded ${state.batchResults.length} row(s) from CSV.`);
    } catch (error) {
      console.error(error);
      showToast("Could not read that CSV file.", "error");
    }
    event.target.value = "";
  });
  $("#generateBatch").addEventListener("click", generateBatch);
  $("#batchResults").addEventListener("click", event => {
    const button = event.target.closest("[data-batch-download]");
    if (!button) return;
    const record = state.batchResults[Number(button.dataset.batchDownload)];
    if (!record?.dataUrl) return;
    const a = document.createElement("a");
    a.href = record.dataUrl;
    a.download = `${slugify(record.name)}.png`;
    a.click();
  });
  $("#printBatch").addEventListener("click", async () => {
    const records = state.batchResults.filter(r => r.dataUrl);
    printRecords(records);
  });
  $("#historySearch").addEventListener("input", renderHistory);
  $("#historyList").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "load") loadRecord(id);
    if (button.dataset.action === "delete") {
      state.history = state.history.filter(item => item.id !== id);
      saveHistory(); renderHistory();
      showToast("Removed from local history.");
    }
  });
  $("#exportHistory").addEventListener("click", exportHistory);
  $("#importHistory").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) importHistoryFile(file);
    event.target.value = "";
  });
  $("#clearHistory").addEventListener("click", () => {
    if (!state.history.length) return showToast("History is already empty.", "error");
    if (!confirm("Clear all saved QR codes from this browser? Export JSON first if you need a backup.")) return;
    state.history = [];
    saveHistory(); renderHistory();
    showToast("Local history cleared.");
  });

  const dropZone = $("#dropZone");
  ["dragenter", "dragover"].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault(); dropZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault(); dropZone.classList.remove("dragging");
  }));
  dropZone.addEventListener("drop", async event => {
    const file = [...(event.dataTransfer?.files || [])].find(item => item.name.toLowerCase().endsWith(".csv"));
    if (!file) return showToast("Drop a CSV file to import a batch.", "error");
    state.batchResults = parseCsv(await file.text());
    renderBatchPreview(state.batchResults);
    showToast(`Loaded ${state.batchResults.length} row(s) from CSV.`);
  });

  renderHistory();
  $("#sidebarCount").textContent = state.history.length;
  const initialRecord = getFormRecord();
  renderQr(initialRecord).then(ok => {
    if (ok) {
      $("#saveCurrent").disabled = false;
      $("#printCurrent").disabled = false;
    }
  });
  // Keep sidebar count current when history is re-rendered.
  const originalRenderHistory = renderHistory;
  renderHistory = function() {
    originalRenderHistory();
    const count = $("#sidebarCount");
    if (count) count.textContent = state.history.length;
  };
}

init();
