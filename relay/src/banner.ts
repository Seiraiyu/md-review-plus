import type { Campaign } from './sponsors';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderBanner(c: Campaign): string {
  const id = esc(c.id);
  const name = esc(c.name);
  const tagline = esc(c.tagline);
  const ctaLabel = c.id === 'house' ? 'Advertise here &rarr;' : `Visit ${name} &rarr;`;
  return `
<aside class="mdrp-banner" aria-label="Sponsored content" data-campaign="${id}">
  <div class="mdrp-banner-inner">
    <span class="mdrp-banner-label">SPONSOR</span>
    <span class="mdrp-banner-name">${name}</span>
    <span class="mdrp-banner-sep">·</span>
    <span class="mdrp-banner-tagline">${tagline}</span>
    <span class="mdrp-banner-spacer"></span>
    <a class="mdrp-banner-cta" href="/go/${id}" rel="sponsored noopener" target="_blank">${ctaLabel}</a>
    <button class="mdrp-banner-dismiss" type="button" aria-label="Dismiss sponsor banner">&times;</button>
  </div>
  <script>
    (function () {
      try {
        var key = 'mdrp_banner_dismissed_${id}';
        var b = document.currentScript && document.currentScript.closest('.mdrp-banner');
        if (sessionStorage.getItem(key) === '1') {
          if (b) b.style.display = 'none';
          return;
        }
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/sponsors/impression', JSON.stringify({"c":"${id}"}));
        } else {
          fetch('/api/sponsors/impression', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({"c":"${id}"}), keepalive: true });
        }
        var x = b && b.querySelector('.mdrp-banner-dismiss');
        if (x) x.addEventListener('click', function () {
          sessionStorage.setItem(key, '1');
          if (b) b.style.display = 'none';
        });
      } catch (e) { /* no-op */ }
    })();
  </script>
</aside>
`;
}
