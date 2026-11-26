// @t3tools/shared/composerContextClipboard 的等价物：把上下文片段同时写纯文本与 HTML。
export const COMPOSER_CONTEXT_CLIPBOARD_MIME = "application/x-tango-composer-context";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

export function encodeComposerContextClipboardHtml(value: string): string {
  return `<pre>${escapeHtml(value)}</pre>`;
}
