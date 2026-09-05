import { describe, expect, it } from 'vitest';
import { normalizeBaseUrl, parseSterlingError, redactToken } from '../src/oms/client.js';

describe('normalizeBaseUrl', () => {
  it('appends the REST root to a bare host', () => {
    expect(normalizeBaseUrl('https://oms.example.com')).toBe('https://oms.example.com/smcfs/restapi');
  });

  it('handles a trailing slash', () => {
    expect(normalizeBaseUrl('https://oms.example.com/')).toBe('https://oms.example.com/smcfs/restapi');
  });

  it('does not double up when /smcfs is already present', () => {
    // This is what caused the original HTTP 302: /smcfs/smcfs/restapi
    expect(normalizeBaseUrl('https://oms.example.com/smcfs')).toBe('https://oms.example.com/smcfs/restapi');
    expect(normalizeBaseUrl('https://oms.example.com/smcfs/')).toBe('https://oms.example.com/smcfs/restapi');
  });

  it('does not double up when /smcfs/restapi is already present', () => {
    expect(normalizeBaseUrl('https://oms.example.com/smcfs/restapi')).toBe(
      'https://oms.example.com/smcfs/restapi',
    );
  });
});

describe('parseSterlingError', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Errors>
    <Error ErrorCode="YCP0427"
        ErrorDescription="Cannot invoke API because user is not authenticated."
        ErrorUniqueExceptionId="" HttpCode="400"/>
</Errors>`;

  const json = JSON.stringify({
    errors: [
      {
        ErrorDescription: 'Cannot invoke API because user is not authenticated.',
        ErrorUniqueExceptionId: null,
        ErrorCode: 'YCP0427',
        httpcode: 400,
      },
    ],
  });

  it('reads the code and description from an XML error body', () => {
    const error = parseSterlingError(xml, 400);
    expect(error.code).toBe('YCP0427');
    expect(error.description).toContain('not authenticated');
    expect(error.httpCode).toBe(400);
  });

  it('reads the code and description from a JSON error body', () => {
    const error = parseSterlingError(json, 400);
    expect(error.code).toBe('YCP0427');
    expect(error.description).toContain('not authenticated');
  });

  it('flags YCP0427 as an auth error so the caller re-logs in', () => {
    expect(parseSterlingError(xml, 400).isAuthError).toBe(true);
    expect(parseSterlingError(json, 400).isAuthError).toBe(true);
  });

  it('does not flag other Sterling errors as auth errors', () => {
    const other = '<Errors><Error ErrorCode="YCP0428" ErrorDescription="API security violation."/></Errors>';
    const error = parseSterlingError(other, 400);
    expect(error.code).toBe('YCP0428');
    expect(error.isAuthError).toBe(false);
  });

  it('falls back to an HTTP code when the body is not a Sterling error', () => {
    const error = parseSterlingError('<html>502 Bad Gateway</html>', 502);
    expect(error.code).toBe('HTTP_502');
    expect(error.isAuthError).toBe(false);
  });
});

describe('redactToken', () => {
  it('never prints a full token', () => {
    const redacted = redactToken('0VXMVgZyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd');
    expect(redacted).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(redacted).toContain('48 chars');
  });

  it('hides short tokens entirely', () => {
    expect(redactToken('abc')).toBe('***');
  });
});