// Lazy import for pixelmatch/pngjs — only loaded when data masking is used
let pixelmatch: ((img1: Buffer, img2: Buffer, output: Buffer, w: number, h: number, opts: any) => number) | null = null;
let PNG: any = null;

async function loadDeps(): Promise<void> {
  if (PNG) return;
  const png = await import("pngjs");
  const pm = await import("pixelmatch");
  PNG = png.PNG;
  pixelmatch = pm.default;
}

function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function maskSensitiveRegions(
  screenshotBuffer: Buffer,
  regions: Array<{ x: number; y: number; width: number; height: number }>,
): Promise<Buffer> {
  await loadDeps();
  const img = PNG.sync.read(screenshotBuffer);
  for (const region of regions) {
    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const w = Math.min(img.width - x, Math.floor(region.width));
    const h = Math.min(img.height - y, Math.floor(region.height));
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const idx = (py * img.width + px) * 4;
        const gray = rgbToGray(img.data[idx], img.data[idx + 1], img.data[idx + 2]);
        const blur = 25;
        img.data[idx] = Math.min(255, gray + blur);
        img.data[idx + 1] = Math.min(255, gray + blur);
        img.data[idx + 2] = Math.min(255, gray + blur);
      }
    }
  }
  return PNG.sync.write(img);
}

export async function findSensitiveRegions(screenshotBuffer: Buffer): Promise<Array<{ x: number; y: number; width: number; height: number }>> {
  await loadDeps();
  const regions: Array<{ x: number; y: number; width: number; height: number }> = [];
  const img = PNG.sync.read(screenshotBuffer);
  // Detect regions where the page has input fields by looking for rectangular patterns
  // This is a simplified approach — real masking would use DOM coordinates
  // For now, mark the bottom 15% of the screen as potentially sensitive (forms area)
  const h = Math.floor(img.height * 0.15);
  regions.push({ x: 0, y: img.height - h, width: img.width, height: h });
  return regions;
}
