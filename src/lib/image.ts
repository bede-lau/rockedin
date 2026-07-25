const MAX_EDGE = 768;
const TARGET_BYTES = 700_000;

function approximateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function drawCompressed(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("IMAGE_PROCESSING_FAILED");
  }

  context.drawImage(source, 0, 0, outputWidth, outputHeight);

  for (let quality = 0.78; quality >= 0.5; quality -= 0.08) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (approximateDataUrlBytes(dataUrl) <= TARGET_BYTES) {
      return dataUrl;
    }
  }

  return canvas.toDataURL("image/jpeg", 0.45);
}

export function captureVideoFrame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("CAMERA_NOT_READY");
  }
  return drawCompressed(video, video.videoWidth, video.videoHeight);
}

export async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("INVALID_IMAGE");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("INVALID_IMAGE"));
      element.src = objectUrl;
    });
    return drawCompressed(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
