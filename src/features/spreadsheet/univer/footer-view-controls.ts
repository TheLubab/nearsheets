import { of } from 'rxjs';
import { IMenuManagerService } from '@univerjs/preset-sheets-core';
import type { MenuSchemaType } from '@univerjs/preset-sheets-core';
import type { Univer } from '@univerjs/core';

/** Reuse Univer's own menu items, including selection-aware freeze options. */
export function moveViewControlsToFooter(univer: Univer) {
  const menus = univer.__getInjector().get(IMenuManagerService);
  const groups = menus.getMenuByPositionKey('ribbon.view');
  const items = groups.flatMap(group => group.children ?? []).filter(node => node.item);
  const freeze = items.find(node => node.item?.id === 'sheet.toolbar.sheet-frozen')?.item;
  const fullscreen = items.find(node => node.item?.id === 'base-ui.operation.toggle-fullscreen')?.item;
  if (!freeze || !fullscreen) throw new Error('Univer View controls are unavailable.');

  const view: Record<string, MenuSchemaType> = {};
  for (const group of groups) {
    const hidden: Record<string, MenuSchemaType> = {};
    for (const node of group.children ?? []) {
      if (node.item) {
        const item = node.item;
        hidden[node.key] = { order: node.order, menuItemFactory: () => ({ ...item, hidden$: of(true) }) };
      }
    }
    view[group.key] = hidden;
  }
  menus.mergeMenu({
    'contextMenu.footerMenu': { 'nearsheets.footer.view': {
      order: 10,
      'nearsheets.footer.fullscreen': { order: 0, menuItemFactory: () => ({ ...fullscreen, id: 'nearsheets.footer.fullscreen', commandId: fullscreen.id }) },
      'nearsheets.footer.freeze': { order: 1, menuItemFactory: () => ({ ...freeze, id: 'nearsheets.footer.freeze' }) },
    } },
    ribbon: { 'ribbon.view': view },
  });
}
