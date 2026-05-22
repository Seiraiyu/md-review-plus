// Source string for the window.mdrp IIFE. Injected verbatim into iframe srcdoc.
// Kept as a plain string (not bundled) so the contents land inside the sandboxed
// document untouched.
export const MDRP_SHIM_SOURCE = `
(function (w) {
  if (w.mdrp) return;
  var finalized = false;
  function post(type, payload) {
    try {
      w.parent.postMessage(Object.assign({ type: type, v: 1 }, payload), '*');
    } catch (e) { /* sandboxed; nothing to do */ }
  }
  w.mdrp = {
    version: 1,
    ready: function (m) {
      m = m || {};
      post('mdrp.ready', {
        title: m.title || null,
        chrome: m.chrome || 'host',
        sections: m.sections || [],
        schema: m.schema || {}
      });
    },
    update: function (state) { post('mdrp.update', { state: state }); },
    setSectionStatus: function (sectionId, status) {
      post('mdrp.section', { sectionId: sectionId, status: status });
    },
    addComment: function (c) {
      c = c || {};
      post('mdrp.comment', {
        sectionId: c.sectionId || null,
        anchor: c.anchor || null,
        text: c.text
      });
    },
    addReaction: function (r) {
      r = r || {};
      post('mdrp.reaction', {
        targetId: r.targetId || null,
        emoji: r.emoji
      });
    },
    askQuestion: function (q) {
      q = q || {};
      post('mdrp.question', {
        sectionId: q.sectionId || null,
        anchor: q.anchor || null,
        text: q.text
      });
    },
    submit: function (state) {
      if (finalized) return;
      finalized = true;
      post('mdrp.submit', { state: state === undefined ? null : state });
    }
  };
})(window);
`;

export function buildSrcdoc(artifactHtml: string): string {
  // CSP physically blocks network access; only inline scripts/styles run.
  const csp =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:;";
  return [
    '<!doctype html>',
    '<html><head>',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<script>${MDRP_SHIM_SOURCE}</script>`,
    '</head><body>',
    artifactHtml,
    '</body></html>',
  ].join('\n');
}
