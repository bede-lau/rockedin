import { readdir } from "node:fs/promises";
import path from "node:path";
import { RockedInApp } from "@/components/RockedInApp";
import type { SampleImage } from "@/components/CameraCapture";

const SAMPLE_IMAGE_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
} as const;

function formatSampleLabel(fileName: string, index: number) {
  const label = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[\s_-]*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!label) {
    return `Sample ${index + 1}`;
  }

  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

async function getSampleImages(): Promise<SampleImage[]> {
  const directory = path.join(process.cwd(), "public", "sample-images");

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        fileName: entry.name,
        extension: path.extname(entry.name).toLowerCase(),
      }))
      .filter(
        (
          file,
        ): file is {
          fileName: string;
          extension: keyof typeof SAMPLE_IMAGE_TYPES;
        } => file.extension in SAMPLE_IMAGE_TYPES,
      )
      .sort((left, right) =>
        left.fileName.localeCompare(right.fileName, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    return files.map((file, index) => ({
      fileName: file.fileName,
      label: formatSampleLabel(file.fileName, index),
      mimeType: SAMPLE_IMAGE_TYPES[file.extension],
      src: `/sample-images/${encodeURIComponent(file.fileName)}`,
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const sampleImages = await getSampleImages();

  return <RockedInApp sampleImages={sampleImages} />;
}
