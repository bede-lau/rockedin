"use client";

import Image from "next/image";
import {
  Activity,
  Award,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  ContactRound,
  Cpu,
  Gem,
  Globe2,
  Handshake,
  MapPin,
  Maximize2,
  MessageCircle,
  Minimize2,
  Network,
  Pencil,
  RefreshCw,
  Repeat2,
  Route,
  RotateCcw,
  ShieldCheck,
  ThumbsUp,
  TrendingUp,
  UserRoundCog,
  UsersRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  CameraCapture,
  type SampleImage,
} from "@/components/CameraCapture";
import { SectionEyebrow } from "@/components/SectionEyebrow";
import { compressImageFile } from "@/lib/image";
import {
  AgentApiResponseSchema,
  HealthApiResponseSchema,
  type AgentReceipt,
  type CareerPost,
  type HumanReviewResult,
} from "@/lib/schemas";
import { createSeedState } from "@/lib/seed";
import {
  buildCareerTrajectory,
  rockedinReducer,
} from "@/lib/state";
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
} from "@/lib/storage";

interface UiError {
  message: string;
  retryable: boolean;
  source: "scene" | "finale";
}

interface HealthState {
  status: "idle" | "checking" | "connected" | "error";
  model?: string;
  latencyMs?: number;
  checkedAt?: string;
  message?: string;
}

const formatNumber = new Intl.NumberFormat("en-US");
const DEFAULT_SCENE_MODEL = "gpt-5.6-luna";
const AGENT_REQUEST_TIMEOUT_MS = 125_000;
const HEALTH_REQUEST_TIMEOUT_MS = 35_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatModelName(model: string) {
  return model.split("/").at(-1) ?? model;
}

function formatHealthTime(checkedAt?: string) {
  if (!checkedAt) {
    return "";
  }
  return new Date(checkedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionTitle({
  eyebrow,
  icon: Icon,
  title,
}: {
  eyebrow: string;
  icon: typeof Activity;
  title: string;
}) {
  return (
    <div className="rail-heading">
      <SectionEyebrow icon={Icon}>{eyebrow}</SectionEyebrow>
      <h2>{title}</h2>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function useDialogFocusTrap(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const getFocusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    getFocusable()[0]?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => returnFocus?.focus(), 0);
    };
  }, [onClose]);

  return dialogRef;
}

function PostPreviewOverlay({
  post,
  profileName,
  profileImage,
  onClose,
}: {
  post: CareerPost;
  profileName: string;
  profileImage?: string;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocusTrap(onClose);
  const publishedAt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(post.createdAt));

  return (
    <div
      className="post-preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="post-preview-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="post-preview-heading"
      >
        <header className="post-preview-toolbar">
          <div className="post-preview-brand">
            <span aria-hidden="true">R</span>
            <div>
              <strong>RockedIN</strong>
              <small>Public post preview</small>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close public post preview"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <article className="public-post">
          <div className="public-post-author">
            <div className="public-post-avatar">
              {profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImage} alt="" />
              ) : (
                <Gem aria-hidden="true" />
              )}
            </div>
            <div>
              <strong>{profileName}</strong>
              <span>{post.titleAtPublication}</span>
              <small>
                {publishedAt}
                <Globe2 aria-label="Visible publicly" />
              </small>
            </div>
          </div>

          <h2 id="post-preview-heading">{post.titleAtPublication}</h2>
          <p className="public-post-body">{post.body}</p>
          <div className="public-post-hashtags">
            {post.hashtags.map((hashtag) => (
              <span key={hashtag}>{hashtag}</span>
            ))}
          </div>

          {post.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="public-post-image"
              src={post.imageDataUrl}
              alt={`Captured scene for ${post.titleAtPublication}`}
            />
          ) : null}

          <div className="public-post-summary">
            <span>
              <ThumbsUp aria-hidden="true" />
              {formatNumber.format(post.solidCount)} solid
            </span>
            <span>{formatNumber.format(post.commentCount)} comments</span>
          </div>

          <div className="public-post-actions" aria-label="Post actions preview">
            <span>
              <ThumbsUp aria-hidden="true" />
              Solid
            </span>
            <span>
              <MessageCircle aria-hidden="true" />
              Comment
            </span>
            <span>
              <Repeat2 aria-hidden="true" />
              Repost
            </span>
          </div>

          <section className="public-comments" aria-label="Public comments">
            {post.comments.map((comment) => (
              <div
                className="public-comment"
                key={`${comment.author}-${comment.text}`}
              >
                <div className="public-comment-avatar" aria-hidden="true">
                  {comment.author.slice(0, 1)}
                </div>
                <div>
                  <strong>{comment.author}</strong>
                  <span>{comment.title}</span>
                  <p>{comment.text}</p>
                  <small>{comment.reaction}</small>
                </div>
              </div>
            ))}
          </section>
        </article>
      </section>
    </div>
  );
}

function FinaleOverlay({
  result,
  onClose,
}: {
  result: HumanReviewResult;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocusTrap(onClose);

  return (
    <div className="finale-backdrop">
      <section
        ref={dialogRef}
        className="finale-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="finale-heading"
      >
        <button
          className="finale-close icon-button"
          type="button"
          aria-label="Close organisational update"
          title="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <p className="finale-kicker">ORGANISATIONAL UPDATE</p>
        <h2 id="finale-heading">
          You now report to the rock.
        </h2>
        <div className="finale-summary">
          <div>
            <span>Human performance score</span>
            <strong>{result.score}/100</strong>
          </div>
          <div>
            <span>Human&apos;s new title</span>
            <strong>{result.humanNewTitle}</strong>
          </div>
          <div>
            <span>Batu&apos;s final title</span>
            <strong>{result.batuFinalTitle}</strong>
          </div>
        </div>
        <div className="finale-body">
          <div>
            <h3>Performance observations</h3>
            <ol>
              {result.observations.map((observation) => (
                <li key={observation}>{observation}</li>
              ))}
            </ol>
          </div>
          <div className="finale-recommendation">
            <h3>Formal recommendation</h3>
            <p>{result.recommendation}</p>
          </div>
        </div>
        <blockquote>{result.finalPost}</blockquote>
      </section>
    </div>
  );
}

export function RockedInApp({
  sampleImages = [],
}: {
  sampleImages?: SampleImage[];
}) {
  const [state, dispatch] = useReducer(rockedinReducer, undefined, createSeedState);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finaleBusy, setFinaleBusy] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [uiError, setUiError] = useState<UiError>();
  const [transientReceipt, setTransientReceipt] = useState<AgentReceipt>();
  const [customProfileImage, setCustomProfileImage] = useState<string>();
  const [profileImageError, setProfileImageError] = useState<string>();
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [latestImage, setLatestImage] = useState<string>();
  const [lastAttemptImage, setLastAttemptImage] = useState<string>();
  const [resetVersion, setResetVersion] = useState(0);
  const [presentationMode, setPresentationMode] = useState(false);
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);
  const [visibleFinale, setVisibleFinale] = useState<HumanReviewResult>();
  const [health, setHealth] = useState<HealthState>({ status: "idle" });
  const previousImageRef = useRef<string | undefined>(undefined);
  const activeRequestRef = useRef(0);
  const agentRequestInFlightRef = useRef<number | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      dispatch({ type: "HYDRATE", state: loadPersistedState() });
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      savePersistedState(state);
    }
  }, [hydrated, state]);

  useEffect(() => {
    if (nameEditing) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [nameEditing]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        const confirmed = window.confirm(
          "Reset Batu to Unemployed Mineral and clear the demo?",
        );
        if (confirmed) {
          activeRequestRef.current += 1;
          agentRequestInFlightRef.current = null;
          clearPersistedState();
          previousImageRef.current = undefined;
          setBusy(false);
          setFinaleBusy(false);
          setLoadingStep(0);
          setCustomProfileImage(undefined);
          setProfileImageError(undefined);
          setNameEditing(false);
          setNameDraft("");
          setNameError(undefined);
          setLatestImage(undefined);
          setLastAttemptImage(undefined);
          setUiError(undefined);
          setTransientReceipt(undefined);
          setPostPreviewOpen(false);
          setVisibleFinale(undefined);
          setHealth({ status: "idle" });
          setResetVersion((value) => value + 1);
          dispatch({ type: "RESET" });
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const syncFullscreen = () =>
      setPresentationMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const requestContext = useMemo(
    () => ({
      profile: state.profile,
      recentEvents: state.profile.careerHistory.slice(0, 6),
      certifications: state.certifications,
      connections: state.connections,
      analytics: state.analytics,
    }),
    [state],
  );
  const careerTrajectory = useMemo(
    () => buildCareerTrajectory(state.profile),
    [state.profile],
  );

  const analyzeScene = useCallback(
    async (imageDataUrl: string) => {
      if (agentRequestInFlightRef.current !== null) {
        return;
      }
      const requestId = activeRequestRef.current + 1;
      activeRequestRef.current = requestId;
      agentRequestInFlightRef.current = requestId;
      setBusy(true);
      setLoadingStep(0);
      setUiError(undefined);
      setHealth({ status: "checking" });
      setLastAttemptImage(imageDataUrl);

      const timer = window.setInterval(() => {
        setLoadingStep((step) => Math.min(step + 1, 3));
      }, 760);

      try {
        const response = await fetchWithTimeout(
          "/api/agent",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "scene_event",
              currentImageDataUrl: imageDataUrl,
              previousImageDataUrl: previousImageRef.current,
              ...requestContext,
            }),
          },
          AGENT_REQUEST_TIMEOUT_MS,
        );
        const raw: unknown = await response.json();
        const parsed = AgentApiResponseSchema.safeParse(raw);

        if (activeRequestRef.current !== requestId) {
          return;
        }
        if (!parsed.success) {
          setUiError({
            message:
              "RockedIN Agent returned an unreadable response. The profile was preserved.",
            retryable: true,
            source: "scene",
          });
          setHealth({
            status: "error",
            message: "OpenAI returned an unreadable response.",
          });
          return;
        }
        if (!parsed.data.ok) {
          setUiError({
            message: parsed.data.error.message,
            retryable: parsed.data.error.retryable,
            source: "scene",
          });
          setHealth({
            status: "error",
            message: parsed.data.error.message,
          });
          return;
        }
        if (parsed.data.mode !== "scene_event") {
          setUiError({
            message: "RockedIN Agent returned the wrong workflow response.",
            retryable: true,
            source: "scene",
          });
          setHealth({
            status: "error",
            message: "OpenAI returned the wrong workflow response.",
          });
          return;
        }
        setHealth({
          status: "connected",
          model: parsed.data.model,
          latencyMs: parsed.data.latencyMs,
          checkedAt: new Date().toISOString(),
        });
        if (parsed.data.result.kind === "none") {
          setTransientReceipt({
            model: parsed.data.model,
            sceneSummary: parsed.data.result.agentReceipt.sceneSummary,
            careerSummary: parsed.data.result.agentReceipt.careerSummary,
            materialsCreated: [],
            profileChanges: [],
            latencyMs: parsed.data.latencyMs,
            live: true,
            createdAt: new Date().toISOString(),
          });
          setUiError({
            message:
              parsed.data.result.reason ||
              "No employable mineral detected. Reposition the rock and try again.",
            retryable: true,
            source: "scene",
          });
          return;
        }

        const now = new Date().toISOString();
        dispatch({
          type: "APPLY_SCENE_EVENT",
          result: parsed.data.result,
          model: parsed.data.model,
          latencyMs: parsed.data.latencyMs,
          imageDataUrl,
          now,
        });
        previousImageRef.current = imageDataUrl;
        setLatestImage(imageDataUrl);
        setTransientReceipt(undefined);
        setUiError(undefined);
      } catch {
        if (activeRequestRef.current === requestId) {
          setUiError({
            message: "Unable to reach RockedIN Agent. Check the network and retry.",
            retryable: true,
            source: "scene",
          });
          setHealth({
            status: "error",
            message: "Unable to reach RockedIN Agent.",
          });
        }
      } finally {
        window.clearInterval(timer);
        if (agentRequestInFlightRef.current === requestId) {
          agentRequestInFlightRef.current = null;
        }
        if (activeRequestRef.current === requestId) {
          setBusy(false);
          setLoadingStep(3);
        }
      }
    },
    [requestContext],
  );

  const runHumanReview = async () => {
    if (agentRequestInFlightRef.current !== null) {
      return;
    }
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    agentRequestInFlightRef.current = requestId;
    setFinaleBusy(true);
    setUiError(undefined);
    setHealth({ status: "checking" });

    try {
      const response = await fetchWithTimeout(
        "/api/agent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "human_review", ...requestContext }),
        },
        AGENT_REQUEST_TIMEOUT_MS,
      );
      const raw: unknown = await response.json();
      const parsed = AgentApiResponseSchema.safeParse(raw);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      if (!parsed.success || !parsed.data.ok) {
        setUiError({
          message:
            parsed.success && !parsed.data.ok
              ? parsed.data.error.message
              : "The human review response was unreadable.",
          retryable: true,
          source: "finale",
        });
        setHealth({
          status: "error",
          message:
            parsed.success && !parsed.data.ok
              ? parsed.data.error.message
              : "OpenAI returned an unreadable human review.",
        });
        return;
      }
      if (parsed.data.mode !== "human_review") {
        setUiError({
          message: "RockedIN Agent returned the wrong workflow response.",
          retryable: true,
          source: "finale",
        });
        setHealth({
          status: "error",
          message: "OpenAI returned the wrong workflow response.",
        });
        return;
      }

      const now = new Date().toISOString();
      dispatch({
        type: "APPLY_HUMAN_REVIEW",
        result: parsed.data.result,
        now,
      });
      setHealth({
        status: "connected",
        model: parsed.data.model,
        latencyMs: parsed.data.latencyMs,
        checkedAt: now,
      });
      setVisibleFinale(parsed.data.result);
    } catch {
      if (activeRequestRef.current === requestId) {
        setUiError({
          message:
            "Unable to complete the human review. Check the network and retry.",
          retryable: true,
          source: "finale",
        });
        setHealth({
          status: "error",
          message: "Unable to reach RockedIN Agent.",
        });
      }
    } finally {
      if (agentRequestInFlightRef.current === requestId) {
        agentRequestInFlightRef.current = null;
      }
      if (activeRequestRef.current === requestId) {
        setFinaleBusy(false);
      }
    }
  };

  const testHealth = async () => {
    setHealth({ status: "checking" });
    try {
      const response = await fetchWithTimeout(
        "/api/health",
        { method: "POST" },
        HEALTH_REQUEST_TIMEOUT_MS,
      );
      const raw: unknown = await response.json();
      const parsed = HealthApiResponseSchema.safeParse(raw);
      if (!parsed.success) {
        setHealth({
          status: "error",
          message: "OpenAI health response could not be parsed.",
        });
      } else if (!parsed.data.ok) {
        setHealth({
          status: "error",
          message: parsed.data.error.message,
        });
      } else {
        setHealth({
          status: "connected",
          model: `${formatModelName(parsed.data.models.scene)} + ${formatModelName(parsed.data.models.humanReview)}`,
          latencyMs: parsed.data.latencyMs,
          checkedAt: parsed.data.checkedAt,
        });
      }
    } catch {
      setHealth({
        status: "error",
        message: "Unable to reach the health route.",
      });
    }
  };

  const resetDemo = () => {
    const confirmed = window.confirm(
      "Reset Batu to Unemployed Mineral and clear the demo?",
    );
    if (!confirmed) {
      return;
    }
    activeRequestRef.current += 1;
    agentRequestInFlightRef.current = null;
    clearPersistedState();
    previousImageRef.current = undefined;
    setBusy(false);
    setFinaleBusy(false);
    setLoadingStep(0);
    setCustomProfileImage(undefined);
    setProfileImageError(undefined);
    setNameEditing(false);
    setNameDraft("");
    setNameError(undefined);
    setLatestImage(undefined);
    setLastAttemptImage(undefined);
    setUiError(undefined);
    setTransientReceipt(undefined);
    setVisibleFinale(undefined);
    setHealth({ status: "idle" });
    setResetVersion((value) => value + 1);
    dispatch({ type: "RESET" });
  };

  const updateProfileImage = async (file?: File) => {
    if (!file) {
      return;
    }

    setProfileImageError(undefined);
    try {
      setCustomProfileImage(await compressImageFile(file));
    } catch {
      setProfileImageError("Choose a valid JPG, PNG, or WebP image.");
    } finally {
      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = "";
      }
    }
  };

  const beginNameEdit = () => {
    setNameDraft(state.profile.name);
    setNameError(undefined);
    setNameEditing(true);
  };

  const cancelNameEdit = () => {
    setNameEditing(false);
    setNameDraft("");
    setNameError(undefined);
  };

  const saveName = () => {
    const nextName = nameDraft.trim().replace(/\s+/g, " ");
    if (!nextName) {
      setNameError("Enter a profile name.");
      return;
    }

    dispatch({ type: "UPDATE_PROFILE_NAME", name: nextName });
    setNameEditing(false);
    setNameDraft("");
    setNameError(undefined);
  };

  const togglePresentation = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setPresentationMode((value) => !value);
    }
  };

  const latestPost = state.posts[0];
  const receipt = transientReceipt ?? state.lastAgentReceipt;
  const profileImage =
    customProfileImage ?? latestImage ?? latestPost?.imageDataUrl;
  const agentStatusLabel =
    health.status === "connected"
      ? "RockedIN Agent Online"
      : health.status === "checking"
        ? "Checking OpenAI"
        : health.status === "error"
          ? "Agent offline"
          : "Agent ready";
  const closeFinale = useCallback(() => setVisibleFinale(undefined), []);
  const closePostPreview = useCallback(() => setPostPreviewOpen(false), []);

  return (
    <>
      <div
        className={`app-shell${presentationMode ? " presentation-mode" : ""}`}
        aria-hidden={visibleFinale || postPreviewOpen ? true : undefined}
        inert={visibleFinale || postPreviewOpen ? true : undefined}
      >
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-logo-frame">
            <Image
              src="/logo/rockedin-logo.png"
              alt="RockedIn"
              fill
              sizes="220px"
              className="brand-logo"
              loading="eager"
            />
          </div>
          <p>Every position is a new position.</p>
        </div>

        <div className="header-right">
          <div
            className={`agent-online agent-online-${health.status}`}
            aria-live="polite"
          >
            {health.status === "connected" ? (
              <CircleCheck aria-hidden="true" />
            ) : health.status === "error" ? (
              <CircleAlert aria-hidden="true" />
            ) : (
              <Activity aria-hidden="true" />
            )}
            <span>{agentStatusLabel}</span>
          </div>
          <div className="qwen-lockup">
            <span>OpenAI / GPT-5.6 Luna</span>
          </div>
          <div className="header-metrics" aria-label="RockedIN metrics">
            <div className="header-metric">
              <strong
                key={state.profile.connections}
                className="connection-count"
              >
                {state.profile.connections >= 500
                  ? "500+"
                  : state.profile.connections}
              </strong>
              <span>connections</span>
            </div>
            <div className="header-metric">
              <strong>{state.profile.thoughts}</strong>
              <span>thoughts</span>
            </div>
            <div className="header-metric">
              <strong>{state.profile.netWorthGrams}g</strong>
              <span>net worth</span>
            </div>
          </div>
          <button
            className="icon-button header-icon-button"
            type="button"
            aria-label={
              presentationMode
                ? "Exit presentation mode"
                : "Enter presentation mode"
            }
            title={
              presentationMode
                ? "Exit presentation mode"
                : "Presentation mode"
            }
            aria-pressed={presentationMode}
            onClick={() => void togglePresentation()}
          >
            {presentationMode ? (
              <Minimize2 aria-hidden="true" />
            ) : (
              <Maximize2 aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <main className="dashboard">
        <aside className="profile-surface" aria-labelledby="profile-heading">
          <SectionTitle
            eyebrow="LIVING PROFILE"
            icon={ContactRound}
            title="Titles, skills and history evolve."
          />

          <div className="profile-identity">
            <div className="profile-photo-column">
              <div className="profile-photo">
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImage}
                    alt={`${state.profile.name} profile`}
                  />
                ) : (
                  <Gem aria-hidden="true" />
                )}
              </div>
              <input
                ref={profileImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) =>
                  void updateProfileImage(event.target.files?.[0])
                }
              />
              <button
                className="profile-photo-edit-button"
                type="button"
                aria-label="Change profile picture"
                title="Change profile picture"
                onClick={() => profileImageInputRef.current?.click()}
              >
                <Pencil aria-hidden="true" />
                <span>Edit photo</span>
              </button>
            </div>
            <div className="profile-copy">
              <div className="profile-name-row">
                <h2 id="profile-heading">{state.profile.name}</h2>
                {!nameEditing ? (
                  <button
                    className="profile-name-edit"
                    type="button"
                    aria-label="Edit profile name"
                    title="Edit name"
                    onClick={beginNameEdit}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {nameEditing ? (
                <form
                  className="profile-name-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveName();
                  }}
                >
                  <input
                    ref={nameInputRef}
                    value={nameDraft}
                    maxLength={180}
                    aria-label="Profile name"
                    aria-invalid={Boolean(nameError)}
                    onChange={(event) => {
                      setNameDraft(event.target.value);
                      if (nameError) {
                        setNameError(undefined);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelNameEdit();
                      }
                    }}
                  />
                  <button
                    className="profile-name-action profile-name-save"
                    type="submit"
                    aria-label="Save profile name"
                    title="Save name"
                  >
                    <Check aria-hidden="true" />
                  </button>
                  <button
                    className="profile-name-action"
                    type="button"
                    aria-label="Cancel profile name edit"
                    title="Cancel"
                    onClick={cancelNameEdit}
                  >
                    <X aria-hidden="true" />
                  </button>
                </form>
              ) : null}
              {nameError ? (
                <p className="profile-name-error" role="alert">
                  {nameError}
                </p>
              ) : null}
              <p className="profile-title">{state.profile.currentTitle}</p>
              <p className="profile-headline">{state.profile.headline}</p>
            </div>
          </div>
          {profileImageError ? (
            <p className="profile-image-error" role="alert">
              {profileImageError}
            </p>
          ) : null}

          <dl className="profile-facts">
            <div>
              <dt>
                <MapPin aria-hidden="true" />
                <span>Location</span>
              </dt>
              <dd>{state.profile.location}</dd>
            </div>
            <div>
              <dt>
                <BriefcaseBusiness aria-hidden="true" />
                <span>Experience</span>
              </dt>
              <dd>{state.profile.experienceLabel}</dd>
            </div>
            <div>
              <dt>
                <UsersRound aria-hidden="true" />
                <span>Connections</span>
              </dt>
              <dd
                key={state.profile.connections}
                className="connection-count"
              >
                {formatNumber.format(state.profile.connections)}
              </dd>
            </div>
          </dl>

          <section className="profile-section">
            <h3>Skills</h3>
            <div className="tag-list">
              {state.profile.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </section>

          <section className="profile-section">
            <h3>Certifications</h3>
            {state.certifications.length ? (
              state.certifications.slice(0, 3).map((certification) => (
                <div className="certification-row" key={certification.id}>
                  <Award aria-hidden="true" />
                  <div>
                    <strong>{certification.name}</strong>
                    <span>{certification.issuer}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted-copy">No executive education yet.</p>
            )}
          </section>

          <section className="profile-section career-history">
            <h3>Career history</h3>
            {state.profile.careerHistory.slice(0, 6).map((item) => (
              <div className="history-row" key={item.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.physicalTrigger}</p>
                </div>
              </div>
            ))}
          </section>
        </aside>

        <div className="center-column">
          <CameraCapture
            key={resetVersion}
            busy={busy}
            loadingStep={loadingStep}
            onAnalyze={analyzeScene}
            sampleImages={sampleImages}
          />

          <section className="post-surface" aria-labelledby="post-heading">
            <div className="section-heading-row">
              <div>
                <SectionEyebrow icon={MessageCircle}>
                  ROCKHARD CAREER POSTS
                </SectionEyebrow>
                <h2 id="post-heading">Humblebrags written automatically.</h2>
              </div>
              {latestPost ? (
                <div className="post-heading-actions">
                  <span className="just-now">Just now</span>
                  <button
                    className="post-preview-trigger"
                    type="button"
                    onClick={() => setPostPreviewOpen(true)}
                  >
                    <Maximize2 aria-hidden="true" />
                    Preview post
                  </button>
                </div>
              ) : null}
            </div>

            {uiError?.source === "scene" ? (
              <div className="global-error" role="alert">
                <div>
                  <strong>Corporate alignment issue</strong>
                  <p>{uiError.message}</p>
                </div>
                {uiError.retryable && lastAttemptImage ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void analyzeScene(lastAttemptImage)}
                  >
                    <RefreshCw aria-hidden="true" />
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}

            {latestPost ? (
              <article className="career-post">
                <div className="post-topline">
                  <div className="post-author">
                    <div className="post-avatar">
                      <Gem aria-hidden="true" />
                    </div>
                    <div>
                      <strong>{state.profile.name}</strong>
                      <span>{latestPost.titleAtPublication}</span>
                    </div>
                  </div>
                  {latestPost.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="post-scene-thumb"
                      src={latestPost.imageDataUrl}
                      alt={`Captured scene for ${latestPost.titleAtPublication}`}
                    />
                  ) : null}
                </div>
                <h3>{latestPost.titleAtPublication}</h3>
                <p className="post-body">{latestPost.body}</p>
                <div className="hashtags">
                  {latestPost.hashtags.map((hashtag) => (
                    <span key={hashtag}>{hashtag}</span>
                  ))}
                </div>
                <div className="post-engagement">
                  <span>Solid {latestPost.solidCount}</span>
                  <span>Groundbreaking</span>
                  <span>Hard Agree</span>
                  <span>{latestPost.commentCount} comments</span>
                </div>
                <div className="comments">
                  {latestPost.comments.map((comment) => (
                    <div key={`${comment.author}-${comment.text}`}>
                      <strong>{comment.author}</strong>
                      <span>{comment.title}</span>
                      <p>{comment.text}</p>
                    </div>
                  ))}
                </div>
              </article>
            ) : (
              <div className="empty-post">
                <blockquote>
                  “Open to Work. Closed to Movement.”
                </blockquote>
                <p>
                  Batu&apos;s next physical position will become his first
                  professional position.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="agent-surface" aria-labelledby="agent-heading">
          <div className="agent-content">
            <section className="agent-receipt-section">
              <SectionTitle
                eyebrow="ROCKEDIN AGENT"
                icon={Cpu}
                title="Live OpenAI call receipt."
              />
              <div
                className={`receipt-status${
                  receipt?.live ? " receipt-status-live" : ""
                }`}
              >
                <ShieldCheck aria-hidden="true" />
                <div>
                  <strong id="agent-heading">
                    {receipt?.live
                      ? "Validated live result"
                      : receipt
                        ? "Stored prior result"
                        : "Ready for scene"}
                  </strong>
                  <span>
                    {formatModelName(receipt?.model ?? DEFAULT_SCENE_MODEL)}
                  </span>
                </div>
                {receipt?.latencyMs !== undefined ? (
                  <span className="latency">
                    {(receipt.latencyMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </div>
              <dl className="receipt-grid">
                <div>
                  <dt>Detected</dt>
                  <dd>
                    {receipt?.sceneSummary ??
                      "Waiting for Batu's next physical position."}
                  </dd>
                </div>
                <div>
                  <dt>Career event</dt>
                  <dd>{receipt?.careerSummary ?? "No event created yet."}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>
                    {receipt?.materialsCreated.join(", ") ||
                      "Title, post, hashtags, comments"}
                  </dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>
                    {receipt?.profileChanges.join(", ") ||
                      "Profile, history, analytics"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="network-section">
              <SectionTitle
                eyebrow="ROCK NETWORK"
                icon={Network}
                title="Two rocks crash."
              />
              {state.connections.length ? (
                state.connections.slice(0, 2).map((connection) => (
                  <div className="network-row" key={connection.id}>
                    <Handshake aria-hidden="true" />
                    <div>
                      <strong>{connection.name}</strong>
                      <span>{connection.title}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="network-empty">
                  <UsersRound aria-hidden="true" />
                  <span>One connection away from 500.</span>
                </div>
              )}
            </section>

            <section className="career-ladder-section">
              <SectionTitle
                eyebrow="LIVE CAREER TRAJECTORY"
                icon={Route}
                title="Every scene adds a position."
              />
              <ol className="career-ladder">
                {careerTrajectory.map((stage, index) => (
                  <li
                    className={
                      index === careerTrajectory.length - 1
                        ? "ladder-current"
                        : "ladder-complete"
                    }
                    key={stage.id}
                  >
                    <span>
                      {index < careerTrajectory.length - 1 ? (
                        <Check aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    {stage.title}
                  </li>
                ))}
              </ol>
            </section>

            <section className="analytics-section">
              <SectionTitle
                eyebrow="ROCK ANALYTICS"
                icon={BarChart3}
                title="99.99% inactivity uptime."
              />
              <div className="analytics-grid">
                <Metric
                  icon={TrendingUp}
                  label="Profile views"
                  value={formatNumber.format(state.analytics.profileViews)}
                />
                <Metric
                  icon={BarChart3}
                  label="Impressions"
                  value={formatNumber.format(state.analytics.impressions)}
                />
                <Metric
                  icon={BriefcaseBusiness}
                  label="Relocations"
                  value={String(state.analytics.relocations)}
                />
                <Metric
                  icon={Clock3}
                  label="Uptime"
                  value={`${state.profile.inactivityUptime}%`}
                />
              </div>
            </section>

          </div>

          <div className="agent-actions">
            {uiError?.source === "finale" ? (
              <div className="finale-error" role="alert">
                <p>{uiError.message}</p>
                {uiError.retryable ? (
                  <button
                    className="utility-button"
                    type="button"
                    disabled={finaleBusy}
                    onClick={() => void runHumanReview()}
                  >
                    <RefreshCw aria-hidden="true" />
                    Retry review
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              className="finale-button"
              type="button"
              disabled={busy || finaleBusy}
              onClick={() => void runHumanReview()}
            >
              <UserRoundCog aria-hidden="true" />
              {finaleBusy ? "Reviewing Human..." : "Review My Human"}
            </button>
            <div className="utility-actions">
              <button
                className="utility-button"
                type="button"
                disabled={health.status === "checking"}
                onClick={() => void testHealth()}
              >
                <Activity aria-hidden="true" />
                {health.status === "checking" ? "Testing..." : "Test OpenAI"}
              </button>
              <button
                className="utility-button"
                type="button"
                onClick={resetDemo}
              >
                <RotateCcw aria-hidden="true" />
                Reset Demo
              </button>
            </div>
            <div
              className={`health-readout health-${health.status}`}
              aria-live="polite"
            >
              <span aria-hidden="true" />
              {health.status === "connected"
                ? `${health.model} · ${health.latencyMs}ms · ${formatHealthTime(health.checkedAt)}`
                : health.status === "error"
                  ? health.message
                  : "Health check not run"}
            </div>
          </div>
        </aside>
      </main>

      </div>

      {postPreviewOpen && latestPost ? (
        <PostPreviewOverlay
          post={latestPost}
          profileName={state.profile.name}
          profileImage={profileImage}
          onClose={closePostPreview}
        />
      ) : null}

      {visibleFinale ? (
        <FinaleOverlay
          result={visibleFinale}
          onClose={closeFinale}
        />
      ) : null}
    </>
  );
}
