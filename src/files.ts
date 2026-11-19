export function readFileAsText(file: File) {
  if (file.size > 100 * 1024 * 1024) return Promise.reject(new Error('invalidProject'));
  return file.text();
}

export async function readFileAsDataUrl(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024)
    throw new Error('imageFailed');
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = src;
  await image.decode();
  if (
    image.naturalWidth > 16384 ||
    image.naturalHeight > 16384 ||
    image.naturalWidth * image.naturalHeight > 64_000_000
  )
    throw new Error('imageFailed');
  return src;
}

export const hasFiles = (event: { dataTransfer: DataTransfer }) =>
  Array.from(event.dataTransfer.types).includes('Files');
