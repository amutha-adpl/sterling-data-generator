/**
 * Copy text to the clipboard.
 *
 * `navigator.clipboard` only exists in a secure context (https or localhost),
 * so opening the app over plain http on a LAN address makes it undefined and
 * the Copy button silently does nothing. Fall back to a hidden textarea and
 * `document.execCommand('copy')`, which still works there.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the textarea approach
    }
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}