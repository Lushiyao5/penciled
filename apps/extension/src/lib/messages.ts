import { browser } from 'wxt/browser';
import type { PaletteColor } from './settings.ts';

/** What the popup and the sidebar ask a tab's content script. */
export type Request =
  | { type: 'state' }
  | { type: 'focus'; id: string }
  | { type: 'remove'; id: string }
  /** Turns penciled on or off for the tab's whole site. */
  | { type: 'site'; enabled: boolean }
  /** From the keyboard shortcut: hides or shows penciled on this tab. */
  | { type: 'toggle' };

/** An annotation as the popup and the sidebar list it. */
export interface Item {
  id: string;
  quote: string;
  note?: string;
  color: string;
  /** Its text couldn't be found on the page, so it isn't painted. */
  orphan: boolean;
}

/** A tab's penciled, as the popup and the sidebar show it. */
export interface PageState {
  site: string;
  /** The id the page's annotations are stored under. */
  page: string;
  title: string;
  /** Turned off for the whole site. */
  disabled: boolean;
  /** Hidden on this tab with the keyboard shortcut. */
  hidden: boolean;
  items: Item[];
  colors: PaletteColor[];
}

/** Sends `request` to the content script in tab `tabId`. Rejects where it can't run. */
export function ask<T = PageState>(tabId: number, request: Request): Promise<T> {
  return browser.tabs.sendMessage(tabId, request) as Promise<T>;
}
