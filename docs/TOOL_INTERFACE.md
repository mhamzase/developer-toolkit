# Tool Interface Contract

Every tool file in js/tools/ must register itself like this:

(function () {
  const DT = window.DT = window.DT || {};
  DT.tools = DT.tools || {};

  DT.tools.json = {
    id: 'json',
    name: 'JSON Formatter',
    category: 'Data',
    icon: 'braces',
    description: 'Format, validate, and minify JSON.',
    keywords: 'format validate minify beautify parse lint', // search + palette matching

    mount(container) {
      // build UI inside `container`, attach listeners
    },

    unmount() {
      // clean up listeners/timers
    }
  };
})();

Rules:
- Always include `keywords`: the extra words a user might search for
  (synonyms, abbreviations, file formats). Registry search and the
  command palette match against name, description, category, keywords.
- Never touch DOM outside your container.
- Never use innerHTML with user data.
- Always clean up in unmount().
- All processing is local — no network.