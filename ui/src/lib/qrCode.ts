// @t3tools/shared/qrCode 的替代：同样的 Ecc 常量与 encodeText 形状，底层用 qrcode 包。
import QRCode from "qrcode";

const Ecc = { LOW: "L", MEDIUM: "M", QUARTILE: "Q", HIGH: "H" } as const;

function encodeText(text: string, ecc: string = Ecc.MEDIUM) {
  const code = QRCode.create(text, { errorCorrectionLevel: ecc as "L" | "M" | "Q" | "H" });
  return {
    size: code.modules.size,
    getModule(x: number, y: number) {
      return Boolean(code.modules.get(x, y));
    },
  };
}

export const QrCode = { Ecc, encodeText };
export default QrCode;
