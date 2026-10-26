/**
 * File: js/tools/jsontypes.js
 * Module: Tool — JSON to Types
 * Purpose: Generate TypeScript interfaces, Go structs or Python
 *          dataclasses from a JSON sample. Shapes are inferred by
 *          walking the value; arrays merge the shapes of all items
 *          (keys missing from some items become optional), and
 *          identical object shapes share one generated type.
 * Notes: All processing local. Inference is sample-based: a field
 *        typed from the sample values only.
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

  /* ---------------- Shape inference ----------------
   * A node: {
   *   prims: Set of 'string' | 'int' | 'float' | 'bool' | 'null',
   *   obj:   null | { props: [{ key, node, optional }] },
   *   arr:   null | node (element), arrSeen distinguishes "no
   *          array" from "array of unknown".
   * } */
  function emptyNode() {
    return { prims: new Set(), obj: null, arr: null, arrSeen: false };
  }

  function infer(value) {
    const node = emptyNode();
    if (value === null) { node.prims.add("null"); return node; }
    if (Array.isArray(value)) {
      node.arrSeen = true;
      node.arr = emptyNode();
      value.forEach(function (item) { node.arr = merge(node.arr, infer(item)); });
      return node;
    }
    if (typeof value === "object") {
      node.obj = { props: Object.keys(value).map(function (k) {
        return { key: k, node: infer(value[k]), optional: false };
      }) };
      return node;
    }
    if (typeof value === "number") {
      node.prims.add(Number.isInteger(value) ? "int" : "float");
      return node;
    }
    node.prims.add(typeof value === "string" ? "string" : "bool");
    return node;
  }

  function merge(a, b) {
    const out = emptyNode();
    a.prims.forEach(function (p) { out.prims.add(p); });
    b.prims.forEach(function (p) { out.prims.add(p); });
    if (out.prims.has("int") && out.prims.has("float")) out.prims.delete("int");
    out.arrSeen = a.arrSeen || b.arrSeen;
    if (a.arr && b.arr) out.arr = merge(a.arr, b.arr);
    else out.arr = a.arr || b.arr;
    if (a.obj && b.obj) {
      const props = [];
      const bByKey = {};
      b.obj.props.forEach(function (p) { bByKey[p.key] = p; });
      a.obj.props.forEach(function (pa) {
        const pb = bByKey[pa.key];
        if (pb) {
          props.push({ key: pa.key, node: merge(pa.node, pb.node), optional: pa.optional || pb.optional });
          delete bByKey[pa.key];
        } else {
          props.push({ key: pa.key, node: pa.node, optional: true });
        }
      });
      Object.keys(bByKey).forEach(function (k) {
        props.push({ key: k, node: bByKey[k].node, optional: true });
      });
      out.obj = { props: props };
    } else {
      out.obj = a.obj || b.obj;
    }
    return out;
  }

  /* ---------------- Naming ---------------- */

  function pascal(key) {
    return String(key)
      .replace(/[^A-Za-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join("") || "Value";
  }
  function singular(name) {
    if (name.length > 3 && name.endsWith("ies")) return name.slice(0, -3) + "y";
    if (name.length > 1 && name.endsWith("s") && !name.endsWith("ss")) return name.slice(0, -1);
    return name;
  }
  function shapeSignature(node) {
    let sig = "p:" + [...node.prims].sort().join(",");
    if (node.obj) {
      sig += "|o:" + node.obj.props.map(function (p) {
        return p.key + (p.optional ? "?" : "") + "<" + shapeSignature(p.node) + ">";
      }).join(",");
    }
    if (node.arrSeen) sig += "|a:<" + (node.arr ? shapeSignature(node.arr) : "") + ">";
    return sig;
  }

  /** Collect every object shape in BFS order and assign type names. */
  function collectTypes(rootNode, rootName) {
    const types = [];          // [{ name, shape }]
    const nameByShape = new Map();
    const usedNames = new Map();
    const queue = [{ node: rootNode, wanted: rootName }];
    function assign(shapeNode, wanted) {
      const sig = shapeSignature(shapeNode);
      if (nameByShape.has(sig)) return nameByShape.get(sig);
      let name = wanted;
      let n = 2;
      while (usedNames.has(name) && usedNames.get(name) !== sig) {
        name = wanted + n;
        n++;
      }
      usedNames.set(name, sig);
      nameByShape.set(sig, name);
      types.push({ name: name, shape: shapeNode.obj });
      shapeNode.obj.props.forEach(function (p) {
        queue.push({ node: p.node, wanted: null, keyHint: p.key });
      });
      return name;
    }
    // BFS: name each newly seen object shape from its key hint.
    const seenNodes = [];
    function walk(node, wantedName, keyHint) {
      if (node.obj && !seenNodes.includes(node.obj)) {
        seenNodes.push(node.obj);
        assign(node, wantedName || singular(pascal(keyHint || "Item")));
      }
      if (node.arrSeen && node.arr) walk(node.arr, null, keyHint);
      if (node.obj) {
        node.obj.props.forEach(function (p) { walk(p.node, null, p.key); });
      }
    }
    walk(rootNode, rootName, null);
    return { types: types, nameOf: function (node) { return nameByShape.get(shapeSignature(node)); } };
  }

  /* ---------------- Per-language type names ---------------- */

  function tsType(node, ctx) {
    const parts = [];
    node.prims.forEach(function (p) {
      if (p === "string") parts.push("string");
      else if (p === "int" || p === "float") parts.push("number");
      else if (p === "bool") parts.push("boolean");
      else if (p === "null") parts.push("null");
    });
    if (node.obj) parts.push(ctx.nameOf(node));
    if (node.arrSeen) {
      const elem = node.arr ? tsType(node.arr, ctx) : "unknown";
      parts.push(elem.includes(" | ") ? "(" + elem + ")[]" : elem + "[]");
    }
    return parts.length ? [...new Set(parts)].join(" | ") : "unknown";
  }

  function goType(node, ctx) {
    const prims = [...node.prims].filter(function (p) { return p !== "null"; });
    const kinds = prims.length + (node.obj ? 1 : 0) + (node.arrSeen ? 1 : 0);
    if (kinds !== 1) return "interface{}";
    if (node.obj) return ctx.nameOf(node);
    if (node.arrSeen) return "[]" + (node.arr ? goType(node.arr, ctx) : "interface{}");
    const p = prims[0];
    if (p === "string") return "string";
    if (p === "bool") return "bool";
    if (p === "float") return "float64";
    if (p === "int") return "int64";
    return "interface{}";
  }

  function pyType(node, ctx) {
    const parts = [];
    node.prims.forEach(function (p) {
      if (p === "string") parts.push("str");
      else if (p === "int") parts.push("int");
      else if (p === "float") parts.push("float");
      else if (p === "bool") parts.push("bool");
    });
    if (node.obj) parts.push(ctx.nameOf(node));
    if (node.arrSeen) {
      parts.push("list[" + (node.arr ? pyType(node.arr, ctx) : "Any") + "]");
    }
    const hasNull = node.prims.has("null");
    if (!parts.length) return hasNull ? "None" : "Any";
    let core = parts.length === 1 ? parts[0] : "Union[" + parts.join(", ") + "]";
    if (hasNull) core = "Optional[" + core + "]";
    return core;
  }

  /* ---------------- Renderers ---------------- */

  function renderTs(ctx) {
    return ctx.types.map(function (t) {
      const lines = t.shape.props.map(function (p) {
        const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p.key) ? p.key : JSON.stringify(p.key);
        return "  " + key + (p.optional ? "?" : "") + ": " + tsType(p.node, ctx) + ";";
      });
      return "export interface " + t.name + " {\n" + lines.join("\n") + "\n}";
    }).join("\n\n");
  }

  function renderGo(ctx) {
    return ctx.types.map(function (t) {
      const lines = t.shape.props.map(function (p) {
        const field = pascal(p.key);
        const tag = "`json:\"" + p.key + (p.optional ? ",omitempty" : "") + "\"`";
        return "\t" + field + " " + goType(p.node, ctx) + " " + tag;
      });
      return "type " + t.name + " struct {\n" + lines.join("\n") + "\n}";
    }).join("\n\n");
  }

  function renderPy(ctx) {
    const blocks = ctx.types.map(function (t) {
      const required = t.shape.props.filter(function (p) { return !p.optional; });
      const optional = t.shape.props.filter(function (p) { return p.optional; });
      const fieldLine = function (p) {
        const name = /^[A-Za-z_][A-Za-z0-9_]*$/.test(p.key) ? p.key : "field_" + p.key.replace(/[^A-Za-z0-9]/g, "_");
        const type = pyType(p.node, ctx);
        if (p.optional) {
          const opt = type.startsWith("Optional[") ? type : "Optional[" + type + "]";
          return "    " + name + ": " + opt + " = None";
        }
        return "    " + name + ": " + type;
      };
      const ordered = required.concat(optional);
      return "@dataclass\nclass " + t.name + ":\n" + ordered.map(fieldLine).join("\n");
    });
    return "from dataclasses import dataclass\nfrom typing import Any, Optional, Union\n\n\n" + blocks.join("\n\n\n");
  }

  function generate(jsonText, lang, rootName) {
    const value = JSON.parse(jsonText);
    if (value === null || typeof value !== "object") {
      throw new Error("Paste a JSON object or array at the top level.");
    }
    const rootNode = infer(value);
    if (!rootNode.obj) {
      // Top-level array of objects: name the element type as root.
      if (rootNode.arrSeen && rootNode.arr && rootNode.arr.obj) {
        const ctx = collectTypes(rootNode.arr, rootName);
        if (lang === "go") return "// " + rootName + " is []" + rootName + "\n\n" + renderGo(ctx);
        if (lang === "python") return renderPy(ctx) + "\n\n# Root value: list[" + rootName + "]";
        return renderTs(ctx) + "\n\nexport type " + rootName + "List = " + rootName + "[];";
      }
      throw new Error("The sample has no object shape to turn into types.");
    }
    const ctx = collectTypes(rootNode, rootName);
    if (lang === "go") return renderGo(ctx);
    if (lang === "python") return renderPy(ctx);
    return renderTs(ctx);
  }

  DT.tools.jsontypes = {
    id: "jsontypes",
    name: "JSON to Types",
    category: "Data",
    icon: "code",
    description: "Turn a JSON sample into TypeScript, Go or Python types.",

    keywords: "json typescript interface go struct python dataclass types schema generate model",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const langSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-jt-lang" }, [
        dom.el("option", { value: "ts", text: "TypeScript" }),
        dom.el("option", { value: "go", text: "Go" }),
        dom.el("option", { value: "python", text: "Python" }),
      ]);
      langSel.style.width = "130px";
      const rootName = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-jt-root",
        value: "Root",
        autocomplete: "off",
        spellcheck: "false",
      });
      rootName.style.width = "130px";
      const btnGen = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Generate" });
      const btnSample = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Sample" });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Language" }),
          langSel,
          dom.el("span", { class: "dt-toolbar__label", text: "Root name" }),
          rootName,
          btnGen,
          btnSample,
        ]),
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-jt-input",
        rows: "8",
        spellcheck: "false",
        placeholder: "Paste a JSON object here…  (Ctrl+Enter to generate)",
      });
      const inputStats = DT.ui.panel.stats();
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("JSON sample", [DT.ui.panel.pasteBtn(input, function () { generate_now(); })]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [inputStats, DT.ui.panel.hint("Ctrl+Enter to generate")]),
      ]);
      const errorBox = DT.ui.panel.error(inputPanel);
      errorBox.el.id = "dt-jt-error";
      inputPanel.appendChild(errorBox.el);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-jt-output",
        rows: "10",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Generated types appear here…",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const btnDownload = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Download" });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Generated types", [btnCopy, btnDownload]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input, output, langSel, rootName, inputPanel, errorBox, inputStats };

      const EXT = { ts: "ts", go: "go", python: "py" };
      function showError(msg) {
        if (msg) errorBox.show("Cannot generate types", msg);
        else errorBox.clear();
      }
      function generate_now() {
        DT.ui.panel.paintStats(inputStats, input.value);
        if (!input.value.trim()) { showError(null); return; }
        try {
          const name = pascal(rootName.value || "Root");
          output.value = generate(input.value, langSel.value === "ts" ? "ts" : langSel.value, name);
          showError(null);
        } catch (e) {
          showError(e.message);
        }
      }

      on(input, "input", function () { DT.ui.panel.paintStats(inputStats, input.value); });
      on(input, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); generate_now(); }
      });
      on(btnGen, "click", generate_now);
      on(langSel, "change", generate_now);
      on(btnSample, "click", function () {
        input.value = JSON.stringify({
          id: 101,
          name: "Hamza",
          active: true,
          score: 9.5,
          tags: ["dev", "lead"],
          address: { city: "Lahore", zip: "54000" },
          orders: [
            { id: 1, total: 250 },
            { id: 2, total: 99, note: "gift" },
          ],
        }, null, 2);
        generate_now();
      });
      on(btnCopy, "click", function () {
        if (!output.value) { DT.ui.toast.info("Generate types first"); return; }
        DT.utils.clipboard.copy(output.value)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      on(btnDownload, "click", function () {
        if (!output.value) { DT.ui.toast.info("Generate types first"); return; }
        DT.utils.download.text(
          DT.utils.download.withTimestamp("types", EXT[langSel.value]),
          output.value,
          "text/plain;charset=utf-8",
        );
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
