# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-07-25
- Primary product surfaces: RockedIN dashboard, camera capture, image upload, generated career post, agent receipt.
- Evidence reviewed: `README.md`, `src/components/RockedInApp.tsx`, `src/components/CameraCapture.tsx`, `src/app/globals.css`, `public/logo/`.

## Brand
- Personality: Professional dashboard language with restrained corporate parody.
- Trust signals: Visible camera state, live agent receipt, clear loading stages, recoverable errors.
- Avoid: Marketing-page layouts, decorative gradients, oversized type, and controls that compete with the primary capture action.

## Product goals
- Goals: Make it fast to turn a Batu scene into a career event and make the live AI path understandable.
- Non-goals: Photo management, account storage, or a general-purpose media library.
- Success signals: Users can choose a source, preview it, and promote it without leaving the capture context.

## Personas and jobs
- Primary personas: Demo participants and presenters using desktop or mobile cameras.
- User jobs: Capture a new scene, upload an existing scene, or try a prepared sample before running the same analysis flow.
- Key contexts of use: Live demos, camera-restricted browsers, mobile devices, and first-time visitors without a Batu photo.

## Information architecture
- Primary navigation: Single-screen dashboard with profile, capture/post, and agent columns.
- Core routes/screens: `/` and server API routes under `/api`.
- Content hierarchy: Capture source and promotion action first, generated post second, supporting profile and agent data around them.

## Design principles
- Keep source selection at the point of capture: Camera, upload, and samples belong in one workflow.
- Preserve action hierarchy: Capture and promote remains primary; upload is secondary; samples are a tertiary fallback.
- Tradeoffs: The sample gallery opens in an overlay so additional assets do not shrink the live preview or dense dashboard layout.

## Visual language
- Color: Existing white surfaces, cobalt actions, charcoal text, muted gray support text, and green live status.
- Typography: Existing Geist families and compact dashboard scale.
- Spacing/layout rhythm: Existing 8px-oriented gaps and 14-16px surface padding.
- Shape/radius/elevation: Existing 6-8px radii and restrained shadows.
- Motion: Short loading rotation only; respect reduced-motion preferences.
- Imagery/iconography: Real Batu sample images and semantic Lucide SVG icons on every uppercase section label.

## Components
- Existing components to reuse: `CameraCapture`, `primary-button`, `secondary-button`, `icon-button`, and native dialog semantics.
- New/changed components: Shared `SectionEyebrow`, sample gallery trigger, and sample image dialog inside `CameraCapture`.
- Variants and states: Empty/disabled, open, loading a sample, selected preview, load error, mobile full-width trigger.
- Token/component ownership: Continue using variables and component classes in `src/app/globals.css`.

## Accessibility
- Target standard: WCAG 2.1 AA interaction and contrast expectations.
- Keyboard/focus behavior: Native modal focus handling, Escape dismissal, visible focus, labeled controls, and focus return to the trigger.
- Contrast/readability: Reuse the existing tested text and control palette.
- Screen-reader semantics: Dialog labeling, decorative thumbnail alt text, explicit button labels, and polite loading status.
- Reduced motion and sensory considerations: Disable spinner animation under `prefers-reduced-motion`.

## Responsive behavior
- Supported breakpoints/devices: Existing desktop dashboard, two-column tablet, and single-column layout below 800px.
- Layout adaptations: The center workflow keeps more horizontal space than the profile rail; tertiary sample trigger is icon-only on desktop and labeled/full-width on mobile; gallery reduces columns on narrow screens.
- Touch/hover differences: Minimum 44px touch targets and no hover-only instructions.

## Interaction states
- Loading: Disable gallery choices and show a loading indicator on the selected sample.
- Empty: Keep the sample control visibly disabled until supported files are present.
- Error: Return to the capture surface and show the existing inline error pattern.
- Success: Close the gallery and show the selected image in the existing preview.
- Disabled: Sample control is disabled when no discovered images exist or analysis is busy.
- Offline/slow network, if applicable: Keep the dialog open while a sample loads; surface a recoverable error if retrieval fails.

## Content voice
- Tone: Concise, direct, and lightly corporate.
- Terminology: Use "sample photo", "scene", and "promote" consistently.
- Microcopy rules: Labels should identify actions or state without explaining the interface.

## Implementation constraints
- Framework/styling system: Next.js App Router, React client components, global CSS, and Lucide icons.
- Design-token constraints: Extend existing CSS variables and button patterns; add no new design system or dependency.
- Performance constraints: Discover local assets on the server and compress the chosen sample through the existing image pipeline.
- Compatibility constraints: Supported sample formats are JPG, JPEG, PNG, and WebP in `public/sample-images`.
- Test/screenshot expectations: Lint, production build, existing verification scripts, and desktop/mobile visual checks.

## Open questions
- [ ] Final sample image filenames and editorial order / product owner / affects gallery labels and ordering.
