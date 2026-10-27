/**
 * File: js/tools/ua.js
 * Module: Tool — User Agent Parser
 * Purpose: Read a user agent string and explain it: browser,
 *          rendering engine, operating system, device and
 *          whether the client looks like a person, a bot or a
 *          command line tool.
 * Notes: Rule order matters (Edge and Samsung Internet also
 *        contain "Chrome", Chrome also contains "Safari"), so
 *        browsers are tested most specific first. Modern Chrome
 *        freezes parts of the UA, which the tool calls out.
 *        All processing local.
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];

  function on(node, event, fn) {
    node.addEventListener(event, fn);
    listeners.push([node, event, fn]);
  }

  function find(ua, re) {
    const m = ua.match(re);
    return m ? m[1] : "";
  }

  function parseUA(raw) {
    const ua = String(raw || "");
    const r = {
      browser: "Unknown",
      engine: "Unknown",
      os: "Unknown",
      device: "Desktop computer",
      deviceType: "Desktop",
      client: "Person (browser)",
      frozen: false,
    };
    if (!ua.trim()) return r;

    /* ----- Client type: bots and CLI tools first ----- */
    const bot = ua.match(/(Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Slackbot|PetalBot|SemrushBot|AhrefsBot|MJ12bot|DotBot)/i);
    if (bot) {
      r.client = "Bot: " + bot[1];
      r.browser = bot[1];
      r.deviceType = "Bot";
      r.device = "Crawler / bot";
    } else if (/curl\/[\d.]+/i.test(ua)) {
      r.client = "CLI tool";
      r.browser = "curl " + find(ua, /curl\/([\d.]+)/i);
      r.deviceType = "CLI";
      r.device = "Command line";
    } else if (/PostmanRuntime/i.test(ua)) {
      r.client = "API client";
      r.browser = "Postman";
      r.deviceType = "CLI";
      r.device = "API client";
    } else if (/python-requests|okhttp|axios|node-fetch|Go-http-client/i.test(ua)) {
      r.client = "HTTP library";
      r.browser = find(ua, /^([^\s/]+)/) || "HTTP library";
      r.deviceType = "CLI";
      r.device = "Script / library";
    }

    /* ----- Browser (most specific first) ----- */
    if (r.deviceType !== "Bot" && r.deviceType !== "CLI") {
      let name = "", version = "", engine = "";
      if (/EdgiOS|EdgA|Edg\//.test(ua)) { name = "Microsoft Edge"; version = find(ua, /Edg(?:iOS|A)?\/([\d.]+)/); engine = /EdgiOS/.test(ua) ? "WebKit" : "Blink"; }
      else if (/Edge\/[\d.]+/.test(ua)) { name = "Microsoft Edge (legacy)"; version = find(ua, /Edge\/([\d.]+)/); engine = "EdgeHTML"; }
      else if (/OPR\/|Opera/.test(ua)) { name = "Opera"; version = find(ua, /OPR\/([\d.]+)/) || find(ua, /Version\/([\d.]+)/); engine = "Blink"; }
      else if (/SamsungBrowser\//.test(ua)) { name = "Samsung Internet"; version = find(ua, /SamsungBrowser\/([\d.]+)/); engine = "Blink"; }
      else if (/YaBrowser\//.test(ua)) { name = "Yandex Browser"; version = find(ua, /YaBrowser\/([\d.]+)/); engine = "Blink"; }
      else if (/Vivaldi\//.test(ua)) { name = "Vivaldi"; version = find(ua, /Vivaldi\/([\d.]+)/); engine = "Blink"; }
      else if (/Whale\//.test(ua)) { name = "Naver Whale"; version = find(ua, /Whale\/([\d.]+)/); engine = "Blink"; }
      else if (/CriOS\//.test(ua)) { name = "Google Chrome"; version = find(ua, /CriOS\/([\d.]+)/); engine = "WebKit"; }
      else if (/FxiOS\//.test(ua)) { name = "Mozilla Firefox"; version = find(ua, /FxiOS\/([\d.]+)/); engine = "WebKit"; }
      else if (/Chromium\//.test(ua)) { name = "Chromium"; version = find(ua, /Chromium\/([\d.]+)/); engine = "Blink"; }
      else if (/Chrome\//.test(ua)) { name = "Google Chrome"; version = find(ua, /Chrome\/([\d.]+)/); engine = "Blink"; }
      else if (/Firefox\//.test(ua)) { name = "Mozilla Firefox"; version = find(ua, /Firefox\/([\d.]+)/); engine = "Gecko"; }
      else if (/MSIE |Trident\//.test(ua)) { name = "Internet Explorer"; version = find(ua, /MSIE ([\d.]+)/) || find(ua, /rv:([\d.]+)/); engine = "Trident"; }
      else if (/Safari\//.test(ua)) { name = "Safari"; version = find(ua, /Version\/([\d.]+)/); engine = "WebKit"; }

      if (name) {
        r.browser = version ? name + " " + version : name;
        r.engine = engine || "Unknown";
        if (name === "Google Chrome" && /\.0\.0\.0$/.test(version || "")) r.frozen = true;
      }
    }

    /* ----- Operating system ----- */
    if (/Windows NT 10\.0/.test(ua)) r.os = "Windows 10 / 11";
    else if (/Windows NT 6\.3/.test(ua)) r.os = "Windows 8.1";
    else if (/Windows NT 6\.2/.test(ua)) r.os = "Windows 8";
    else if (/Windows NT 6\.1/.test(ua)) r.os = "Windows 7";
    else if (/Windows NT 6\.0/.test(ua)) r.os = "Windows Vista";
    else if (/Windows NT 5\.1/.test(ua)) r.os = "Windows XP";
    else if (/Android/.test(ua)) {
      const v = find(ua, /Android ([\d.]+)/);
      r.os = v ? "Android " + v : "Android";
    }
    else if (/iPhone|iPad|iPod/.test(ua)) {
      const v = find(ua, /OS ([\d_]+)/).replace(/_/g, ".");
      r.os = v ? "iOS " + v : "iOS";
    }
    else if (/CrOS/.test(ua)) r.os = "ChromeOS";
    else if (/Mac OS X/.test(ua)) {
      const v = find(ua, /Mac OS X ([\d_]+)/).replace(/_/g, ".");
      r.os = v ? "macOS " + v : "macOS";
    }
    else if (/Ubuntu/.test(ua)) r.os = "Ubuntu (Linux)";
    else if (/Fedora/.test(ua)) r.os = "Fedora (Linux)";
    else if (/Linux/.test(ua)) r.os = "Linux";

    /* ----- Device ----- */
    if (r.deviceType !== "Bot" && r.deviceType !== "CLI") {
      if (/iPad/.test(ua)) { r.deviceType = "Tablet"; r.device = "iPad"; }
      else if (/iPhone/.test(ua)) { r.deviceType = "Mobile"; r.device = "iPhone"; }
      else if (/iPod/.test(ua)) { r.deviceType = "Mobile"; r.device = "iPod"; }
      else if (/Android/.test(ua)) {
        const model = find(ua, /;\s*([^;)]+?)\s*(?:Build\/|;|\))/);
        r.device = model ? model.trim() : "Android device";
        r.deviceType = /Mobile/.test(ua) ? "Mobile" : "Tablet";
      }
      else if (/Tablet/.test(ua)) { r.deviceType = "Tablet"; r.device = "Tablet"; }
      else if (/Mobile|Mobi/.test(ua)) { r.deviceType = "Mobile"; r.device = "Mobile device"; }
      else { r.deviceType = "Desktop"; r.device = "Desktop computer"; }
    }
    return r;
  }

  DT.tools.ua = {
    id: "ua",
    name: "User Agent Parser",
    category: "Data",
    icon: "globe",
    description: "Paste a user agent string and see the browser, OS and device inside it.",
    keywords: "user agent ua parser browser os device detect bot crawler http header",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-ua-input",
        rows: "3",
        spellcheck: "false",
        placeholder: "Paste a user agent string here…",
      });
      const mineBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Use my browser's UA" });
      const clearBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("User agent string", [mineBtn, DT.ui.panel.pasteBtn(input), clearBtn]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
      ]);

      const rowsWrap = dom.el("div", { class: "dt-ua-rows" });
      const note = dom.el("div", { class: "dt-help", id: "dt-ua-note" });
      const resultPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("What it reveals"),
        dom.el("div", { class: "dt-panel__body", style: { padding: "6px 16px 12px" } }, [rowsWrap, note]),
      ]);

      workspace.appendChild(inputPanel);
      workspace.appendChild(resultPanel);
      container.appendChild(workspace);

      refs = { input: input };
      DT.utils.persist.bind("ua", input, { onRestore: function () { parse(); } });

      function row(label, value) {
        return dom.el("div", { class: "dt-ua-row" }, [
          dom.el("div", { class: "dt-ua-row__label", text: label }),
          dom.el("div", { class: "dt-ua-row__value", text: value }),
        ]);
      }

      function parse() {
        const r = parseUA(input.value);
        DT.ui.dom.clear(rowsWrap);
        if (!input.value.trim()) {
          rowsWrap.appendChild(dom.el("div", {
            class: "dt-ua-empty",
            text: "Paste a user agent string above and its details will appear here.",
          }));
          note.textContent = "";
          return;
        }
        rowsWrap.appendChild(row("Browser", r.browser));
        rowsWrap.appendChild(row("Rendering engine", r.engine));
        rowsWrap.appendChild(row("Operating system", r.os));
        rowsWrap.appendChild(row("Device", r.device));
        rowsWrap.appendChild(row("Device type", r.deviceType));
        rowsWrap.appendChild(row("Client type", r.client));
        note.textContent = r.frozen
          ? "Note: this string uses Chrome's reduced (frozen) format, so the exact browser version and device details may be hidden on purpose."
          : "";
      }

      on(input, "input", parse);
      on(mineBtn, "click", function () {
        input.value = navigator.userAgent || "";
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        parse();
      });
      on(clearBtn, "click", function () {
        input.value = "";
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        parse();
        input.focus();
      });

      // Start with the visitor's own UA: instantly useful.
      if (!input.value && navigator.userAgent) {
        input.value = navigator.userAgent;
      }
      parse();
    },

    unmount() {
      while (listeners.length) {
        const entry = listeners.pop();
        entry[0].removeEventListener(entry[1], entry[2]);
      }
      refs = null;
    },
  };
})();
