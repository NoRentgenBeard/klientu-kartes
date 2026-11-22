import type { PhotoFactory } from './seed';

/** Dev-only placeholder photo: a grey card with the store name, as a JPEG blob. */
export const canvasSeedPhoto: PhotoFactory = async (sample) => {
  const canvas = document.createElement('canvas');
  canvas.width = 856;
  canvas.height = 540;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#E9E7E2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1F2328';
  ctx.font = '700 64px -apple-system, system-ui, sans-serif';
  ctx.fillText(sample.company, 48, 110);
  ctx.font = '36px ui-monospace, Menlo, monospace';
  ctx.fillText(sample.codeValue, 48, 470);
  ctx.font = '28px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#6C6C70';
  ctx.fillText('Paraugs', 48, 160);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.8),
  );
};
