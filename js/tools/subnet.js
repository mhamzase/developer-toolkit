/**
 * File: js/tools/subnet.js
 * Module: Tool — IP Subnet Calculator
 * Purpose: IPv4 subnet math from an address and a CIDR prefix:
 *          mask, wildcard, network, broadcast, usable range,
 *          host counts, class and scope.
 * Notes: Plain unsigned 32 bit math. /31 links follow RFC 3021
 *        (both addresses usable) and a /32 is a single host
 *        route; both cases are called out under the results.
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

  function parseIp(str) {
    const parts = String(str || "").trim().split(".");
    if (parts.length !== 4) return null;
    let n = 0;
    for (let i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return null;
      const v = Number(parts[i]);
      if (v > 255) return null;
      n = n * 256 + v;
    }
    return n >>> 0;
  }

  function toIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }

  function fmt(n) {
    return n.toLocaleString("en-US");
  }

  function compute(ipStr, prefix) {
    const ip = parseIp(ipStr);
    if (ip === null || prefix < 0 || prefix > 32) return null;
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const wildcard = (~mask) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | wildcard) >>> 0;
    const total = Math.pow(2, 32 - prefix);

    let first, last, usable, note = "";
    if (prefix === 32) {
      first = last = ip;
      usable = 1;
      note = "A /32 is a single host route: the address is the whole subnet.";
    } else if (prefix === 31) {
      first = network;
      last = broadcast;
      usable = 2;
      note = "A /31 point to point link (RFC 3021) has no network or broadcast address: both addresses are usable.";
    } else {
      first = (network + 1) >>> 0;
      last = (broadcast - 1) >>> 0;
      usable = total - 2;
    }

    const firstOctet = (ip >>> 24) & 255;
    let ipClass = "E (experimental)";
    if (firstOctet < 128) ipClass = "A";
    else if (firstOctet < 192) ipClass = "B";
    else if (firstOctet < 224) ipClass = "C";
    else if (firstOctet < 240) ipClass = "D (multicast)";

    let scope = "Public";
    if ((ip >>> 24) === 10) scope = "Private (RFC 1918)";
    else if ((ip >>> 24) === 172 && ((ip >>> 16) & 255) >= 16 && ((ip >>> 16) & 255) <= 31) scope = "Private (RFC 1918)";
    else if ((ip >>> 24) === 192 && ((ip >>> 16) & 255) === 168) scope = "Private (RFC 1918)";
    else if ((ip >>> 24) === 127) scope = "Loopback";
    else if ((ip >>> 24) === 169 && ((ip >>> 16) & 255) === 254) scope = "Link local";
    else if ((ip >>> 24) === 100 && ((ip >>> 16) & 255) >= 64 && ((ip >>> 16) & 255) <= 127) scope = "Shared / CGNAT (RFC 6598)";
    else if (firstOctet >= 224 && firstOctet < 240) scope = "Multicast";

    return {
      ip: toIp(ip),
      mask: toIp(mask),
      wildcard: toIp(wildcard),
      network: toIp(network),
      broadcast: toIp(broadcast),
      first: toIp(first),
      last: toIp(last),
      total: total,
      usable: usable,
      ipClass: ipClass,
      scope: scope,
      note: note,
    };
  }

  DT.tools.subnet = {
    id: "subnet",
    name: "IP Subnet Calculator",
    category: "Reference",
    icon: "network",
    description: "Network, broadcast, mask and host ranges for any IPv4 subnet.",
    keywords: "ip subnet cidr calculator network broadcast mask wildcard ipv4 host range",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Inputs */
      const ipInput = dom.el("input", {
        type: "text",
        class: "dt-input",
        id: "dt-subnet-ip",
        value: "192.168.1.10",
        spellcheck: "false",
        autocomplete: "off",
      });
      const cidrSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-subnet-cidr" });
      for (let i = 0; i <= 32; i++) {
        cidrSel.appendChild(dom.el("option", { value: String(i), text: "/" + i }));
      }
      cidrSel.value = "24";
      const cidrRange = dom.el("input", {
        type: "range",
        class: "dt-subnet-range",
        id: "dt-subnet-range",
        min: "0",
        max: "32",
        value: "24",
      });
      const inputPanel = dom.el("div", { class: "dt-panel" });
      const inputError = DT.ui.panel.error(inputPanel);
      inputPanel.appendChild(DT.ui.panel.head("Address and prefix"));
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__body dt-subnet-form" }, [
        dom.el("div", { class: "dt-field" }, [
          dom.el("label", { class: "dt-label", for: "dt-subnet-ip", text: "IPv4 address" }),
          ipInput,
        ]),
        dom.el("div", { class: "dt-field" }, [
          dom.el("label", { class: "dt-label", for: "dt-subnet-cidr", text: "CIDR prefix" }),
          cidrSel,
        ]),
        dom.el("div", { class: "dt-field dt-subnet-form__range" }, [
          dom.el("label", { class: "dt-label", text: "Slide to change the prefix" }),
          cidrRange,
        ]),
      ]));
      inputPanel.appendChild(inputError.el);

      /* Results */
      const rowsWrap = dom.el("div", { class: "dt-ua-rows" });
      const note = dom.el("div", { class: "dt-help", id: "dt-subnet-note" });
      const summary = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-subnet-summary",
        rows: "6",
        readonly: "readonly",
        spellcheck: "false",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy summary" });
      const resultPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Subnet details", [btnCopy]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "6px 16px 12px" } }, [rowsWrap, note]),
      ]);
      const summaryPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Summary"),
        dom.el("div", { class: "dt-panel__body" }, [summary]),
      ]);

      workspace.appendChild(inputPanel);
      workspace.appendChild(resultPanel);
      workspace.appendChild(summaryPanel);
      container.appendChild(workspace);

      refs = { ip: ipInput, cidr: cidrSel };

      function row(label, value) {
        return dom.el("div", { class: "dt-ua-row" }, [
          dom.el("div", { class: "dt-ua-row__label", text: label }),
          dom.el("div", { class: "dt-ua-row__value", text: value }),
        ]);
      }

      function calculate() {
        const prefix = Number(cidrSel.value);
        const r = compute(ipInput.value, prefix);
        DT.ui.dom.clear(rowsWrap);
        if (!r) {
          inputError.show("Invalid IPv4 address", "Use four numbers from 0 to 255, like 192.168.1.10.");
          summary.value = "";
          note.textContent = "";
          return;
        }
        inputError.clear();
        rowsWrap.appendChild(row("IP address", r.ip + " /" + prefix));
        rowsWrap.appendChild(row("Subnet mask", r.mask));
        rowsWrap.appendChild(row("Wildcard mask", r.wildcard));
        rowsWrap.appendChild(row("Network address", r.network));
        rowsWrap.appendChild(row("Broadcast address", r.broadcast));
        rowsWrap.appendChild(row("First usable", r.first));
        rowsWrap.appendChild(row("Last usable", r.last));
        rowsWrap.appendChild(row("Total addresses", fmt(r.total)));
        rowsWrap.appendChild(row("Usable hosts", fmt(r.usable)));
        rowsWrap.appendChild(row("IP class", r.ipClass));
        rowsWrap.appendChild(row("Scope", r.scope));
        note.textContent = r.note;
        summary.value = [
          "IP address:       " + r.ip + " /" + prefix,
          "Subnet mask:      " + r.mask,
          "Network:          " + r.network,
          "Broadcast:        " + r.broadcast,
          "Usable range:     " + r.first + " - " + r.last,
          "Usable hosts:     " + fmt(r.usable) + " of " + fmt(r.total),
          "Class / scope:    " + r.ipClass + " / " + r.scope,
        ].join("\n");
      }

      on(ipInput, "input", calculate);
      on(cidrSel, "change", function () {
        cidrRange.value = cidrSel.value;
        calculate();
      });
      on(cidrRange, "input", function () {
        cidrSel.value = cidrRange.value;
        calculate();
      });
      on(btnCopy, "click", function () {
        DT.utils.clipboard.copy(summary.value)
          .then(function () { DT.ui.toast.success("Copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
      });

      calculate();
      ipInput.focus();
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
