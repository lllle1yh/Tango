// T3 的 @t3tools/shared/qrCode 用内部实现；这里用 qrcode 包生成同样的 SVG 输出。
import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    void QRCode.toString(value, { type: "svg", margin: 0, width: size }).then(setSvg).catch(() => setSvg(""));
  }, [value, size]);
  return <div className={className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
