"use strict";

const DATA_URL = "data/dzikir.json";
const SUPPORT_URL = "https://deenarea.id/";
const PROGRESS_KEY = "deen-pocket-pagi-petang-progress";

const SESSION_CONFIG = {
  pagi: {
    title: "Dzikir Pagi",
    lowerTitle: "dzikir pagi",
    storageKey: "morning",
    orderKey: "morningOrder",
    intro: "Mulai hari dengan berdzikir kepada Allah. Ikuti bacaan satu per satu, pelan-pelan.",
    introShort: "Ikuti bacaan satu per satu. Tidak perlu terburu-buru.",
    startLabel: "Mulai Dzikir Pagi",
    continueLabel: "Lanjutkan Dzikir Pagi",
    completeTitle: "Dzikir pagi selesai hari ini.",
    completeCopy: "Semoga Allah menjaga kita di hari ini.",
  },
  petang: {
    title: "Dzikir Petang",
    lowerTitle: "dzikir petang",
    storageKey: "evening",
    orderKey: "eveningOrder",
    intro: "Tutup hari dengan dzikir dan perlindungan kepada Allah. Ikuti bacaan satu per satu, pelan-pelan.",
    introShort: "Ikuti bacaan satu per satu. Semoga Allah menjaga kita hingga pagi.",
    startLabel: "Mulai Dzikir Petang",
    continueLabel: "Lanjutkan Dzikir Petang",
    completeTitle: "Dzikir petang selesai hari ini.",
    completeCopy: "Semoga Allah menjaga kita hingga pagi.",
  },
};

const app = document.querySelector("#app");
const runtime = {
  items: [],
  isReady: false,
  error: "",
  modal: null,
  lastRouteKey: "",
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  app.addEventListener("click", handleClick);
  window.addEventListener("hashchange", render);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && runtime.modal) {
      runtime.modal = null;
      render();
    }
  });

  renderLoading();
  loadData();
  registerServiceWorker();
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Gagal memuat data dzikir (${response.status})`);
    }
    runtime.items = await response.json();
    runtime.isReady = true;
    render();
  } catch (error) {
    runtime.error = error.message || "Gagal memuat data dzikir.";
    render();
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // App remains usable online when service worker registration is unavailable.
    });
  });
}

function renderLoading() {
  app.innerHTML = layout(`<div class="loading-state">Memuat dzikir...</div>`);
}

function render() {
  if (runtime.error) {
    app.innerHTML = layout(`<div class="error-state">${escapeHtml(runtime.error)}</div>`);
    return;
  }

  if (!runtime.isReady) {
    renderLoading();
    return;
  }

  const route = parseRoute();
  const routeKey = JSON.stringify(route);
  let body = "";

  if (route.screen === "intro") {
    body = renderIntro(route.session);
  } else if (route.screen === "practice") {
    body = renderPractice(route.session, route.index);
  } else if (route.screen === "list") {
    body = renderList(route.filter);
  } else if (route.screen === "about") {
    body = renderAbout();
  } else if (route.screen === "complete") {
    body = renderComplete(route.session);
  } else {
    body = renderHome();
  }

  app.innerHTML = layout(body, renderModal());
  if (runtime.lastRouteKey !== routeKey) {
    window.scrollTo(0, 0);
    runtime.lastRouteKey = routeKey;
  }
}

function layout(content, modal = "") {
  return `
    <div class="app-shell">
      <header class="app-header">
        <img class="app-mark" src="icons/icon-192.png" width="44" height="44" alt="">
        <div>
          <p class="brand-title">Deen Pocket<span class="brand-subtitle">Dzikir Pagi & Petang</span></p>
        </div>
      </header>
      <main>${content}</main>
    </div>
    ${modal}
  `;
}

function parseRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  const screen = parts[0] || "home";

  if (screen === "intro" && isSession(parts[1])) {
    return { screen, session: parts[1] };
  }

  if (screen === "practice" && isSession(parts[1])) {
    return {
      screen,
      session: parts[1],
      index: Math.max(0, Number.parseInt(parts[2] || "0", 10) || 0),
    };
  }

  if (screen === "list") {
    const filter = ["all", "pagi", "petang"].includes(parts[1]) ? parts[1] : "all";
    return { screen, filter };
  }

  if (screen === "about") {
    return { screen };
  }

  if (screen === "complete" && isSession(parts[1])) {
    return { screen, session: parts[1] };
  }

  return { screen: "home" };
}

function navigate(fragment = "") {
  const nextHash = fragment ? `#/${fragment}` : "#/";
  if (window.location.hash === nextHash) {
    render();
    return;
  }
  window.location.hash = nextHash;
}

function renderHome() {
  return `
    <section class="screen">
      <div class="hero">
        <p class="eyebrow">Deen Pocket</p>
        <h1>Dzikir Pagi & Petang</h1>
        <p class="lead">Buka pagi. Buka petang. Amalkan pelan-pelan.</p>
      </div>
      <div class="stack">
        ${renderSessionCard("pagi")}
        ${renderSessionCard("petang")}
      </div>
      <div class="nav-grid">
        <button class="button secondary" type="button" data-action="show-list">Lihat Semua Dzikir</button>
        <button class="button secondary" type="button" data-action="show-about">Tentang & Rujukan</button>
      </div>
    </section>
  `;
}

function renderSessionCard(session) {
  const cfg = SESSION_CONFIG[session];
  const status = getSessionStatus(session);
  const progress = getProgress()[cfg.storageKey];

  let actions = "";
  if (progress.completed) {
    actions = `<button class="button" type="button" data-action="restart-session" data-session="${session}">Baca Lagi</button>`;
  } else if (status.kind === "resume") {
    actions = `
      <div class="split-actions">
        <button class="button" type="button" data-action="continue-session" data-session="${session}">${cfg.continueLabel}</button>
        <button class="button secondary" type="button" data-action="restart-session" data-session="${session}">Mulai dari Awal</button>
      </div>
    `;
  } else {
    actions = `<button class="button" type="button" data-action="show-intro" data-session="${session}">${cfg.startLabel}</button>`;
  }

  return `
    <article class="card session-card">
      <div>
        <h2>${cfg.title}</h2>
        <p class="muted">${session === "pagi" ? "Mulai hari dengan mengingat Allah." : "Tutup hari dengan dzikir dan perlindungan kepada Allah."}</p>
      </div>
      <div class="chip-row">
        <span class="chip ${status.kind === "completed" ? "accent" : ""}">${escapeHtml(status.text)}</span>
      </div>
      ${actions}
    </article>
  `;
}

function renderIntro(session) {
  const cfg = SESSION_CONFIG[session];
  const status = getSessionStatus(session);

  let actions = "";
  if (status.kind === "resume") {
    actions = `
      <article class="card notice-card">
        <p>Ada ${cfg.lowerTitle} yang belum selesai.</p>
      </article>
      <div class="split-actions">
        <button class="button" type="button" data-action="continue-session" data-session="${session}">Lanjutkan</button>
        <button class="button secondary" type="button" data-action="restart-session" data-session="${session}">Mulai dari Awal</button>
      </div>
    `;
  } else if (status.kind === "completed") {
    actions = `
      <article class="card notice-card">
        <p>${cfg.title} selesai hari ini.</p>
      </article>
      <div class="split-actions">
        <button class="button" type="button" data-action="restart-session" data-session="${session}">Baca Lagi</button>
        <button class="button secondary" type="button" data-action="go-home">Kembali ke Awal</button>
      </div>
    `;
  } else {
    actions = `<button class="button" type="button" data-action="start-session" data-session="${session}">${cfg.startLabel}</button>`;
  }

  return `
    <section class="screen">
      <div class="topbar">
        <button class="button ghost small" type="button" data-action="go-home">Kembali</button>
      </div>
      <div class="hero">
        <p class="eyebrow">${cfg.title}</p>
        <h1>${cfg.title}</h1>
        <p class="lead">${escapeHtml(cfg.introShort)}</p>
      </div>
      <article class="card content-card">
        <p>${escapeHtml(cfg.intro)}</p>
      </article>
      ${actions}
    </section>
  `;
}

function renderPractice(session, index) {
  const items = getSessionItems(session);
  const safeIndex = Math.min(Math.max(index, 0), Math.max(items.length - 1, 0));
  const item = items[safeIndex];

  if (!item) {
    return `
      <section class="screen">
        <button class="button ghost small" type="button" data-action="go-home">Kembali</button>
        <div class="empty-state">Belum ada data dzikir untuk sesi ini.</div>
      </section>
    `;
  }

  syncPracticeProgress(session, safeIndex, item);
  const cfg = SESSION_CONFIG[session];
  const progress = getProgress()[cfg.storageKey];
  const countValue = clamp(progress.currentCounter, 0, item.count || 1);
  const hasInfo = Boolean(item.source || item.description || item.note);
  const previousButton =
    safeIndex > 0
      ? `<button class="button secondary" type="button" data-action="previous-item">Sebelumnya</button>`
      : "";
  const actionClass = previousButton ? "practice-actions has-previous" : "practice-actions";

  return `
    <section class="screen">
      <div class="topbar">
        <button class="button ghost small" type="button" data-action="show-intro" data-session="${session}">Kembali</button>
        <span class="topbar-title">${cfg.title}</span>
        <span class="topbar-meta">${safeIndex + 1} / ${items.length}</span>
      </div>

      <article class="card practice-card">
        <div class="dzikir-heading">
          <h2 class="dzikir-title">${escapeHtml(item.title)}</h2>
          <div class="chip-row">
            <span class="chip">Dibaca: ${formatCount(item.count)}</span>
          </div>
        </div>

        <div class="arabic" dir="rtl">${escapeHtml(item.arabic)}</div>
        ${item.latin ? `<div class="latin">${escapeHtml(item.latin)}</div>` : ""}
        ${item.translation ? `<div class="translation">${escapeHtml(item.translation)}</div>` : ""}

        <div class="count-label">
          <span>Jumlah bacaan</span>
          <span>${formatCount(item.count)}</span>
        </div>

        ${item.type === "counter" ? renderCounter(item, countValue) : ""}

        <div class="${actionClass}">
          ${previousButton}
          <button class="button" type="button" data-action="next-item">Lanjut</button>
        </div>
        ${hasInfo ? `<button class="secondary-link" type="button" data-action="show-info" data-item-id="${escapeHtml(item.id)}">Lihat keterangan</button>` : ""}
      </article>
    </section>
  `;
}

function renderCounter(item, currentCounter) {
  const count = item.count || 1;
  const isDone = currentCounter >= count;
  const done = isDone ? `<div class="done-state">Selesai dibaca</div>` : "";

  if (count >= 100) {
    return `
      <div class="counter-box large-counter">
        <p class="tap-hint">Tap area besar untuk menghitung</p>
        <button class="large-count-button" type="button" data-action="change-counter" data-step="1">
          ${currentCounter} / ${count}
          <span>+1</span>
        </button>
        <div class="large-counter-actions">
          <button class="counter-button" type="button" data-action="change-counter" data-step="-1">-1</button>
          <button class="counter-button" type="button" data-action="change-counter" data-step="1">+1</button>
          <button class="counter-button" type="button" data-action="change-counter" data-step="10">+10</button>
        </div>
        ${done}
      </div>
    `;
  }

  return `
    <div class="counter-box">
      <div class="counter-controls">
        <button class="counter-button" type="button" data-action="change-counter" data-step="-1">-</button>
        <div class="counter-value">${currentCounter} / ${count}</div>
        <button class="counter-button" type="button" data-action="change-counter" data-step="1">+</button>
      </div>
      ${done}
    </div>
  `;
}

function renderList(filter) {
  const activeFilter = filter || "all";
  const items =
    activeFilter === "pagi" || activeFilter === "petang"
      ? getSessionItems(activeFilter)
      : [...runtime.items].sort((a, b) => (a.sourceRow || 0) - (b.sourceRow || 0));

  const itemCards = items
    .map((item) => renderListItem(item, activeFilter))
    .join("");

  return `
    <section class="screen">
      <div class="topbar">
        <button class="button ghost small" type="button" data-action="go-home">Kembali</button>
      </div>
      <div class="hero">
        <p class="eyebrow">Daftar</p>
        <h1>Semua Dzikir</h1>
      </div>
      <div class="filter-tabs" role="tablist" aria-label="Filter dzikir">
        ${renderFilterButton("all", "Semua", activeFilter)}
        ${renderFilterButton("pagi", "Pagi", activeFilter)}
        ${renderFilterButton("petang", "Petang", activeFilter)}
      </div>
      <div class="stack">
        ${itemCards || `<div class="empty-state">Belum ada dzikir pada filter ini.</div>`}
      </div>
    </section>
  `;
}

function renderFilterButton(value, label, activeFilter) {
  const active = activeFilter === value ? " active" : "";
  return `<button class="tab-button${active}" type="button" data-action="set-filter" data-filter="${value}">${label}</button>`;
}

function renderListItem(item, filter) {
  const canOpenDirectly = filter === "pagi" || filter === "petang" || item.sessions.length === 1;
  const session = filter === "pagi" || filter === "petang" ? filter : item.sessions[0];
  const action = canOpenDirectly ? "open-list-item" : "choose-list-session";
  const order =
    filter === "pagi" || filter === "petang"
      ? `${getOrder(item, filter)}. `
      : "";
  const sessionText =
    item.sessions.length === 2 ? "Pagi & Petang" : item.sessions[0] === "pagi" ? "Pagi" : "Petang";
  const meta =
    filter === "pagi" || filter === "petang"
      ? `${formatCount(item.count)}`
      : `${sessionText} · ${formatCount(item.count)}`;

  return `
    <button
      class="card list-card"
      type="button"
      data-action="${action}"
      data-item-id="${escapeHtml(item.id)}"
      data-session="${session}"
    >
      <span class="list-card-title">${order}${escapeHtml(item.title)}</span>
      <span class="list-card-meta">${escapeHtml(meta)}</span>
    </button>
  `;
}

function renderComplete(session) {
  const cfg = SESSION_CONFIG[session];
  return `
    <section class="screen">
      <article class="card content-card">
        <p class="eyebrow">Alhamdulillah.</p>
        <h1>${cfg.completeTitle}</h1>
        <p class="lead">${cfg.completeCopy}</p>
      </article>

      <div class="split-actions">
        <button class="button" type="button" data-action="restart-session" data-session="${session}">Ulangi ${cfg.title}</button>
        <button class="button secondary" type="button" data-action="go-home">Kembali ke Awal</button>
      </div>

      ${renderSupportCard()}
    </section>
  `;
}

function renderAbout() {
  return `
    <section class="screen">
      <div class="topbar">
        <button class="button ghost small" type="button" data-action="go-home">Kembali</button>
      </div>
      <article class="card content-card about-copy">
        <p class="eyebrow">Tentang</p>
        <h1>Tentang Deen Pocket</h1>
        <p>Deen Pocket adalah alat bantu amalan harian dari Deen Area.</p>
        <p>Aplikasi kecil ini dibuat agar dzikir pagi dan petang lebih mudah dibaca, diikuti, dan diamalkan.</p>
      </article>
      <article class="card content-card about-copy">
        <h2>Catatan</h2>
        <p>Konten dzikir disusun berdasarkan rujukan yang dipilih oleh tim Deen Area. Untuk penjelasan fikih yang lebih lengkap, silakan merujuk kepada guru atau ustadz terpercaya.</p>
      </article>
      ${renderSupportCard()}
    </section>
  `;
}

function renderSupportCard() {
  return `
    <article class="card support-card">
      <p>Jika aplikasi kecil ini bermanfaat, Anda bisa mendukung Deen Area agar kami bisa membuat alat bantu amalan lainnya.</p>
      <button class="button terracotta" type="button" data-action="support">Dukung Deen Area</button>
    </article>
  `;
}

function renderModal() {
  if (!runtime.modal) return "";

  if (runtime.modal.type === "info") {
    const item = runtime.items.find((entry) => entry.id === runtime.modal.itemId);
    if (!item) return "";
    const sections = [
      ["Sumber", item.source],
      ["Keterangan", item.description],
      ["Catatan", item.note],
    ]
      .filter(([, value]) => Boolean(value))
      .map(
        ([label, value]) => `
          <section class="modal-section">
            <h3>${label}</h3>
            <p class="reference-text">${escapeHtml(value)}</p>
          </section>
        `,
      )
      .join("");

    return modalShell(`
      <h2>Keterangan</h2>
      ${sections || `<p class="muted">Tidak ada keterangan tambahan.</p>`}
      <button class="button secondary" type="button" data-action="close-modal">Tutup</button>
    `);
  }

  if (runtime.modal.type === "skip") {
    return modalShell(`
      <h2>Hitungan belum selesai.</h2>
      <p class="muted">Tetap lanjut?</p>
      <div class="split-actions">
        <button class="button" type="button" data-action="confirm-skip">Tetap lanjut</button>
        <button class="button secondary" type="button" data-action="close-modal">Kembali</button>
      </div>
    `);
  }

  if (runtime.modal.type === "session-choice") {
    const item = runtime.items.find((entry) => entry.id === runtime.modal.itemId);
    return modalShell(`
      <h2>${escapeHtml(item ? item.title : "Pilih sesi")}</h2>
      <p class="muted">Buka dzikir ini di sesi mana?</p>
      <div class="split-actions">
        <button class="button" type="button" data-action="choose-session" data-session="pagi" data-item-id="${escapeHtml(runtime.modal.itemId)}">Buka di Dzikir Pagi</button>
        <button class="button secondary" type="button" data-action="choose-session" data-session="petang" data-item-id="${escapeHtml(runtime.modal.itemId)}">Buka di Dzikir Petang</button>
      </div>
      <button class="secondary-link" type="button" data-action="close-modal">Tutup</button>
    `);
  }

  if (runtime.modal.type === "support") {
    return modalShell(`
      <h2>Link dukungan belum diatur.</h2>
      <p class="muted">Ganti SUPPORT_URL di app.js dengan link dukungan Deen Area.</p>
      <button class="button secondary" type="button" data-action="close-modal">Tutup</button>
    `);
  }

  return "";
}

function modalShell(content) {
  return `
    <div class="modal-layer" role="dialog" aria-modal="true">
      <div class="modal-card">
        <div class="modal-body">
          ${content}
        </div>
      </div>
    </div>
  `;
}

function handleClick(event) {
  const control = event.target.closest("[data-action]");
  if (!control) return;

  const action = control.dataset.action;
  const session = control.dataset.session;
  const itemId = control.dataset.itemId;
  const filter = control.dataset.filter;

  event.preventDefault();

  if (action === "go-home") {
    runtime.modal = null;
    navigate("");
    return;
  }

  if (action === "show-intro" && isSession(session)) {
    runtime.modal = null;
    navigate(`intro/${session}`);
    return;
  }

  if (action === "show-list") {
    runtime.modal = null;
    navigate("list/all");
    return;
  }

  if (action === "show-about") {
    runtime.modal = null;
    navigate("about");
    return;
  }

  if (action === "start-session" && isSession(session)) {
    beginSession(session);
    return;
  }

  if (action === "continue-session" && isSession(session)) {
    continueSession(session);
    return;
  }

  if (action === "restart-session" && isSession(session)) {
    beginSession(session, true);
    return;
  }

  if (action === "change-counter") {
    changeCounter(Number.parseInt(control.dataset.step || "0", 10));
    return;
  }

  if (action === "next-item") {
    requestNextItem();
    return;
  }

  if (action === "previous-item") {
    previousItem();
    return;
  }

  if (action === "confirm-skip") {
    runtime.modal = null;
    advanceItem();
    return;
  }

  if (action === "show-info" && itemId) {
    runtime.modal = { type: "info", itemId };
    render();
    return;
  }

  if (action === "set-filter" && filter) {
    runtime.modal = null;
    navigate(`list/${filter}`);
    return;
  }

  if (action === "open-list-item" && itemId && isSession(session)) {
    openItemInSession(itemId, session);
    return;
  }

  if (action === "choose-list-session" && itemId) {
    runtime.modal = { type: "session-choice", itemId };
    render();
    return;
  }

  if (action === "choose-session" && itemId && isSession(session)) {
    openItemInSession(itemId, session);
    return;
  }

  if (action === "support") {
    openSupport();
    return;
  }

  if (action === "close-modal") {
    runtime.modal = null;
    render();
  }
}

function beginSession(session, restart = false) {
  if (restart) resetSession(session);
  const cfg = SESSION_CONFIG[session];
  const progress = getProgress();
  progress[cfg.storageKey] = {
    currentIndex: 0,
    currentCounter: 0,
    completed: false,
    started: true,
  };
  saveProgress(progress);
  runtime.modal = null;
  navigate(`practice/${session}/0`);
}

function continueSession(session) {
  const cfg = SESSION_CONFIG[session];
  const items = getSessionItems(session);
  const progress = getProgress();
  const saved = progress[cfg.storageKey];
  const index = clamp(saved.currentIndex || 0, 0, Math.max(items.length - 1, 0));
  saved.started = true;
  saved.completed = false;
  progress[cfg.storageKey] = saved;
  saveProgress(progress);
  runtime.modal = null;
  navigate(`practice/${session}/${index}`);
}

function resetSession(session) {
  const cfg = SESSION_CONFIG[session];
  const progress = getProgress();
  progress[cfg.storageKey] = defaultSessionProgress();
  saveProgress(progress);
}

function syncPracticeProgress(session, index, item) {
  const cfg = SESSION_CONFIG[session];
  const progress = getProgress();
  const saved = progress[cfg.storageKey];
  const next = { ...saved };

  if (!next.started || next.currentIndex !== index) {
    next.currentIndex = index;
    next.currentCounter = 0;
    next.completed = false;
    next.started = true;
  }

  if (item.type !== "counter") {
    next.currentCounter = 0;
  } else {
    next.currentCounter = clamp(next.currentCounter || 0, 0, item.count || 1);
  }

  progress[cfg.storageKey] = next;
  saveProgress(progress);
}

function requestNextItem() {
  const route = parseRoute();
  if (route.screen !== "practice") return;

  const item = getSessionItems(route.session)[route.index];
  const cfg = SESSION_CONFIG[route.session];
  const progress = getProgress()[cfg.storageKey];

  if (item && item.type === "counter" && progress.currentCounter < item.count) {
    runtime.modal = { type: "skip" };
    render();
    return;
  }

  advanceItem();
}

function previousItem() {
  const route = parseRoute();
  if (route.screen !== "practice" || route.index <= 0) return;

  runtime.modal = null;
  navigate(`practice/${route.session}/${route.index - 1}`);
}

function advanceItem() {
  const route = parseRoute();
  if (route.screen !== "practice") return;

  const items = getSessionItems(route.session);
  const item = items[route.index];
  const cfg = SESSION_CONFIG[route.session];
  const progress = getProgress();

  if (route.index >= items.length - 1) {
    progress[cfg.storageKey] = {
      currentIndex: route.index,
      currentCounter: item && item.type === "counter" ? item.count : 0,
      completed: true,
      started: true,
    };
    saveProgress(progress);
    navigate(`complete/${route.session}`);
    return;
  }

  const nextIndex = route.index + 1;
  progress[cfg.storageKey] = {
    currentIndex: nextIndex,
    currentCounter: 0,
    completed: false,
    started: true,
  };
  saveProgress(progress);
  navigate(`practice/${route.session}/${nextIndex}`);
}

function changeCounter(step) {
  const route = parseRoute();
  if (route.screen !== "practice") return;

  const item = getSessionItems(route.session)[route.index];
  if (!item || item.type !== "counter") return;

  const cfg = SESSION_CONFIG[route.session];
  const progress = getProgress();
  const sessionProgress = progress[cfg.storageKey];
  sessionProgress.currentCounter = clamp((sessionProgress.currentCounter || 0) + step, 0, item.count || 1);
  sessionProgress.currentIndex = route.index;
  sessionProgress.started = true;
  sessionProgress.completed = false;
  progress[cfg.storageKey] = sessionProgress;
  saveProgress(progress);
  render();
}

function openItemInSession(itemId, session) {
  const items = getSessionItems(session);
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) return;

  const cfg = SESSION_CONFIG[session];
  const progress = getProgress();
  progress[cfg.storageKey] = {
    currentIndex: index,
    currentCounter: 0,
    completed: false,
    started: true,
  };
  saveProgress(progress);
  runtime.modal = null;
  navigate(`practice/${session}/${index}`);
}

function openSupport() {
  if (!SUPPORT_URL || SUPPORT_URL.startsWith("TODO_")) {
    runtime.modal = { type: "support" };
    render();
    return;
  }
  window.open(SUPPORT_URL, "_blank", "noopener,noreferrer");
}

function getSessionItems(session) {
  const cfg = SESSION_CONFIG[session];
  return runtime.items
    .filter((item) => item.sessions.includes(session))
    .filter((item) => item[cfg.orderKey] !== null && item[cfg.orderKey] !== undefined)
    .sort((a, b) => a[cfg.orderKey] - b[cfg.orderKey]);
}

function getOrder(item, session) {
  return item[SESSION_CONFIG[session].orderKey];
}

function getSessionStatus(session) {
  const cfg = SESSION_CONFIG[session];
  const progress = getProgress()[cfg.storageKey];
  const totalItems = getSessionItems(session).length;
  const currentNumber = clamp((progress.currentIndex || 0) + 1, 1, Math.max(totalItems, 1));

  if (progress.completed) {
    return { kind: "completed", text: "Selesai hari ini" };
  }

  if (progress.started) {
    return { kind: "resume", text: `Lanjutkan dari bacaan ke-${currentNumber} dari ${totalItems}` };
  }

  return { kind: "fresh", text: "Belum dimulai hari ini" };
}

function getProgress() {
  const today = localDate();
  let progress = null;

  try {
    progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
  } catch {
    progress = null;
  }

  if (!progress || progress.date !== today) {
    progress = defaultProgress(today);
    saveProgress(progress);
    return progress;
  }

  progress.morning = { ...defaultSessionProgress(), ...(progress.morning || {}) };
  progress.evening = { ...defaultSessionProgress(), ...(progress.evening || {}) };
  return progress;
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function defaultProgress(date = localDate()) {
  return {
    date,
    morning: defaultSessionProgress(),
    evening: defaultSessionProgress(),
  };
}

function defaultSessionProgress() {
  return {
    currentIndex: 0,
    currentCounter: 0,
    completed: false,
    started: false,
  };
}

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSession(value) {
  return value === "pagi" || value === "petang";
}

function formatCount(count) {
  return `${count || 1}x`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
