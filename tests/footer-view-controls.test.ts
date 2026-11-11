import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import type { Univer } from '@univerjs/core';
import { moveViewControlsToFooter } from '../src/features/spreadsheet/univer/footer-view-controls';

describe('footer view controls', () => {
  it('keeps the native freeze choices and fullscreen command while hiding the View controls', async () => {
    const freeze = { id: 'sheet.toolbar.sheet-frozen', type: 3, selections: [{ id: 'freeze-row', value: 'freeze-row' }], hidden$: of(false) };
    const fullscreen = { id: 'base-ui.operation.toggle-fullscreen', type: 0, hidden$: of(false) };
    const mergeMenu = vi.fn();
    const menus = { getMenuByPositionKey: () => [
      { key: 'ribbon.view.display', children: [{ key: freeze.id, order: 0, item: freeze }] },
      { key: 'ribbon.view.Visibility', children: [{ key: fullscreen.id, order: 1, item: fullscreen }] },
    ], mergeMenu };
    moveViewControlsToFooter({ __getInjector: () => ({ get: () => menus }) } as unknown as Univer);
    const schema = mergeMenu.mock.calls[0][0];
    const footer = schema['contextMenu.footerMenu']['nearsheets.footer.view'];
    expect(footer['nearsheets.footer.freeze'].menuItemFactory().selections).toEqual(freeze.selections);
    expect(footer['nearsheets.footer.fullscreen'].menuItemFactory().commandId).toBe(fullscreen.id);
    expect(await firstValueFrom(schema.ribbon['ribbon.view']['ribbon.view.display'][freeze.id].menuItemFactory().hidden$)).toBe(true);
    expect(await firstValueFrom(footer['nearsheets.footer.freeze'].menuItemFactory().hidden$)).toBe(false);
  });
});
