// 从 T3 的 hooks/useCopyToClipboard.ts 搬来，唯一改动是把 effect/Schema 的 TaggedError
// 换成普通 Error 子类（Tango 没有 Effect 运行时），其余行为与导出名保持一致。
import * as React from "react";
import { msg } from "gt-react";

import { m } from "../i18n/messages";
import { useStableCallback } from "./useStableCallback";
import { COMPOSER_CONTEXT_CLIPBOARD_MIME, encodeComposerContextClipboardHtml } from "../lib/composerContextClipboard";

/** `msg()` sentences, resolved when the error is shown, so users read whole ones. */
export interface ClipboardTarget {
  /** An English noun for logs. */
  readonly target: string;
  /** Shown when the clipboard API is missing. */
  readonly unavailableMessage: string;
  /** Shown when the browser rejects the copy or read. */
  readonly failureMessage: string;
}

/** Copying something the user named, such as a file: its name goes into the sentences as is. */
export function namedClipboardTarget(name: string): ClipboardTarget {
  return {
    target: name,
    unavailableMessage: msg("Clipboard API is unavailable while copying {target}.", { target: name }),
    failureMessage: msg("Failed to copy {target} to the clipboard.", { target: name }),
  };
}

const DEFAULT_CLIPBOARD_TARGET = "text";

function clipboardTargetFields(target: ClipboardTarget | undefined, failure: "unavailable" | "failure") {
  if (target === undefined) return { target: DEFAULT_CLIPBOARD_TARGET };
  return {
    target: target.target,
    displayMessage: failure === "unavailable" ? target.unavailableMessage : target.failureMessage,
  };
}

class ClipboardError extends Error {
  readonly _tag = "ClipboardError";
  readonly target: string;
  readonly displayMessage?: string;
  constructor(tag: string, target: string, displayMessage: string | undefined, cause?: unknown) {
    super(displayMessage ?? tag);
    this.name = tag;
    this.target = target;
    this.displayMessage = displayMessage;
    if (cause !== undefined) this.cause = cause;
  }
}

export class ClipboardApiUnavailableError extends ClipboardError {
  override get message(): string {
    if (this.displayMessage !== undefined) return m(this.displayMessage);
    return m(msg("Clipboard API is unavailable while copying text."));
  }
}

export class ClipboardWriteError extends ClipboardError {
  override get message(): string {
    if (this.displayMessage !== undefined) return m(this.displayMessage);
    return m(msg("Failed to copy text to the clipboard."));
  }
}

export class ClipboardReadUnavailableError extends ClipboardError {
  override get message(): string {
    if (this.displayMessage !== undefined) return m(this.displayMessage);
    return m(msg("Clipboard API is unavailable while reading text."));
  }
}

export class ClipboardReadError extends ClipboardError {
  override get message(): string {
    if (this.displayMessage !== undefined) return m(this.displayMessage);
    return m(msg("Failed to read text from the clipboard."));
  }
}

function writeTextWithExecCommand(
  value: string,
  extraFlavors?: Readonly<Record<string, string>>,
  requireHtml = false,
): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.fontSize = "16px";

  const previouslyFocused = document.activeElement;
  let copiedHtml = false;
  const copy = (event: ClipboardEvent) => {
    if (!extraFlavors || !event.clipboardData) return;
    event.clipboardData.setData("text/plain", value);
    for (const [type, data] of Object.entries(extraFlavors)) event.clipboardData.setData(type, data);
    event.preventDefault();
    copiedHtml = Boolean(extraFlavors["text/html"]);
  };
  document.body.appendChild(textarea);
  textarea.addEventListener("copy", copy);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return document.execCommand("copy") && (!requireHtml || copiedHtml);
  } catch {
    return false;
  } finally {
    textarea.removeEventListener("copy", copy);
    textarea.remove();
    const restoreFocus = (previouslyFocused as { focus?: unknown } | null)?.focus;
    if (typeof restoreFocus === "function") {
      (previouslyFocused as HTMLElement).focus({ preventScroll: true });
    }
  }
}

/** Clipboard first; the legacy execCommand path keeps copy working where the API is blocked. */
export async function writeTextToClipboard(
  value: string,
  target?: ClipboardTarget,
  extraFlavors?: Readonly<Record<string, string>>,
  options?: { requireHtml?: boolean },
): Promise<boolean> {
  const fields = clipboardTargetFields(target, "unavailable");
  const hasHtml = extraFlavors !== undefined && "text/html" in extraFlavors;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && hasHtml && typeof ClipboardItem !== "undefined") {
      const item = new ClipboardItem({
        "text/plain": new Blob([value], { type: "text/plain" }),
        "text/html": new Blob([extraFlavors["text/html"]!], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path before reporting a failure.
  }
  if (writeTextWithExecCommand(value, { ...extraFlavors, "text/plain": value }, options?.requireHtml)) return true;
  throw new ClipboardApiUnavailableError(COMPOSER_CONTEXT_CLIPBOARD_MIME, fields.target, fields.displayMessage);
}

/** Reads plain text; used by paste affordances that want to know what is on the clipboard. */
export async function readTextFromClipboard(target?: ClipboardTarget): Promise<string> {
  const fields = clipboardTargetFields(target, "unavailable");
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch (error) {
    throw new ClipboardReadError(COMPOSER_CONTEXT_CLIPBOARD_MIME, fields.target, fields.displayMessage, error);
  }
  throw new ClipboardReadUnavailableError(COMPOSER_CONTEXT_CLIPBOARD_MIME, fields.target, fields.displayMessage);
}

export function useCopyToClipboard<TContext = void>({
  timeout = 2000,
  target,
  onCopy,
  onError,
  extraFlavors,
}: {
  timeout?: number;
  target?: ClipboardTarget;
  onCopy?: (ctx: TContext) => void;
  onError?: (error: Error, ctx: TContext) => void;
  extraFlavors?: Readonly<Record<string, string>>;
} = {}): {
  copyToClipboard: (
    value: string,
    ctx: TContext,
    flavors?: Readonly<Record<string, string>>,
    options?: { requireHtml?: boolean },
  ) => void;
  isCopied: boolean;
} {
  const [isCopied, setIsCopied] = React.useState(false);
  const timeoutIdRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyToClipboard = useStableCallback(
    (
      value: string,
      ctx: TContext,
      flavors: Readonly<Record<string, string>> | undefined = extraFlavors,
      options?: { requireHtml?: boolean },
    ): void => {
      void writeTextToClipboard(value, target, flavors, options).then(
        (didCopy) => {
          if (!didCopy) return;
          if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
          setIsCopied(true);
          onCopy?.(ctx);
          if (timeout !== 0) {
            timeoutIdRef.current = setTimeout(() => setIsCopied(false), timeout);
          }
        },
        (error: Error) => {
          onError?.(error, ctx);
        },
      );
    },
  );
  React.useEffect(
    () => () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    },
    [],
  );
  return { copyToClipboard, isCopied };
}

export { encodeComposerContextClipboardHtml };
