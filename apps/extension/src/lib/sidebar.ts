import { browser } from 'wxt/browser';
import type { ButtonOpens } from './settings.ts';

// Firefox's sidebar API, which the Chrome types `browser` comes with don't cover.
interface SidebarAction {
  open(): Promise<void>;
  toggle(): Promise<void>;
}
const firefox = (browser as unknown as { sidebarAction?: SidebarAction }).sidebarAction;
const chrome = browser.sidePanel as typeof browser.sidePanel | undefined;

/** Whether this browser has a sidebar. Firefox for Android doesn't. */
export const hasSidebar = (): boolean => !!(firefox || chrome);

/**
 * Opens the sidebar in window `windowId`. Browsers only allow it in response to something the
 * reader did, so it has to be called straight away, without awaiting anything first.
 */
export function openSidebar(windowId: number): Promise<void> {
  if (firefox) return firefox.open();
  return chrome ? chrome.open({ windowId }) : Promise.resolve();
}

/** Makes penciled's toolbar button open the popup or the sidebar. */
export async function setButton(opens: ButtonOpens): Promise<void> {
  const sidebar = opens === 'sidebar' && hasSidebar();
  // Without a popup, clicking the button opens Chrome's side panel, or fires `onClicked` in Firefox.
  await browser.action.setPopup({ popup: sidebar ? '' : 'popup.html' });
  await chrome?.setPanelBehavior({ openPanelOnActionClick: sidebar });
}

/** Makes the toolbar button, when it has no popup, toggle Firefox's sidebar. */
export function onButtonClicked(): void {
  if (firefox) browser.action.onClicked.addListener(() => firefox.toggle());
}

/**
 * Opens or closes the sidebar in window `windowId`, from the keyboard shortcut. Chrome can't tell
 * whether its side panel is open, so `close` is called with the window's open sidebar, if any.
 */
export function toggleSidebar(windowId: number, close?: () => void): void {
  if (firefox) firefox.toggle();
  else if (close) close();
  else openSidebar(windowId).catch(() => {});
}

/** Sidebars connect to the background on this port, named after their window. */
export const PORT = 'sidebar';
