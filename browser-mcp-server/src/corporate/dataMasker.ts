let PNG: typeof import("pngjs").PNG | null = null;

async function loadDeps(): Promise<void> {
  if (PNG) return;
  const png = await import("pngjs");
  PNG = png.PNG;
}

function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function maskSensitiveRegions(
  screenshotBuffer: Buffer,
  regions: Array<{ x: number; y: number; width: number; height: number }>,
): Promise<Buffer> {
  await loadDeps();
  const img = PNG!.sync.read(screenshotBuffer);
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
  return PNG!.sync.write(img);
}
