import { describe, it, expect, vi } from 'vitest';
import { MDRP_SHIM_SOURCE, buildSrcdoc } from './shim';

interface MdrpShim {
  version: number;
  ready: (m: {
    title?: string;
    chrome?: 'host' | 'none';
    sections?: Array<{ id: string; heading: string }>;
    schema?: Record<string, unknown>;
  }) => void;
  update: (state: unknown) => void;
  setSectionStatus: (sectionId: string, status: 'approved' | 'rejected' | 'pending') => void;
  addComment: (c: { sectionId?: string | null; anchor?: string | null; text: string }) => void;
  submit: (state?: unknown) => void;
}

interface MockWindow {
  parent: { postMessage: ReturnType<typeof vi.fn> };
  mdrp?: MdrpShim;
}

function installShim(): MockWindow {
  const win: MockWindow = { parent: { postMessage: vi.fn() } };
  new Function('window', MDRP_SHIM_SOURCE)(win);
  return win;
}

describe('MDRP_SHIM_SOURCE', () => {
  it('exposes window.mdrp v1 with ready/update/submit/setSectionStatus/addComment', () => {
    const win = installShim();
    expect(win.mdrp).toBeDefined();
    const shim = win.mdrp as MdrpShim;
    expect(shim.version).toBe(1);
    expect(typeof shim.ready).toBe('function');
    expect(typeof shim.update).toBe('function');
    expect(typeof shim.submit).toBe('function');
    expect(typeof shim.setSectionStatus).toBe('function');
    expect(typeof shim.addComment).toBe('function');
  });

  it('mdrp.ready posts mdrp.ready envelope', () => {
    const win = installShim();
    (win.mdrp as MdrpShim).ready({
      title: 'X',
      chrome: 'host',
      sections: [{ id: 's1', heading: 'one' }],
    });
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'mdrp.ready',
        v: 1,
        title: 'X',
        chrome: 'host',
        sections: [{ id: 's1', heading: 'one' }],
      }),
      '*',
    );
  });

  it('mdrp.ready defaults chrome to host and sections to []', () => {
    const win = installShim();
    (win.mdrp as MdrpShim).ready({ title: 'no-chrome' });
    const [msg] = win.parent.postMessage.mock.calls[0];
    expect(msg.chrome).toBe('host');
    expect(msg.sections).toEqual([]);
  });

  it('mdrp.update posts mdrp.update envelope', () => {
    const win = installShim();
    (win.mdrp as MdrpShim).update({ slider: 50 });
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { type: 'mdrp.update', v: 1, state: { slider: 50 } },
      '*',
    );
  });

  it('mdrp.setSectionStatus posts mdrp.section envelope', () => {
    const win = installShim();
    (win.mdrp as MdrpShim).setSectionStatus('s1', 'approved');
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { type: 'mdrp.section', v: 1, sectionId: 's1', status: 'approved' },
      '*',
    );
  });

  it('mdrp.addComment posts mdrp.comment envelope', () => {
    const win = installShim();
    (win.mdrp as MdrpShim).addComment({ sectionId: 's1', anchor: 'line:5', text: 'hi' });
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { type: 'mdrp.comment', v: 1, sectionId: 's1', anchor: 'line:5', text: 'hi' },
      '*',
    );
  });

  it('mdrp.askQuestion posts mdrp.question envelope', () => {
    const win = installShim();
    (
      win.mdrp as MdrpShim & {
        askQuestion: (q: { sectionId?: string; anchor?: string; text: string }) => void;
      }
    ).askQuestion({ sectionId: 's1', text: 'why?' });
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { type: 'mdrp.question', v: 1, sectionId: 's1', anchor: null, text: 'why?' },
      '*',
    );
  });

  it('mdrp.addReaction posts mdrp.reaction envelope', () => {
    const win = installShim();
    (
      win.mdrp as MdrpShim & {
        addReaction: (r: { targetId?: string; emoji: string }) => void;
      }
    ).addReaction({ targetId: 's1', emoji: '👍' });
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { type: 'mdrp.reaction', v: 1, targetId: 's1', emoji: '👍' },
      '*',
    );
  });

  it('mdrp.submit is no-op on second call', () => {
    const win = installShim();
    (win.mdrp as MdrpShim).submit({ a: 1 });
    (win.mdrp as MdrpShim).submit({ a: 2 });
    const submitCalls = win.parent.postMessage.mock.calls.filter(
      ([m]) => (m as { type: string }).type === 'mdrp.submit',
    );
    expect(submitCalls).toHaveLength(1);
    expect((submitCalls[0][0] as { state: unknown }).state).toEqual({ a: 1 });
  });

  it('mdrp.submit normalizes undefined state to null', () => {
    const win = installShim();
    (win.mdrp as MdrpShim).submit();
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { type: 'mdrp.submit', v: 1, state: null },
      '*',
    );
  });
});

describe('buildSrcdoc', () => {
  it('embeds CSP and shim', () => {
    const s = buildSrcdoc('<div>x</div>');
    expect(s).toContain('Content-Security-Policy');
    expect(s).toContain("default-src 'none'");
    expect(s).toContain('w.mdrp');
    expect(s).toContain('(window)');
    expect(s).toContain('<div>x</div>');
  });

  it('embeds the artifact body untouched (caller responsibility)', () => {
    const s = buildSrcdoc('<script>x</script>');
    expect(s).toContain('<script>x</script>');
  });

  it('renders a complete html document', () => {
    const s = buildSrcdoc('<p>hi</p>');
    expect(s.trim().startsWith('<!doctype html>')).toBe(true);
    expect(s).toContain('</html>');
  });
});
