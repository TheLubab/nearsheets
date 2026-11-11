import { describe, expect, it } from 'vitest';
import { APP_TOASTER_ID, scopeToastData } from '../src/components/ui/toast';

describe('application toast scoping', () => {
  // Regression: Univer 1.4 mounts its own Sonner <Toaster>. An untagged toast
  // rendered in both toasters, producing two overlapping copies.
  it('tags toasts with the application toaster id', () => {
    expect(scopeToastData().toasterId).toBe(APP_TOASTER_ID);
  });

  it('keeps the caller data intact', () => {
    const data = scopeToastData({ id: 'nearsheets.engine', duration: 1000 });
    expect(data).toEqual({
      id: 'nearsheets.engine',
      duration: 1000,
      toasterId: APP_TOASTER_ID,
    });
  });

  it('cannot have its scope widened by caller data', () => {
    // TypeScript already rejects `toasterId`; guard the runtime path too.
    const data = scopeToastData({ toasterId: 'univer' } as never);
    expect(data.toasterId).toBe(APP_TOASTER_ID);
  });
});