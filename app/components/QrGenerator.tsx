"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================
// Minimal QR Code Encoder  (Byte mode, EC level L, versions 1-10)
// ============================================================

// GF(256) arithmetic for Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(nsym: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < nsym; i++) {
    const ng = new Uint8Array(g.length + 1);
    for (let j = g.length - 1; j >= 0; j--) {
      ng[j + 1] ^= g[j];
      ng[j] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data: Uint8Array, nsym: number): Uint8Array {
  const gen = rsGeneratorPoly(nsym);
  const res = new Uint8Array(data.length + nsym);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Version info: [totalCodewords, ecCodewordsPerBlock, numBlocks, dataCodewords]
// EC Level L only
const VERSION_TABLE: [number, number, number, number][] = [
  [0, 0, 0, 0], // placeholder v0
  [26, 7, 1, 19],
  [44, 10, 1, 34],
  [70, 15, 1, 55],
  [100, 20, 1, 80],
  [134, 26, 1, 108],
  [172, 18, 2, 136],
  [196, 20, 2, 156],
  [242, 24, 2, 194],
  [292, 30, 2, 232],
  [346, 18, 2, 274], // v10 — up to 274 bytes
];

const ALIGNMENT_PATTERNS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

function getVersion(dataLen: number): number {
  for (let v = 1; v <= 10; v++) {
    // byte mode overhead: 4 bits mode + 8/16 bits length
    const charCountBits = v <= 9 ? 8 : 16;
    const availBits = VERSION_TABLE[v][3] * 8;
    const overhead = 4 + charCountBits;
    if (dataLen * 8 + overhead <= availBits) return v;
  }
  return -1; // too long
}

function encodeData(text: string, version: number): Uint8Array {
  const info = VERSION_TABLE[version];
  const totalDataCW = info[3];
  const bytes = new TextEncoder().encode(text);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Mode indicator: byte mode = 0100
  pushBits(0b0100, 4);
  // Character count
  const charCountBits = version <= 9 ? 8 : 16;
  pushBits(bytes.length, charCountBits);
  // Data
  for (const b of bytes) pushBits(b, 8);
  // Terminator (up to 4 bits)
  const cap = totalDataCW * 8;
  const termLen = Math.min(4, cap - bits.length);
  pushBits(0, termLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad bytes
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (bits.length < cap) {
    pushBits(padBytes[pi % 2], 8);
    pi++;
  }

  const dataCW = new Uint8Array(totalDataCW);
  for (let i = 0; i < totalDataCW; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    dataCW[i] = byte;
  }
  return dataCW;
}

function buildCodewords(text: string, version: number): Uint8Array {
  const info = VERSION_TABLE[version];
  const [totalCW, ecCWPerBlock, numBlocks, totalDataCW] = info;
  const dataCW = encodeData(text, version);

  const dataPerBlock = Math.floor(totalDataCW / numBlocks);
  const extraBlocks = totalDataCW - dataPerBlock * numBlocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = dataPerBlock + (b >= numBlocks - extraBlocks ? 1 : 0);
    const block = dataCW.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecCWPerBlock));
  }

  // Interleave
  const result: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < ecCWPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }

  // Remainder bits (version 2-6 have 7 remainder bits, v1 has 0, v7+ varies)
  // We'll handle this in matrix placement
  const out = new Uint8Array(totalCW);
  for (let i = 0; i < Math.min(result.length, totalCW); i++) out[i] = result[i];
  return out;
}

function createMatrix(version: number): { matrix: number[][]; reserved: boolean[][] } {
  const size = version * 4 + 17;
  const matrix: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r: number, c: number, val: number) => {
    matrix[r][c] = val;
    reserved[r][c] = true;
  };

  // Finder patterns
  const placeFinderPattern = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r, mc = col + c;
        if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;
        const inOuter = r === -1 || r === 7 || c === -1 || c === 7;
        const inBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(mr, mc, (inBorder || inInner) && !inOuter ? 1 : 0);
      }
    }
  };
  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Alignment patterns
  if (version >= 2) {
    const positions = ALIGNMENT_PATTERNS[version];
    for (const r of positions) {
      for (const c of positions) {
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const val = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0) ? 1 : 0;
            setModule(r + dr, c + dc, val);
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0 ? 1 : 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Dark module
  setModule(size - 8, 8, 1);

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][i]) { reserved[8][i] = true; matrix[8][i] = 0; }
    if (!reserved[8][size - 1 - i]) { reserved[8][size - 1 - i] = true; matrix[8][size - 1 - i] = 0; }
    if (!reserved[i][8]) { reserved[i][8] = true; matrix[i][8] = 0; }
    if (!reserved[size - 1 - i][8]) { reserved[size - 1 - i][8] = true; matrix[size - 1 - i][8] = 0; }
  }
  if (!reserved[8][8]) { reserved[8][8] = true; matrix[8][8] = 0; }

  // Reserve version info for v >= 7 (not needed for v1-6)

  return { matrix, reserved };
}

function placeData(matrix: number[][], reserved: boolean[][], codewords: Uint8Array) {
  const size = matrix.length;
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }
  // Add remainder bits
  while (bits.length < size * size) bits.push(0);

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (c < 0) continue;
        if (!reserved[row][c]) {
          matrix[row][c] = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }
}

function applyMask(matrix: number[][], reserved: boolean[][], maskId: number): number[][] {
  const size = matrix.length;
  const result = matrix.map((r) => [...r]);
  const maskFn = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number, _c: number) => r % 2 === 0,
    (_r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ][maskId];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && maskFn(r, c)) {
        result[r][c] ^= 1;
      }
    }
  }
  return result;
}

function calcPenalty(matrix: number[][]): number {
  const size = matrix.length;
  let penalty = 0;

  // Rule 1: runs of same color
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else count = 1;
    }
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else count = 1;
    }
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 4: proportion
  let dark = 0;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) if (matrix[r][c] === 1) dark++;
  const pct = (dark / (size * size)) * 100;
  penalty += Math.abs(Math.floor(pct / 5) * 5 - 50) * 2;

  return penalty;
}

// Format info with BCH error correction
const FORMAT_INFO_STRINGS: number[] = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
  0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed,
  0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b,
];

function placeFormatInfo(matrix: number[][], maskId: number) {
  // EC level L = 01, so format info index = 01 * 8 + maskId = 8 + maskId
  const info = FORMAT_INFO_STRINGS[8 + maskId];
  const size = matrix.length;
  const bits: number[] = [];
  for (let i = 14; i >= 0; i--) bits.push((info >> i) & 1);

  // Around top-left finder
  const positions1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  // Split across right and bottom
  const positions2 = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];

  for (let i = 0; i < 15; i++) {
    const [r1, c1] = positions1[i];
    matrix[r1][c1] = bits[i];
    const [r2, c2] = positions2[i];
    matrix[r2][c2] = bits[i];
  }
}

function generateQR(text: string): number[][] | null {
  if (!text) return null;
  const version = getVersion(new TextEncoder().encode(text).length);
  if (version < 0) return null;

  const codewords = buildCodewords(text, version);
  const { matrix, reserved } = createMatrix(version);
  placeData(matrix, reserved, codewords);

  // Try all 8 masks, pick the best
  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, reserved, m);
    placeFormatInfo(masked, m);
    const p = calcPenalty(masked);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = m;
    }
  }

  const final = applyMask(matrix, reserved, bestMask);
  placeFormatInfo(final, bestMask);
  return final;
}

// ============================================================
// Input type templates
// ============================================================

type InputType = "url" | "text" | "email" | "phone" | "wifi" | "vcard";

const INPUT_TYPES: { id: InputType; label: string }[] = [
  { id: "url", label: "URL" },
  { id: "text", label: "Text" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "wifi", label: "WiFi" },
  { id: "vcard", label: "vCard" },
];

function buildContent(type: InputType, fields: Record<string, string>): string {
  switch (type) {
    case "url":
      return fields.url || "";
    case "text":
      return fields.text || "";
    case "email": {
      const parts = [`mailto:${fields.email || ""}`];
      const params: string[] = [];
      if (fields.subject) params.push(`subject=${encodeURIComponent(fields.subject)}`);
      if (fields.body) params.push(`body=${encodeURIComponent(fields.body)}`);
      if (params.length) parts.push(params.join("&"));
      return parts.join("?");
    }
    case "phone":
      return `tel:${fields.phone || ""}`;
    case "wifi":
      return `WIFI:T:${fields.encryption || "WPA"};S:${fields.ssid || ""};P:${fields.password || ""};;`;
    case "vcard":
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${fields.lastName || ""};${fields.firstName || ""}`,
        `FN:${fields.firstName || ""} ${fields.lastName || ""}`,
        fields.org ? `ORG:${fields.org}` : "",
        fields.phone ? `TEL:${fields.phone}` : "",
        fields.email ? `EMAIL:${fields.email}` : "",
        fields.url ? `URL:${fields.url}` : "",
        "END:VCARD",
      ]
        .filter(Boolean)
        .join("\n");
    default:
      return "";
  }
}

// ============================================================
// Component
// ============================================================

export default function QrGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inputType, setInputType] = useState<InputType>("url");
  const [fields, setFields] = useState<Record<string, string>>({ url: "https://example.com" });
  const [size, setSize] = useState(300);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [qrMatrix, setQrMatrix] = useState<number[][] | null>(null);
  const [error, setError] = useState("");

  const updateField = (key: string, val: string) => {
    setFields((f) => ({ ...f, [key]: val }));
  };

  const generate = useCallback(() => {
    const content = buildContent(inputType, fields);
    if (!content.trim()) {
      setError("Please enter some content.");
      setQrMatrix(null);
      return;
    }
    const byteLen = new TextEncoder().encode(content).length;
    if (byteLen > 274) {
      setError(`Content too long (${byteLen} bytes). Maximum is 274 bytes for this encoder.`);
      setQrMatrix(null);
      return;
    }
    setError("");
    const matrix = generateQR(content);
    if (!matrix) {
      setError("Failed to generate QR code. Try shorter content.");
      return;
    }
    setQrMatrix(matrix);
  }, [inputType, fields]);

  // Auto-generate on changes
  useEffect(() => {
    const t = setTimeout(generate, 200);
    return () => clearTimeout(t);
  }, [generate]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qrMatrix) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const modules = qrMatrix.length;
    const quiet = 4;
    const totalModules = modules + quiet * 2;
    canvas.width = size;
    canvas.height = size;
    const moduleSize = size / totalModules;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = fgColor;

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (qrMatrix[r][c] === 1) {
          ctx.fillRect(
            (c + quiet) * moduleSize,
            (r + quiet) * moduleSize,
            moduleSize + 0.5,
            moduleSize + 0.5
          );
        }
      }
    }
  }, [qrMatrix, size, fgColor, bgColor]);

  const downloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadSVG = () => {
    if (!qrMatrix) return;
    const modules = qrMatrix.length;
    const quiet = 4;
    const total = modules + quiet * 2;
    const rects: string[] = [];
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (qrMatrix[r][c] === 1) {
          rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1" fill="${fgColor}"/>`);
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}">
<rect width="${total}" height="${total}" fill="${bgColor}"/>
${rects.join("\n")}
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = "qrcode.svg";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleTypeChange = (type: InputType) => {
    setInputType(type);
    setFields(
      type === "url" ? { url: "https://example.com" } :
      type === "text" ? { text: "" } :
      type === "email" ? { email: "", subject: "", body: "" } :
      type === "phone" ? { phone: "" } :
      type === "wifi" ? { ssid: "", password: "", encryption: "WPA" } :
      { firstName: "", lastName: "", org: "", phone: "", email: "", url: "" }
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Input */}
      <div className="space-y-6">
        {/* Input type selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Input Type
          </label>
          <div className="flex flex-wrap gap-2">
            {INPUT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTypeChange(t.id)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  inputType === t.id
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic fields */}
        <div className="space-y-3">
          {inputType === "url" && (
            <Field label="URL" value={fields.url || ""} onChange={(v) => updateField("url", v)} placeholder="https://example.com" />
          )}
          {inputType === "text" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none resize-y"
                rows={4}
                value={fields.text || ""}
                onChange={(e) => updateField("text", e.target.value)}
                placeholder="Enter text to encode..."
              />
            </div>
          )}
          {inputType === "email" && (
            <>
              <Field label="Email" value={fields.email || ""} onChange={(v) => updateField("email", v)} placeholder="user@example.com" />
              <Field label="Subject" value={fields.subject || ""} onChange={(v) => updateField("subject", v)} placeholder="Optional subject" />
              <Field label="Body" value={fields.body || ""} onChange={(v) => updateField("body", v)} placeholder="Optional body" />
            </>
          )}
          {inputType === "phone" && (
            <Field label="Phone" value={fields.phone || ""} onChange={(v) => updateField("phone", v)} placeholder="+1234567890" />
          )}
          {inputType === "wifi" && (
            <>
              <Field label="Network Name (SSID)" value={fields.ssid || ""} onChange={(v) => updateField("ssid", v)} placeholder="MyWiFi" />
              <Field label="Password" value={fields.password || ""} onChange={(v) => updateField("password", v)} placeholder="password123" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  value={fields.encryption || "WPA"}
                  onChange={(e) => updateField("encryption", e.target.value)}
                >
                  <option value="WPA">WPA/WPA2</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">None</option>
                </select>
              </div>
            </>
          )}
          {inputType === "vcard" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" value={fields.firstName || ""} onChange={(v) => updateField("firstName", v)} placeholder="John" />
                <Field label="Last Name" value={fields.lastName || ""} onChange={(v) => updateField("lastName", v)} placeholder="Doe" />
              </div>
              <Field label="Organization" value={fields.org || ""} onChange={(v) => updateField("org", v)} placeholder="Company Inc." />
              <Field label="Phone" value={fields.phone || ""} onChange={(v) => updateField("phone", v)} placeholder="+1234567890" />
              <Field label="Email" value={fields.email || ""} onChange={(v) => updateField("email", v)} placeholder="john@example.com" />
              <Field label="Website" value={fields.url || ""} onChange={(v) => updateField("url", v)} placeholder="https://example.com" />
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* Customization */}
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Size: {size}px
            </label>
            <input
              type="range"
              min={100}
              max={500}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full accent-gray-900"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Foreground
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Background
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: QR display + download */}
      <div className="flex flex-col items-center gap-4">
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 inline-flex items-center justify-center" style={{ minWidth: 200, minHeight: 200 }}>
          {qrMatrix ? (
            <canvas ref={canvasRef} style={{ width: size, height: size, imageRendering: "pixelated" }} />
          ) : (
            <p className="text-gray-400 text-sm">Enter content to generate QR code</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadPNG}
            disabled={!qrMatrix}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Download PNG
          </button>
          <button
            onClick={downloadSVG}
            disabled={!qrMatrix}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Download SVG
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
