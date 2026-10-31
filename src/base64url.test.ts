import { describe, expect, it } from 'vitest';
import { base64url } from './base64url.js';

describe('base64url', () => {
  it('writes text and bytes without padding or the characters an address cannot hold', () => {
    expect(base64url('??>')).toBe('Pz8-');
    expect(base64url(new Uint8Array([255, 255]))).toBe('__8');
  });
});
