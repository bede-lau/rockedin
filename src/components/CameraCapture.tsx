"use client";

import Image from "next/image";
import {
  Camera,
  ImageUp,
  Images,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  X,
} from "lucide-react";
import {
  captureVideoFrame,
  compressImageFile,
} from "@/lib/image";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const PIPELINE_STEPS = [
  "Inspecting physical position",
  "Translating gravity into growth",
  "Writing corporate humblebrag",
  "Updating living profile",
];

type CameraStatus = "initializing" | "live" | "denied" | "unavailable";

interface CameraCaptureProps {
  busy: boolean;
  loadingStep: number;
  onAnalyze: (imageDataUrl: string) => Promise<void>;
  sampleImages: SampleImage[];
}

export interface SampleImage {
  fileName: string;
  label: string;
  mimeType: string;
  src: string;
}

export function CameraCapture({
  busy,
  loadingStep,
  onAnalyze,
  sampleImages,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sampleDialogRef = useRef<HTMLDialogElement>(null);
  const sampleTriggerRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("initializing");
  const [selectedImage, setSelectedImage] = useState<string>();
  const [samplePickerOpen, setSamplePickerOpen] = useState(false);
  const [sampleLoading, setSampleLoading] = useState<string>();
  const [sampleError, setSampleError] = useState<string>();
  const [localError, setLocalError] = useState<string>();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setStatus("initializing");
    setLocalError(undefined);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("live");
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError");
      setStatus(denied ? "denied" : "unavailable");
    }
  }, [stopCamera]);

  useEffect(() => {
    queueMicrotask(() => void startCamera());
    return stopCamera;
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (!samplePickerOpen || !sampleDialogRef.current) {
      return;
    }

    if (!sampleDialogRef.current.open) {
      sampleDialogRef.current.showModal();
    }
  }, [samplePickerOpen]);

  const closeSamplePicker = () => {
    sampleDialogRef.current?.close();
  };

  const handlePrimary = async () => {
    setLocalError(undefined);
    try {
      const frame =
        selectedImage ??
        (videoRef.current ? captureVideoFrame(videoRef.current) : undefined);
      if (!frame) {
        setLocalError("Camera is not ready. Upload a photo or retry the camera.");
        return;
      }
      setSelectedImage(frame);
      await onAnalyze(frame);
      setSelectedImage(undefined);
    } catch {
      setLocalError("Unable to prepare that image. Retake or upload another photo.");
    }
  };

  const handleUpload = async (file?: File) => {
    if (!file) {
      return;
    }
    setLocalError(undefined);
    try {
      setSelectedImage(await compressImageFile(file));
    } catch {
      setLocalError("Choose a valid JPG, PNG, or WebP image.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSampleSelect = async (sample: SampleImage) => {
    setSampleError(undefined);
    setSampleLoading(sample.src);

    try {
      const response = await fetch(sample.src);
      if (!response.ok) {
        throw new Error("SAMPLE_IMAGE_UNAVAILABLE");
      }

      const blob = await response.blob();
      const file = new File([blob], sample.fileName, {
        type: blob.type || sample.mimeType,
      });
      setSelectedImage(await compressImageFile(file));
      closeSamplePicker();
    } catch {
      setSampleError("Unable to load that sample image. Choose another.");
    } finally {
      setSampleLoading(undefined);
    }
  };

  const visibleImage = selectedImage;

  return (
    <section className="camera-surface" aria-labelledby="capture-heading">
      <div className="section-heading-row">
        <div>
          <SectionEyebrow icon={Camera}>LIVE PHYSICAL INPUT</SectionEyebrow>
          <h2 id="capture-heading">Move Batu. Promote Batu.</h2>
        </div>
        <div className={`camera-status camera-status-${status}`}>
          <span aria-hidden="true" />
          {status === "live"
            ? "Camera ready"
            : status === "initializing"
              ? "Connecting camera"
              : "Upload available"}
        </div>
      </div>

      <div className="camera-frame">
        <video
          ref={videoRef}
          className={visibleImage ? "camera-video camera-video-hidden" : "camera-video"}
          autoPlay
          muted
          playsInline
          aria-label="Live camera preview"
        />
        {visibleImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visibleImage}
            alt="Captured scene ready for RockedIN Agent"
            className="captured-preview"
          />
        ) : null}

        {!visibleImage && status !== "live" ? (
          <div className="camera-empty">
            <ScanSearch aria-hidden="true" />
            <strong>
              {status === "denied"
                ? "Camera permission is blocked"
                : status === "unavailable"
                  ? "Camera is unavailable"
                  : "Opening the camera"}
            </strong>
            <span>
              Upload remains available and follows the same live Qwen workflow.
            </span>
          </div>
        ) : null}
      </div>

      {busy ? (
        <div className="agent-pipeline" aria-live="polite">
          {PIPELINE_STEPS.map((step, index) => (
            <div
              className={
                index < loadingStep
                  ? "pipeline-step pipeline-step-done"
                  : index === loadingStep
                    ? "pipeline-step pipeline-step-active"
                    : "pipeline-step"
              }
              key={step}
            >
              <span aria-hidden="true" />
              {step}
            </div>
          ))}
        </div>
      ) : (
        <div className="capture-controls">
          <button
            className="primary-button"
            type="button"
            onClick={() => void handlePrimary()}
            disabled={status !== "live" && !selectedImage}
          >
            <Camera aria-hidden="true" />
            {selectedImage ? "Promote This Position" : "Capture & Promote"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => void handleUpload(event.target.files?.[0])}
          />
          <button
            className="secondary-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageUp aria-hidden="true" />
            Upload Photo Instead
          </button>
          <button
            ref={sampleTriggerRef}
            className="icon-button sample-picker-trigger"
            type="button"
            title={
              sampleImages.length
                ? "Choose a sample photo"
                : "No sample photos available"
            }
            aria-label={
              sampleImages.length
                ? "Choose a sample photo"
                : "Sample photos unavailable"
            }
            disabled={!sampleImages.length}
            onClick={() => {
              setSampleError(undefined);
              setSamplePickerOpen(true);
            }}
          >
            <Images aria-hidden="true" />
            <span>Sample Photos</span>
          </button>
          {selectedImage ? (
            <button
              className="icon-button"
              type="button"
              title="Retake"
              aria-label="Retake scene"
              onClick={() => setSelectedImage(undefined)}
            >
              <RotateCcw aria-hidden="true" />
            </button>
          ) : status !== "live" ? (
            <button
              className="icon-button"
              type="button"
              title="Retry camera"
              aria-label="Retry camera"
              onClick={() => void startCamera()}
            >
              <RefreshCw aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}

      {localError ? (
        <p className="inline-error" role="alert">
          {localError}
        </p>
      ) : null}

      {samplePickerOpen ? (
        <dialog
          ref={sampleDialogRef}
          className="sample-picker-dialog"
          aria-labelledby="sample-picker-heading"
          onClose={() => {
            setSamplePickerOpen(false);
            sampleTriggerRef.current?.focus();
          }}
        >
          <header className="sample-picker-header">
            <div>
              <SectionEyebrow icon={Images}>PREPARED SCENES</SectionEyebrow>
              <h2 id="sample-picker-heading">Choose a sample photo</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Close"
              aria-label="Close sample photos"
              onClick={closeSamplePicker}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div
            className="sample-picker-grid"
            aria-busy={sampleLoading ? "true" : "false"}
          >
            {sampleImages.map((sample) => (
              <button
                className="sample-image-option"
                type="button"
                key={sample.src}
                disabled={Boolean(sampleLoading)}
                onClick={() => void handleSampleSelect(sample)}
              >
                <span className="sample-image-thumbnail">
                  <Image
                    src={sample.src}
                    alt=""
                    fill
                    sizes="(max-width: 800px) 42vw, 210px"
                  />
                </span>
                <span className="sample-image-label">{sample.label}</span>
                {sampleLoading === sample.src ? (
                  <LoaderCircle
                    className="sample-image-loading"
                    aria-label="Loading sample photo"
                  />
                ) : null}
              </button>
            ))}
          </div>
          {sampleError ? (
            <p className="sample-picker-error" role="alert">
              {sampleError}
            </p>
          ) : null}
        </dialog>
      ) : null}
    </section>
  );
}
