import { type MessageId, type ProjectId, type ThreadId } from "./t3-types";
import { type CxOptions, cx } from "class-variance-authority";
import { msg } from "gt-react";
import { extendTailwindMerge } from "tailwind-merge";
import { type MessageResolver } from "../i18n/messages";
import { m } from "../i18n/messages";

// Register extra font sizes and background images so tailwind-merge does not
// treat text-2xs or bg-composer-seam-below as colors.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["2xs", "3xs", "4xs", "5xs"] },
    classGroups: { "bg-image": [{ bg: ["composer-seam-below", "composer-seam-above"] }] },
  },
});

export function cn(...inputs: CxOptions) {
  return twMerge(cx(inputs));
}

export function isMacPlatform(platform: string): boolean {
  return /^mac|darwin/i.test(platform);
}

export function isWindowsPlatform(platform: string): boolean {
  return /^win(dows)?/i.test(platform);
}

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function getLocalFileManagerName(platform: string, resolve: MessageResolver = m): string {
  if (isMacPlatform(platform)) {
    return "Finder";
  }
  if (isWindowsPlatform(platform)) {
    return resolve(msg("File Explorer", { $context: "the Windows file manager app" }));
  }
  return resolve(msg("Files", { $context: "the Linux file manager app" }));
}

export function randomUUID(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const newProjectId = (): ProjectId => randomUUID();

export const newThreadId = (): ThreadId => randomUUID();

export const newDraftId = (): string => randomUUID();

export const newMessageId = (): MessageId => randomUUID();
