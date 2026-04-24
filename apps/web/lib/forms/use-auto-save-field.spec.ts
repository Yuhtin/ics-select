import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAutoSaveDriver } from './use-auto-save-field';

beforeEach(() => { vi.useFakeTimers(); });

describe('createAutoSaveDriver', () => {
  it('debounces save until quiet for debounceMs', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ initial: '', save, debounceMs: 800 });

    driver.onChange('a');
    driver.onChange('ab');
    driver.onChange('abc');
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledWith('abc');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('onBlur flushes pending save immediately', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ initial: '', save, debounceMs: 800 });

    driver.onChange('hello');
    driver.onBlur();
    expect(save).toHaveBeenCalledWith('hello');
  });

  it('validate false suppresses the save call', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({
      initial: '',
      save,
      debounceMs: 800,
      validate: (v: string) => v.length >= 3,
    });

    driver.onChange('ab');
    vi.advanceTimersByTime(800);
    expect(save).not.toHaveBeenCalled();

    driver.onChange('abc');
    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledWith('abc');
  });

  it('dispose flushes pending save on unmount', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ initial: '', save, debounceMs: 800 });

    driver.onChange('pending');
    driver.dispose();
    expect(save).toHaveBeenCalledWith('pending');
  });

  it('does not fire save when value equals the last-saved value', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ initial: 'hello', save, debounceMs: 800 });

    driver.onChange('hello');
    vi.advanceTimersByTime(800);
    expect(save).not.toHaveBeenCalled();

    driver.onChange('world');
    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledWith('world');
  });
});
