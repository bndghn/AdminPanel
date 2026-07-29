const DEFAULT_CONFIG = {
  baseUrl: "",
  loginPath: "/auth/login",
  leadsPath: "/leads",
  loginField: "email",
};

const STORAGE_KEYS = {
  config: "crmConfig",
  profile: "crmProfile",
  leads: "createdLeads",
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.config);
  if (!stored[STORAGE_KEYS.config]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.config]: DEFAULT_CONFIG });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_STATE":
      return getState();
    case "SAVE_CONFIG":
      return saveConfig(message.config);
    case "LOGIN":
      return login(message.credentials);
    case "LOGOUT":
      return logout();
    case "CREATE_LEAD":
      return createLead(message.lead);
    case "GET_LOCAL_LEADS":
      return getLocalLeads();
    case "SYNC_LEADS":
      return syncLeads();
    default:
      throw new Error("درخواست ناشناخته است.");
  }
}

async function getState() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([STORAGE_KEYS.config, STORAGE_KEYS.profile]),
    chrome.storage.session.get("crmToken"),
  ]);

  return {
    config: { ...DEFAULT_CONFIG, ...(local[STORAGE_KEYS.config] || {}) },
    profile: local[STORAGE_KEYS.profile] || null,
    authenticated: Boolean(session.crmToken),
  };
}

async function saveConfig(config) {
  const normalized = {
    baseUrl: String(config?.baseUrl || "").trim().replace(/\/+$/, ""),
    loginPath: normalizePath(config?.loginPath, DEFAULT_CONFIG.loginPath),
    leadsPath: normalizePath(config?.leadsPath, DEFAULT_CONFIG.leadsPath),
    loginField: config?.loginField === "username" ? "username" : "email",
  };

  validateHttpUrl(normalized.baseUrl);
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: normalized });
  return { config: normalized };
}

async function login(credentials) {
  const config = await getConfig();
  validateHttpUrl(config.baseUrl);

  const loginValue = String(credentials?.login || "").trim();
  const password = String(credentials?.password || "");
  if (!loginValue || !password) {
    throw new Error("نام کاربری و رمز عبور الزامی است.");
  }

  const response = await apiRequest(config.loginPath, {
    method: "POST",
    body: {
      [config.loginField]: loginValue,
      password,
    },
    skipAuth: true,
  });

  const token =
    response?.access_token ||
    response?.accessToken ||
    response?.token ||
    response?.data?.access_token ||
    response?.data?.token;

  if (!token) {
    throw new Error("توکن ورود در پاسخ API پیدا نشد.");
  }

  const profile = response?.user || response?.data?.user || {
    name: loginValue,
  };

  await Promise.all([
    chrome.storage.session.set({ crmToken: token }),
    chrome.storage.local.set({ [STORAGE_KEYS.profile]: profile }),
  ]);

  return { profile };
}

async function logout() {
  await Promise.all([
    chrome.storage.session.remove("crmToken"),
    chrome.storage.local.remove(STORAGE_KEYS.profile),
  ]);
  return {};
}

async function createLead(lead) {
  const payload = validateLead(lead);
  const config = await getConfig();
  const response = await apiRequest(config.leadsPath, {
    method: "POST",
    body: payload,
  });

  const savedLead = {
    ...payload,
    id: response?.id || response?.data?.id || crypto.randomUUID(),
    created_at:
      response?.created_at ||
      response?.data?.created_at ||
      new Date().toISOString(),
    crm_response: response,
  };

  const { [STORAGE_KEYS.leads]: current = [] } =
    await chrome.storage.local.get(STORAGE_KEYS.leads);
  await chrome.storage.local.set({
    [STORAGE_KEYS.leads]: [savedLead, ...current].slice(0, 500),
  });

  return { lead: savedLead };
}

async function getLocalLeads() {
  const { [STORAGE_KEYS.leads]: leads = [] } =
    await chrome.storage.local.get(STORAGE_KEYS.leads);
  return { leads };
}

async function syncLeads() {
  const config = await getConfig();
  const response = await apiRequest(withQuery(config.leadsPath, "mine=1"));
  const remoteLeads = Array.isArray(response)
    ? response
    : response?.data || response?.leads;

  if (!Array.isArray(remoteLeads)) {
    throw new Error("ساختار فهرست سرنخ‌ها در پاسخ API معتبر نیست.");
  }

  const { leads: localLeads } = await getLocalLeads();
  const localIds = new Set(localLeads.map((lead) => String(lead.id)));
  const merged = [
    ...localLeads,
    ...remoteLeads.filter((lead) => !localIds.has(String(lead.id))),
  ].sort((a, b) => {
    const aDate = new Date(a.created_at || 0).getTime();
    const bDate = new Date(b.created_at || 0).getTime();
    return bDate - aDate;
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.leads]: merged.slice(0, 500),
  });
  return { leads: merged };
}

async function apiRequest(path, options = {}) {
  const config = await getConfig();
  const headers = { Accept: "application/json" };
  if (options.body) headers["Content-Type"] = "application/json";

  if (!options.skipAuth) {
    const { crmToken } = await chrome.storage.session.get("crmToken");
    if (!crmToken) throw new Error("ابتدا وارد حساب CRM شوید.");
    headers.Authorization = `Bearer ${crmToken}`;
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("ارتباط با سرور CRM برقرار نشد.");
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `خطای API با کد ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function getConfig() {
  const { [STORAGE_KEYS.config]: config } =
    await chrome.storage.local.get(STORAGE_KEYS.config);
  return { ...DEFAULT_CONFIG, ...(config || {}) };
}

function validateLead(lead) {
  const clean = {
    customer_id: String(lead?.customer_id || "").trim(),
    instagram_id: String(lead?.instagram_id || "").trim(),
    customer_name: String(lead?.customer_name || "").trim(),
    subject: String(lead?.subject || "").trim(),
    city: String(lead?.city || "").trim(),
    phone: String(lead?.phone || "").trim(),
    source: "instagram",
    instagram_url: String(lead?.instagram_url || "").trim(),
  };

  if (!clean.phone) throw new Error("شماره تلفن الزامی است.");
  if (!clean.subject) throw new Error("موضوع سرنخ الزامی است.");
  return clean;
}

function validateHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("آدرس پایه API معتبر نیست.");
  }
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("آدرس API باید با http یا https شروع شود.");
  }
}

function normalizePath(value, fallback) {
  const path = String(value || fallback).trim();
  return path.startsWith("/") ? path : `/${path}`;
}

function withQuery(path, query) {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

function normalizeError(error) {
  return error instanceof Error ? error.message : "خطای پیش‌بینی‌نشده رخ داد.";
}
