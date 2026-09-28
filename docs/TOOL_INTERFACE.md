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

    mount(container) {
      // build UI inside `container`, attach listeners
    },

    unmount() {
      // clean up listeners/timers
    }
  };
})();

Rules:
- Never touch DOM outside your container.
- Never use innerHTML with user data.
- Always clean up in unmount().
- All processing is local — no network.