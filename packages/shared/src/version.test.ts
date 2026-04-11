import { describe, it, expect } from 'vitest';
import { APP_VERSION } from './version.js';

describe('APP_VERSION', () => {
  it('is a non-empty semver-ish string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
