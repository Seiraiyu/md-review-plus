// Accept: 127.0.0.1, localhost, 0.0.0.0, ::, ::1, IPv4 dotted-quad, simple IPv6.
// Reject: empty, garbage, hostnames (DNS), URLs.
export function validateHost(host) {
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return null;
  if (host === '::1' || host === '::') return null;

  // IPv4 dotted-quad
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const ok = host.split('.').every((o) => {
      const n = parseInt(o, 10);
      return n >= 0 && n <= 255;
    });
    return ok ? null : `Invalid IPv4 address: ${host}`;
  }

  // Simple IPv6 (permissive: hex chars + at least one colon)
  if (/^[0-9a-fA-F:]+$/.test(host) && host.includes(':')) return null;

  return `Invalid --host value: ${host}. Use 127.0.0.1, localhost, 0.0.0.0, or an explicit IP.`;
}
