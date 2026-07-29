(() => {
  const PHONE_PATTERN =
    /(?:\+|00)?[\d۰-۹٠-٩](?:[\s().-]*[\d۰-۹٠-٩]){8,13}/gu;
  const EXCLUDED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
  ]);
  const matches = [];
  let scanTimer;
  let popoverHost;

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanPage, 350);
  }

  function scanPage() {
    if (!("highlights" in CSS) || typeof Highlight === "undefined") return;

    matches.length = 0;
    const ranges = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (
            !parent ||
            !node.data.trim() ||
            EXCLUDED_TAGS.has(parent.tagName) ||
            parent.closest("#instagram-crm-lead-root")
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let node;
    while ((node = walker.nextNode())) {
      PHONE_PATTERN.lastIndex = 0;
      let result;
      while ((result = PHONE_PATTERN.exec(node.data))) {
        const phone = result[0].trim();
        if (!isLikelyPhone(phone)) continue;

        const range = new Range();
        range.setStart(node, result.index);
        range.setEnd(node, result.index + result[0].length);
        matches.push({ node, start: result.index, end: result.index + result[0].length, phone });
        ranges.push(range);
      }
    }

    CSS.highlights.set("instagram-crm-phone", new Highlight(...ranges));
  }

  function isLikelyPhone(value) {
    const normalized = toEnglishDigits(value).replace(/\D/g, "");
    return normalized.length >= 10 && normalized.length <= 15;
  }

  function toEnglishDigits(value) {
    return value
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  }

  function findPhoneAtPoint(event) {
    const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    if (!caret?.offsetNode) return null;
    return matches.find(
      (match) =>
        match.node === caret.offsetNode &&
        caret.offset >= match.start &&
        caret.offset <= match.end,
    );
  }

  async function openPopover(match, event) {
    closePopover();

    const state = await sendMessage({ type: "GET_STATE" });
    popoverHost = document.createElement("div");
    popoverHost.id = "instagram-crm-lead-root";
    popoverHost.style.left = `${Math.min(event.clientX, window.innerWidth - 340)}px`;
    popoverHost.style.top = `${Math.min(event.clientY + 12, window.innerHeight - 520)}px`;
    document.documentElement.append(popoverHost);

    const shadow = popoverHost.attachShadow({ mode: "open" });
    shadow.append(createStyle());
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.dir = "rtl";
    shadow.append(panel);

    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = "ثبت سرنخ در CRM";
    const closeButton = button("×", "close", closePopover);
    header.append(title, closeButton);
    panel.append(header);

    if (!state.ok || !state.authenticated) {
      const message = document.createElement("p");
      message.className = "notice";
      message.textContent = "ابتدا از پنجره افزونه وارد حساب CRM شوید.";
      panel.append(message);
      return;
    }

    const form = document.createElement("form");
    const defaults = getInstagramContext();
    const fields = [
      ["phone", "شماره تلفن", toEnglishDigits(match.phone), true],
      ["customer_id", "شناسه مشتری", "", false],
      ["instagram_id", "شناسه اینستاگرام", defaults.instagramId, false],
      ["customer_name", "نام مشتری", defaults.customerName, false],
      ["subject", "موضوع درخواست", "", true],
      ["city", "شهر مشتری", "", false],
    ];

    for (const [name, label, value, required] of fields) {
      form.append(createField(name, label, value, required));
    }

    const status = document.createElement("p");
    status.className = "status";
    const submit = button("ثبت سرنخ", "submit");
    submit.type = "submit";
    form.append(status, submit);
    panel.append(form);

    form.addEventListener("submit", async (submitEvent) => {
      submitEvent.preventDefault();
      submit.disabled = true;
      status.className = "status";
      status.textContent = "در حال ثبت...";

      const lead = Object.fromEntries(new FormData(form));
      lead.instagram_url = location.href;
      const result = await sendMessage({ type: "CREATE_LEAD", lead });

      if (result.ok) {
        status.className = "status success";
        status.textContent = "سرنخ با موفقیت ثبت شد.";
        setTimeout(closePopover, 1200);
      } else {
        status.className = "status error";
        status.textContent = result.error;
        submit.disabled = false;
      }
    });
  }

  function getInstagramContext() {
    const pathPart = location.pathname.split("/").filter(Boolean)[0] || "";
    const reserved = new Set(["p", "reel", "reels", "explore", "direct", "accounts"]);
    const instagramId = reserved.has(pathPart) ? "" : pathPart;
    const customerName =
      document.querySelector("header h1, header h2")?.textContent?.trim() || "";
    return { instagramId, customerName };
  }

  function createField(name, labelText, value, required) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.name = name;
    input.value = value;
    input.required = required;
    input.autocomplete = "off";
    label.append(input);
    return label;
  }

  function button(text, className, handler) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = text;
    if (handler) element.addEventListener("click", handler);
    return element;
  }

  function closePopover() {
    popoverHost?.remove();
    popoverHost = null;
  }

  function sendMessage(payload) {
    return chrome.runtime.sendMessage(payload).catch(() => ({
      ok: false,
      error: "ارتباط با افزونه برقرار نشد.",
    }));
  }

  function createStyle() {
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .panel {
        width: 320px; max-height: calc(100vh - 24px); overflow: auto;
        padding: 14px; color: #18212f; background: #fff; border: 1px solid #d9e0e8;
        border-radius: 14px; box-shadow: 0 16px 45px rgba(16, 24, 40, .22);
        font: 13px/1.5 Tahoma, Arial, sans-serif;
      }
      header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      header strong { font-size: 15px; }
      button { border: 0; font: inherit; cursor: pointer; }
      .close { width: 28px; height: 28px; color: #667085; background: #f2f4f7; border-radius: 50%; font-size: 20px; }
      label { display: block; margin: 8px 0; color: #475467; }
      input {
        display: block; width: 100%; margin-top: 4px; padding: 9px 10px; color: #18212f;
        background: #fff; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; direction: rtl;
      }
      input:focus { border-color: #6c5ce7; outline: 2px solid rgba(108, 92, 231, .15); }
      .submit { width: 100%; padding: 10px; color: #fff; background: #6c5ce7; border-radius: 9px; font-weight: bold; }
      .submit:disabled { opacity: .55; cursor: wait; }
      .notice, .status { margin: 8px 0; color: #667085; }
      .success { color: #067647; }
      .error { color: #b42318; }
    `;
    return style;
  }

  document.addEventListener(
    "click",
    (event) => {
      if (popoverHost?.contains(event.target)) return;
      const match = findPhoneAtPoint(event);
      if (match) {
        event.preventDefault();
        event.stopPropagation();
        openPopover(match, event);
      } else {
        closePopover();
      }
    },
    true,
  );

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  scheduleScan();
})();
