import { describe, it, expect } from 'vitest';
import { validateHost } from './host-validate.js';

describe('validateHost', () => {
  it('accepts loopback names', () => {
    expect(validateHost('127.0.0.1')).toBeNull();
    expect(validateHost('localhost')).toBeNull();
    expect(validateHost('::1')).toBeNull();
  });

  it('accepts 0.0.0.0 (LAN opt-in)', () => {
    expect(validateHost('0.0.0.0')).toBeNull();
    expect(validateHost('::')).toBeNull();
  });

  it('accepts valid IPv4 addresses', () => {
    expect(validateHost('192.168.1.10')).toBeNull();
    expect(validateHost('10.0.0.1')).toBeNull();
  });

  it('rejects IPv4 with out-of-range octet', () => {
    expect(validateHost('256.0.0.1')).toMatch(/Invalid IPv4/);
    expect(validateHost('1.2.3.999')).toMatch(/Invalid IPv4/);
  });

  it('rejects garbage strings', () => {
    expect(validateHost('not-a-host')).toMatch(/Invalid --host/);
    expect(validateHost('')).toMatch(/Invalid --host/);
    expect(validateHost('javascript:alert(1)')).toMatch(/Invalid --host/);
  });

  it('accepts simple IPv6', () => {
    expect(validateHost('fe80::1')).toBeNull();
    expect(validateHost('2001:db8::1')).toBeNull();
  });
});
