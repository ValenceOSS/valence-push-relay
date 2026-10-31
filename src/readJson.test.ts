import { describe, expect, it } from 'vitest';
import { readJson } from './readJson.js';

describe('readJson', () => {
  it('reads JSON, and answers nothing for anything else', () => {
    expect(readJson('{"a":1}')).toEqual({ a: 1 });
    expect(readJson('not json')).toBeNull();
  });
});
