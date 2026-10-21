import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command, tab) => {
    // Pages where penciled can't run (the browser's own) have no one to receive it.
    if (command === 'toggle' && tab?.id)
      browser.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
  });
});
