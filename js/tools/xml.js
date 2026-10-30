/**
 * File: js/tools/xml.js
 * Module: Tool — XML Formatter & Validator
 * Purpose: Format XML with clean indentation, minify it, or
 *          validate it, using the browser's own DOMParser for
 *          well-formedness checking.
 * Notes: The pretty printer walks the parsed DOM by hand so
 *        attribute order, comments, CDATA sections and mixed
 *        content survive a format round trip: mixed content is
 *        kept inline so no significant whitespace is invented.
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

  /* ---------------- Parsing ---------------- */

  function parseXml(src) {
    const doc = new window.DOMParser().parseFromString(src, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err || doc.documentElement.nodeName === "parsererror") {
      const text = err ? err.textContent.trim().split("\n")[0] : "Not well-formed XML.";
      throw new Error(text || "Not well-formed XML.");
    }
    return doc;
  }

  function declarationOf(src) {
    const m = src.match(/^\s*(<\?xml[\s\S]*?\?>)/i);
    return m ? m[1] : "";
  }

  /* ---------------- Escaping (DOM gives decoded values) ---------------- */

  function escText(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escAttr(s) {
    return escText(s).replace(/"/g, "&quot;");
  }

  function attrsOf(node) {
    let out = "";
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes[i];
      out += " " + a.name + '="' + escAttr(a.value) + '"';
    }
    return out;
  }

  /* ---------------- Serializer ----------------
     pretty=true indents block structure; text-only elements
     stay on one line; mixed content stays inline either way. */

  function serializeNode(node, depth, pretty, indentStr) {
    const pad = pretty ? indentStr.repeat(depth) : "";
    if (node.nodeType === 8) return pad + "<!--" + node.nodeValue + "-->";
    if (node.nodeType === 4) return pad + "<![CDATA[" + node.nodeValue + "]]>";
    if (node.nodeType === 7) return pad + "<?" + node.target + (node.data ? " " + node.data : "") + "?>";
    if (node.nodeType === 3) return pad + escText(node.nodeValue.trim());
    if (node.nodeType !== 1) return "";

    const open = "<" + node.nodeName + attrsOf(node);
    const kids = [];
    node.childNodes.forEach(function (c) {
      if (c.nodeType === 3 && c.nodeValue.trim() === "") return;
      kids.push(c);
    });
    if (!kids.length) return pad + open + "/>";

    const hasElement = kids.some(function (c) { return c.nodeType === 1; });
    const hasText = kids.some(function (c) { return c.nodeType === 3; });

    if (!hasElement) {
      const text = kids.map(function (c) {
        if (c.nodeType === 4) return "<![CDATA[" + c.nodeValue + "]]>";
        if (c.nodeType === 8) return "<!--" + c.nodeValue + "-->";
        return escText(c.nodeValue);
      }).join("");
      return pad + open + ">" + text + "</" + node.nodeName + ">";
    }
    if (hasText) {
      // Mixed content: whitespace here is significant, stay inline.
      const inner = kids.map(function (c) {
        return serializeNode(c, 0, false, indentStr);
      }).join("");
      return pad + open + ">" + inner + "</" + node.nodeName + ">";
    }
    const innerPretty = kids.map(function (c) {
      return serializeNode(c, depth + 1, pretty, indentStr);
    }).join(pretty ? "\n" : "");
    if (pretty) {
      return pad + open + ">\n" + innerPretty + "\n" + pad + "</" + node.nodeName + ">";
    }
    return pad + open + ">" + innerPretty + "</" + node.nodeName + ">";
  }

  function serializeDoc(doc, src, pretty, indentStr) {
    const parts = [];
    const decl = declarationOf(src);
    if (decl) parts.push(decl);
    doc.childNodes.forEach(function (c) {
      if (c.nodeType === 10) {
        parts.push("<!DOCTYPE " + c.name + ">");
        return;
      }
      const s = serializeNode(c, 0, pretty, indentStr);
      if (s) parts.push(s);
    });
    return parts.join(pretty ? "\n" : "") + "\n";
  }

  function measure(doc) {
    let elements = 0;
    let maxDepth = 0;
    (function walk(node, depth) {
      if (node.nodeType === 1) {
        elements++;
        if (depth > maxDepth) maxDepth = depth;
        node.childNodes.forEach(function (c) { walk(c, depth + 1); });
      }
    })(doc.documentElement, 1);
    return { elements: elements, depth: maxDepth };
  }

  /* ---------------- Tool ---------------- */

  DT.tools.xml = {
    id: "xml",
    name: "XML Formatter & Validator",
    category: "Data",
    icon: "codeXml",
    description: "Format and validate XML, or minify it for production.",
    keywords: "xml format beautify validate minify pretty print rss svg soap lint",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Input */
      const input = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-xml-input",
        rows: "12",
        spellcheck: "false",
        placeholder: "Paste XML here, then Format, Minify or Validate…",
      });
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" });
      const inputError = DT.ui.panel.error(inputPanel);
      const clearBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      inputPanel.appendChild(DT.ui.panel.head("Input", [DT.ui.panel.pasteBtn(input), clearBtn]));
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__body" }, [input]));
      const inputStats = DT.ui.panel.bindStats(input);
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [
        inputStats.el,
        DT.ui.panel.hint("Ctrl+Enter to format"),
      ]));
      inputPanel.appendChild(inputError.el);

      /* Actions */
      const indentSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-xml-indent" }, [
        dom.el("option", { value: "2", text: "2 spaces" }),
        dom.el("option", { value: "4", text: "4 spaces" }),
        dom.el("option", { value: "tab", text: "Tab" }),
      ]);
      const btnFormat = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Format" });
      const btnMinify = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Minify" });
      const btnValidate = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Validate" });
      const actions = dom.el("div", { class: "dt-xml-actions" }, [
        btnFormat,
        btnMinify,
        btnValidate,
        dom.el("span", { class: "dt-toolbar__label", text: "Indent" }),
        indentSel,
      ]);

      /* Output */
      const output = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-xml-output",
        rows: "12",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Result appears here…",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const btnDownload = DT.ui.dlButton({
        getText: () => output.value,
        filename: () => "data.xml",
        mime: "text/xml;charset=utf-8",
        label: "Download",
      });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Output", [DT.ui.panel.wrapBtn(output), btnCopy, btnDownload]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
      ]);
      const outputStats = DT.ui.panel.stats();
      outputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [outputStats]));

      workspace.appendChild(inputPanel);
      workspace.appendChild(actions);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input: input, output: output };
      DT.utils.persist.bind("xml", input);

      function indentString() {
        return indentSel.value === "tab" ? "\t" : " ".repeat(Number(indentSel.value));
      }

      function run(op) {
        const src = input.value;
        inputError.clear();
        if (!src.trim()) {
          output.value = "";
          DT.ui.panel.paintStats(outputStats, "");
          return;
        }
        try {
          const doc = parseXml(src);
          const m = measure(doc);
          if (op === "validate") {
            outputStats.textContent = "Valid XML · " + m.elements + " elements · depth " + m.depth;
            DT.ui.toast.success("Valid XML");
            return;
          }
          output.value = serializeDoc(doc, src, op === "format", indentString());
          DT.ui.panel.paintStats(outputStats, output.value);
          outputStats.textContent += " · " + m.elements + " elements · depth " + m.depth;
        } catch (err) {
          inputError.show("XML is not well-formed", err.message);
        }
      }

      on(btnFormat, "click", function () { run("format"); });
      on(btnMinify, "click", function () { run("minify"); });
      on(btnValidate, "click", function () { run("validate"); });
      on(clearBtn, "click", function () {
        input.value = "";
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        inputError.clear();
        input.focus();
      });
      on(btnCopy, "click", function () {
        DT.utils.clipboard.copy(output.value)
          .then(function () { DT.ui.toast.success("Copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
      });
      on(input, "keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          run("format");
        }
      });
      input.focus();
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
