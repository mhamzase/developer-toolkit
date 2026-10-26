/**
 * File: js/tools/metatags.js
 * Module: Tool — Meta Tag Generator
 * Purpose: Build the <head> block for a page: title, description,
 *          canonical, robots, Open Graph and Twitter cards, with
 *          live character counters against the usual SEO limits
 *          and a simple social preview card.
 * Notes: All processing local. Values are escaped for attributes.
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

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  DT.tools.metatags = {
    id: "metatags",
    name: "Meta Tag Generator",
    category: "Text",
    icon: "code",
    description: "SEO, Open Graph and Twitter meta tags, generated live.",

    keywords: "meta tags seo open graph og twitter card title description head generator social",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      function textField(id, label, placeholder, hint) {
        const input = dom.el("input", {
          type: "text",
          class: "dt-input",
          id: id,
          autocomplete: "off",
          spellcheck: "false",
          placeholder: placeholder || "",
        });
        const counter = dom.el("span", { class: "dt-help", text: "" });
        const wrap = dom.el("div", { class: "dt-field" }, [
          dom.el("label", { class: "dt-label", for: id, text: label }),
          input,
          dom.el("div", { style: { display: "flex", justifyContent: "space-between" } }, [
            dom.el("span", { class: "dt-help", text: hint || "" }),
            counter,
          ]),
        ]);
        return { wrap: wrap, input: input, counter: counter };
      }

      const fTitle = textField("dt-meta-title", "Page title", "My Page Title", "Shown in search results and the tab");
      const fDesc = textField("dt-meta-desc", "Description", "A short, honest summary of the page", "The snippet under the title in search results");
      const fUrl = textField("dt-meta-url", "Canonical URL", "https://example.com/page");
      const fSite = textField("dt-meta-site", "Site name", "Example Site");
      const fImage = textField("dt-meta-image", "Social image URL", "https://example.com/og.jpg", "1200x630 works best");
      const fAuthor = textField("dt-meta-author", "Author", "Jane Doe");
      const fHandle = textField("dt-meta-handle", "Twitter handle", "@yourhandle");
      const fColor = textField("dt-meta-color", "Theme color", "#0f172a");

      const typeSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-meta-type" }, [
        dom.el("option", { value: "website", text: "website" }),
        dom.el("option", { value: "article", text: "article" }),
        dom.el("option", { value: "product", text: "product" }),
        dom.el("option", { value: "profile", text: "profile" }),
      ]);
      const cardSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-meta-card" }, [
        dom.el("option", { value: "summary_large_image", text: "summary_large_image" }),
        dom.el("option", { value: "summary", text: "summary" }),
      ]);
      const robotsSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-meta-robots" }, [
        dom.el("option", { value: "index, follow", text: "index, follow" }),
        dom.el("option", { value: "noindex, follow", text: "noindex, follow" }),
        dom.el("option", { value: "index, nofollow", text: "index, nofollow" }),
        dom.el("option", { value: "noindex, nofollow", text: "noindex, nofollow" }),
      ]);
      [typeSel, cardSel, robotsSel].forEach(function (s) { s.style.width = "180px"; });

      const selectsRow = dom.el("div", { class: "dt-toolbar", style: { gap: "14px", flexWrap: "wrap" } }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Page type" }),
          typeSel,
        ]),
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Twitter card" }),
          cardSel,
        ]),
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Robots" }),
          robotsSel,
        ]),
      ]);

      const formPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Page details" }),
        ]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [
          fTitle.wrap, fDesc.wrap, fUrl.wrap, fSite.wrap, fImage.wrap,
          dom.el("div", { class: "dt-form-grid" }, [fAuthor.wrap, fHandle.wrap, fColor.wrap]),
          selectsRow,
        ]),
      ]);

      /* Social preview card */
      const pvImg = dom.el("img", { class: "dt-og-card__img", alt: "" });
      const pvSite = dom.el("div", { class: "dt-og-card__site", text: "example.com" });
      const pvTitle = dom.el("div", { class: "dt-og-card__title", text: "Your title appears here" });
      const pvDesc = dom.el("div", { class: "dt-og-card__desc", text: "Your description appears here, the way a social feed would show it." });
      const preview = dom.el("div", { class: "dt-og-card" }, [
        pvImg,
        dom.el("div", { class: "dt-og-card__body" }, [pvSite, pvTitle, pvDesc]),
      ]);
      const previewPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Social preview" }),
        ]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [preview]),
      ]);

      /* Output */
      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-meta-output",
        rows: "14",
        spellcheck: "false",
        readonly: "readonly",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy tags" });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () => "meta-tags.html",
        mime: "text/html;charset=utf-8",
        label: "Download",
      });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Generated <head> tags", [btnCopy, btnDownload]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
      ]);

      workspace.appendChild(formPanel);
      workspace.appendChild(previewPanel);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = {
        output,
        fields: { title: fTitle, desc: fDesc, url: fUrl, site: fSite, image: fImage, author: fAuthor, handle: fHandle, color: fColor },
        typeSel, cardSel, robotsSel, pvImg, pvSite, pvTitle, pvDesc,
      };

      function counter(field, limit) {
        const len = field.input.value.length;
        field.counter.textContent = len + " / " + limit;
        field.counter.style.color = len === 0 ? "" : len <= limit ? "var(--color-success)" : "var(--color-danger)";
        field.counter.style.fontWeight = len > limit ? "600" : "";
      }

      function generate() {
        const v = {
          title: fTitle.input.value.trim(),
          desc: fDesc.input.value.trim(),
          url: fUrl.input.value.trim(),
          site: fSite.input.value.trim(),
          image: fImage.input.value.trim(),
          author: fAuthor.input.value.trim(),
          handle: fHandle.input.value.trim(),
          color: fColor.input.value.trim(),
        };
        counter(fTitle, 60);
        counter(fDesc, 160);

        const lines = [];
        lines.push('<meta charset="UTF-8">');
        lines.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
        if (v.title) lines.push("<title>" + esc(v.title) + "</title>");
        if (v.desc) lines.push('<meta name="description" content="' + esc(v.desc) + '">');
        if (v.author) lines.push('<meta name="author" content="' + esc(v.author) + '">');
        lines.push('<meta name="robots" content="' + robotsSel.value + '">');
        if (v.url) lines.push('<link rel="canonical" href="' + esc(v.url) + '">');
        if (v.color) lines.push('<meta name="theme-color" content="' + esc(v.color) + '">');
        lines.push("");
        lines.push("<!-- Open Graph -->");
        lines.push('<meta property="og:type" content="' + typeSel.value + '">');
        if (v.site) lines.push('<meta property="og:site_name" content="' + esc(v.site) + '">');
        if (v.title) lines.push('<meta property="og:title" content="' + esc(v.title) + '">');
        if (v.desc) lines.push('<meta property="og:description" content="' + esc(v.desc) + '">');
        if (v.url) lines.push('<meta property="og:url" content="' + esc(v.url) + '">');
        if (v.image) lines.push('<meta property="og:image" content="' + esc(v.image) + '">');
        lines.push("");
        lines.push("<!-- Twitter -->");
        lines.push('<meta name="twitter:card" content="' + cardSel.value + '">');
        if (v.handle) lines.push('<meta name="twitter:site" content="' + esc(v.handle) + '">');
        if (v.title) lines.push('<meta name="twitter:title" content="' + esc(v.title) + '">');
        if (v.desc) lines.push('<meta name="twitter:description" content="' + esc(v.desc) + '">');
        if (v.image) lines.push('<meta name="twitter:image" content="' + esc(v.image) + '">');
        output.value = lines.join("\n");

        // Preview card
        pvTitle.textContent = v.title || "Your title appears here";
        pvDesc.textContent = v.desc || "Your description appears here, the way a social feed would show it.";
        let host = "example.com";
        try { if (v.url) host = new URL(v.url).hostname; } catch (e) { /* keep default */ }
        pvSite.textContent = (v.site || host).toUpperCase();
        if (v.image) {
          pvImg.src = v.image;
          pvImg.style.display = "";
        } else {
          pvImg.removeAttribute("src");
          pvImg.style.display = "none";
        }
      }

      [fTitle, fDesc, fUrl, fSite, fImage, fAuthor, fHandle, fColor].forEach(function (f) {
        on(f.input, "input", generate);
      });
      [typeSel, cardSel, robotsSel].forEach(function (s) {
        on(s, "change", generate);
      });
      on(btnCopy, "click", function () {
        DT.utils.clipboard.copy(output.value)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });

      generate();
      fTitle.input.focus();
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
