import type { Campaign } from './sponsors';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Scoped CSS shipped alongside the banner markup so styling works on any host
// page (landing, error, advertise, and the SPA's index.html — which has no
// `.mdrp-banner` rules of its own).
const BANNER_CSS = `
.mdrp-banner {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #08090d;
  color: #fff;
  border-bottom: 1px solid #1f232c;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.mdrp-banner-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 18px 24px;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.45;
  flex-wrap: wrap;
  text-align: center;
}
.mdrp-banner-label {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: #6f7785;
  font-weight: 700;
  text-transform: uppercase;
}
.mdrp-banner-name {
  font-weight: 700;
  color: #fff;
}
.mdrp-banner-sep {
  color: #3a404c;
}
.mdrp-banner-tagline {
  color: #c8ccd4;
}
.mdrp-banner-cta {
  display: inline-block;
  padding: 7px 16px;
  border-radius: 6px;
  background: #00d4aa;
  color: #001813;
  font-weight: 600;
  text-decoration: none;
  font-size: 13px;
}
.mdrp-banner-cta:hover {
  background: #00b894;
  text-decoration: none;
}
.mdrp-banner-dismiss {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 0;
  color: #6f7785;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 4px 8px;
}
.mdrp-banner-dismiss:hover {
  color: #fff;
}
.mdrp-banner { position: sticky; }
.mdrp-banner-inner { position: relative; }
@media (max-width: 720px) {
  .mdrp-banner-inner {
    flex-direction: column;
    gap: 8px;
    padding: 16px 44px 16px 20px;
    min-height: 0;
  }
  .mdrp-banner-cta {
    align-self: stretch;
    text-align: center;
  }
}
`;

export function renderBanner(c: Campaign): string {
  const id = esc(c.id);
  const name = esc(c.name);
  const tagline = esc(c.tagline);
  const ctaLabel = c.id === 'house' ? 'Advertise here &rarr;' : `Visit ${name} &rarr;`;
  return `
<style>${BANNER_CSS}</style>
<aside class="mdrp-banner" aria-label="Sponsored content" data-campaign="${id}">
  <div class="mdrp-banner-inner">
    <span class="mdrp-banner-label">SPONSOR</span>
    <span class="mdrp-banner-name">${name}</span>
    <span class="mdrp-banner-sep">·</span>
    <span class="mdrp-banner-tagline">${tagline}</span>
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
