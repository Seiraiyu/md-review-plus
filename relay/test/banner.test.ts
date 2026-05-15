import { describe, it, expect } from 'bun:test';
import { renderBanner } from '../src/banner';

describe('renderBanner', () => {
  it('emits HTML containing campaign name, tagline, click path, and impression beacon', () => {
    const html = renderBanner({
      id: 'kisenon-launch',
      name: 'Kisenon',
      tagline: 'Sleeps well',
      clickUrl: 'https://kisenon.com',
    });
    expect(html).toContain('Kisenon');
    expect(html).toContain('Sleeps well');
    expect(html).toContain('/go/kisenon-launch');
    expect(html).toContain('navigator.sendBeacon');
    expect(html).toContain('"c":"kisenon-launch"');
  });

  it('escapes HTML in campaign fields', () => {
    const html = renderBanner({
      id: 'x',
      name: '<script>evil</script>',
      tagline: '"hi"',
      clickUrl: 'https://x',
    });
    expect(html).not.toContain('<script>evil</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
