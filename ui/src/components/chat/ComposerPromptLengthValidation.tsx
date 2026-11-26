// 搬自 T3 的 ComposerPromptLengthValidation：输入框超长时的提示行。
// T3 按 provider 的上限算；Tango 把 prompt 作为命令行参数交给各 CLI，
// 太长会直接失败，所以这里给一个保守上限并提示拆成附件或分两次发。
export const PROMPT_LENGTH_LIMIT = 100_000;

export function promptLengthMessage(prompt: string): string | null {
  if (prompt.length <= PROMPT_LENGTH_LIMIT) return null;
  return `This prompt is ${prompt.length.toLocaleString()} characters; the agent CLI takes at most ${PROMPT_LENGTH_LIMIT.toLocaleString()}. Split it, or paste the bulk so it is saved as an attachment.`;
}

export function ComposerPromptLengthValidation({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      data-chat-composer-validation="prompt-length"
      className="px-3 pb-2 text-xs text-destructive sm:px-4"
    >
      {message}
    </p>
  );
}
