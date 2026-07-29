const elements = {
  loginView: document.querySelector("#login-view"),
  appView: document.querySelector("#app-view"),
  loginForm: document.querySelector("#login-form"),
  settingsForm: document.querySelector("#settings-form"),
  message: document.querySelector("#global-message"),
  accountLabel: document.querySelector("#account-label"),
  loginLabel: document.querySelector("#login-label"),
  leadsList: document.querySelector("#leads-list"),
  logout: document.querySelector("#logout"),
};

let state = {
  authenticated: false,
  config: {},
  profile: null,
};

async function init() {
  bindEvents();
  const response = await sendMessage({ type: "GET_STATE" });
  if (!response.ok) {
    showMessage(response.error, "error");
    return;
  }
  state = response;
  fillSettings();
  renderAuthState();
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.settingsForm.addEventListener("submit", handleSettings);
  elements.logout.addEventListener("click", handleLogout);
  document.querySelector("#sync-leads").addEventListener("click", syncLeads);

  document.querySelectorAll("[data-open-settings]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.loginView.classList.add("hidden");
      elements.appView.classList.remove("hidden");
      openTab("settings");
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => openTab(button.dataset.tab));
  });
}

async function handleLogin(event) {
  event.preventDefault();
  clearMessage();
  const submit = event.submitter;
  submit.disabled = true;

  const data = new FormData(elements.loginForm);
  const response = await sendMessage({
    type: "LOGIN",
    credentials: {
      login: data.get("login"),
      password: data.get("password"),
    },
  });
  submit.disabled = false;

  if (!response.ok) {
    showMessage(response.error, "error");
    return;
  }

  elements.loginForm.reset();
  state.authenticated = true;
  state.profile = response.profile;
  renderAuthState();
  showMessage("ورود با موفقیت انجام شد.", "success");
}

async function handleSettings(event) {
  event.preventDefault();
  clearMessage();
  const submit = event.submitter;
  submit.disabled = true;
  const response = await sendMessage({
    type: "SAVE_CONFIG",
    config: Object.fromEntries(new FormData(elements.settingsForm)),
  });
  submit.disabled = false;

  if (!response.ok) {
    showMessage(response.error, "error");
    return;
  }

  state.config = response.config;
  updateLoginLabel();
  showMessage("تنظیمات API ذخیره شد.", "success");
  if (!state.authenticated) {
    elements.appView.classList.add("hidden");
    elements.loginView.classList.remove("hidden");
  }
}

async function handleLogout() {
  const response = await sendMessage({ type: "LOGOUT" });
  if (!response.ok) {
    showMessage(response.error, "error");
    return;
  }
  state.authenticated = false;
  state.profile = null;
  renderAuthState();
}

function renderAuthState() {
  elements.loginView.classList.toggle("hidden", state.authenticated);
  elements.appView.classList.toggle("hidden", !state.authenticated);
  elements.logout.classList.toggle("hidden", !state.authenticated);
  updateLoginLabel();

  if (state.authenticated) {
    const name =
      state.profile?.name ||
      state.profile?.full_name ||
      state.profile?.email ||
      "متصل به CRM";
    elements.accountLabel.textContent = name;
    openTab("guide");
  } else {
    elements.accountLabel.textContent = "اتصال به CRM";
  }
}

function updateLoginLabel() {
  elements.loginLabel.textContent =
    state.config?.loginField === "username" ? "نام کاربری" : "ایمیل";
}

function fillSettings() {
  document.querySelector("#base-url").value =
    state.config?.baseUrl || "https://dalil.net";
  document.querySelector("#login-path").value =
    state.config?.loginPath || "/api/v1/auth/login";
  document.querySelector("#leads-path").value =
    state.config?.leadsPath || "/api/v1/lead";
  document.querySelector("#login-field").value =
    state.config?.loginField || "email";
}

async function openTab(tabName) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `${tabName}-tab`);
  });
  if (tabName === "leads") await loadLocalLeads();
}

async function loadLocalLeads() {
  elements.leadsList.replaceChildren(createEmpty("در حال دریافت..."));
  const response = await sendMessage({ type: "GET_LOCAL_LEADS" });
  if (!response.ok) {
    elements.leadsList.replaceChildren(createEmpty(response.error));
    return;
  }
  renderLeads(response.leads);
}

async function syncLeads(event) {
  clearMessage();
  event.currentTarget.disabled = true;
  const response = await sendMessage({ type: "SYNC_LEADS" });
  event.currentTarget.disabled = false;
  if (!response.ok) {
    showMessage(response.error, "error");
    return;
  }
  renderLeads(response.leads);
  showMessage("فهرست سرنخ‌ها همگام شد.", "success");
}

function renderLeads(leads) {
  elements.leadsList.replaceChildren();
  if (!leads?.length) {
    elements.leadsList.append(createEmpty("هنوز سرنخی ثبت نشده است."));
    return;
  }

  for (const lead of leads) {
    const item = document.createElement("article");
    item.className = "lead";

    const top = document.createElement("div");
    top.className = "lead-top";
    const title = document.createElement("strong");
    title.textContent = lead.customer_name || lead.instagram_id || "بدون نام";
    const date = document.createElement("time");
    date.textContent = formatDate(lead.created_at);
    top.append(title, date);

    const subject = document.createElement("p");
    subject.dir = "rtl";
    subject.textContent = lead.subject || "بدون موضوع";
    const phone = document.createElement("p");
    phone.textContent = [lead.phone, lead.customer_email]
      .filter(Boolean)
      .join(" · ");

    item.append(top, subject, phone);
    elements.leadsList.append(item);
  }
}

function createEmpty(text) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = text;
  return element;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function showMessage(text, type = "") {
  elements.message.textContent = text;
  elements.message.className = `message ${type}`.trim();
}

function clearMessage() {
  elements.message.textContent = "";
  elements.message.className = "message hidden";
}

function sendMessage(payload) {
  return chrome.runtime.sendMessage(payload).catch(() => ({
    ok: false,
    error: "ارتباط با افزونه برقرار نشد.",
  }));
}

init();
