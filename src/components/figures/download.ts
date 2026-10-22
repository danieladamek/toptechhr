/** Download helpers: SVG → PNG via canvas; rows → CSV. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function svgToPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = getComputedStyle(document.body);
  clone.style.fontFamily = css.fontFamily;
  clone.style.color = css.color;
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)); const h = Math.max(1, Math.round(rect.height));
  clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h));
  const src = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = css.backgroundColor || '#faf8f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((b) => { if (b) downloadBlob(b, filename); }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
}

export function downloadSvg(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = getComputedStyle(document.body);
  clone.style.fontFamily = css.fontFamily; clone.style.color = css.color; clone.style.background = css.backgroundColor;
  downloadBlob(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }), filename);
}

export function toCsv(rows: Record<string, unknown>[], fields: string[]): string {
  const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [fields.join(','), ...rows.map((r) => fields.map((f) => esc(r[f])).join(','))].join('\n') + '\n';
}

export function downloadCsv(rows: Record<string, unknown>[], fields: string[], filename: string) {
  downloadBlob(new Blob([toCsv(rows, fields)], { type: 'text/csv;charset=utf-8' }), filename);
}

/** Rasterise an SVG to a canvas (for PNG and PDF). */
function svgToCanvas(svg: SVGSVGElement, scale: number, done: (c: HTMLCanvasElement, w: number, h: number) => void) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = getComputedStyle(document.body);
  clone.style.fontFamily = css.fontFamily;
  clone.style.color = css.color;
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)); const h = Math.max(1, Math.round(rect.height));
  clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = css.backgroundColor || '#faf8f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    done(canvas, w, h);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
}

/**
 * A one-page PDF holding the figure as an image (JPEG, DCTDecode), written by hand — no PDF library in the bundle.
 * Page size is the figure's own size in points.
 */
export function svgToPdf(svg: SVGSVGElement, filename: string) {
  svgToCanvas(svg, 2, (canvas, w, h) => {
    const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
    const jpg = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const enc = new TextEncoder();
    const parts: BlobPart[] = [];
    const offsets: number[] = [];
    let len = 0;
    const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b as Uint8Array<ArrayBuffer>); len += b.length; };
    const obj = (n: number, body: string | (() => void)) => { offsets[n] = len; push(`${n} 0 obj\n`); if (typeof body === 'string') push(body); else body(); push('\nendobj\n'); };
    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    downloadBlob(new Blob(parts, { type: 'application/pdf' }), filename);
  });
}
