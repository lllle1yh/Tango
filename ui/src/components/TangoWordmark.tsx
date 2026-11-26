// 原先 standalone 页用 T3Wordmark；二开后的产品名是 Tango，这里换成自己的字标。
export function TangoWordmark({ className }: { className?: string; "aria-hidden"?: boolean }) {
  return (
    <svg viewBox="0 0 64 24" className={className} role="img" aria-label="Tango">
      <text x="0" y="19" fontFamily="inherit" fontSize="22" fontWeight="700" fill="currentColor">
        Tango
      </text>
    </svg>
  );
}
