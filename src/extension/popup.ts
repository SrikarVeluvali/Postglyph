const enabled = document.getElementById('enabled') as HTMLInputElement;
const token = document.getElementById('token') as HTMLInputElement;
const save = document.getElementById('save') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLParagraphElement;
const pageStatus = document.getElementById('page-status') as HTMLParagraphElement;

async function refreshPageStatus(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { pageStatus.textContent = 'Page: no active tab found.'; return; }
  try {
    const page = await chrome.tabs.sendMessage(tab.id, { type: 'diagnostics' });
    pageStatus.textContent = !page.onFeed
      ? 'Page: open the LinkedIn Home feed.'
      : !page.enabled
        ? 'Page: classification is paused.'
        : page.cards === 0
          ? 'Page: no feed cards detected.'
          : page.readable === 0
            ? `Page: ${page.cards} cards found, but no readable post text.`
            : page.lastError
              ? `Page: ${page.readable} readable posts. ${page.lastError}`
              : `Page: ${page.readable} readable posts, ${page.badges} badges.`;
  } catch {
    pageStatus.textContent = 'Page: content script not attached. Refresh the LinkedIn tab.';
  }
}

async function refresh(): Promise<void> {
  try {
    const state = await chrome.runtime.sendMessage({ type: 'status' });
    enabled.checked = state.enabled;
    status.textContent = !state.helperOnline
      ? 'Helper offline. Start it with npm run start.'
      : !state.tokenConfigured
        ? 'Helper online. Paste its token to begin.'
        : !state.tokenValid
          ? 'Token rejected. Paste the token printed by the helper.'
          : state.enabled ? 'Ready to classify LinkedIn posts.' : 'Classification paused.';
  } catch {
    status.textContent = 'Unable to check the local helper.';
  }
  await refreshPageStatus();
}

enabled.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabled.checked });
  await refresh();
});

save.addEventListener('click', async () => {
  const value = token.value.trim();
  if (!value) { status.textContent = 'Paste the token printed by the helper.'; return; }
  await chrome.storage.local.set({ localToken: value });
  token.value = '';
  await refresh();
});

void refresh();
