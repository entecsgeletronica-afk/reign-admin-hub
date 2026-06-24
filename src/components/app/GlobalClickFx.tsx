import * as React from "react";

/**
 * GlobalClickFx
 * -------------
 * Adds a tiny click "tick" sound + visual press animation to every
 * actionable element in the app (buttons, links, role=button, summary).
 *
 * Triggers on:
 *   - pointerdown   — mouse / touch / pen taps
 *   - keydown       — Enter / Space activation via keyboard, so users
 *                     navigating with the keyboard get the same feedback
 *                     as pointer users (matches the spec for which key
 *                     activates which element: Enter for links, Enter+
 *                     Space for buttons / role="button" / summary).
 *
 * - Audio: built with WebAudio (no asset deps). Lazily creates the
 *   AudioContext on the first user gesture so we comply with the browser
 *   autoplay policy.
 * - Visual: temporarily adds a `data-click-fx` attribute that triggers a
 *   CSS keyframe defined in `src/styles.css` (.click-fx-pulse).
 *
 * Listener uses event delegation on `document` with `capture: true` so we
 * intercept the event before any stopPropagation deeper in the tree.
 *
 * Accessibility:
 *   - prefers-reduced-motion: when the user requests reduced motion at
 *     the OS / browser level we suppress BOTH the visual pulse and the
 *     audio tick. Audio is treated as a movement-equivalent cue here
 *     because vestibular/sensory-sensitive users who enable reduce-motion
 *     usually also want fewer unsolicited UI sounds (matches Apple's
 *     "Reduce Motion" + "Reduce Loud Sounds" pairing and many a11y
 *     guidelines that bundle non-essential audio with non-essential
 *     animation).
 *   - aria-hidden ancestors: elements hidden from assistive tech can
 *     still be reached by programmatic events; we skip feedback there
 *     because the AT user has no way to associate the cue with a
 *     control they can perceive.
 *   - role="presentation" / role="none": same reasoning — the element
 *     advertises itself as non-interactive to AT, so audio feedback
 *     would confuse rather than help.
 */
export function GlobalClickFx() {
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const lastPlayRef = React.useRef(0);
  // Reactive snapshot of the user's "reduce motion" preference. Stored in
  // a ref so the event handlers read it synchronously without a re-render,
  // and updated by a media-query change listener below so OS-level toggles
  // take effect immediately (no page reload required).
  const reduceMotionRef = React.useRef(false);

  React.useEffect(() => {
    // ── prefers-reduced-motion subscription ──────────────────────────────
    // Initial read + live updates. Falls back to "false" on environments
    // without matchMedia (older WebViews) so feedback isn't silently
    // suppressed for everyone there.
    const mql =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let mqlCleanup: (() => void) | null = null;
    if (mql) {
      reduceMotionRef.current = mql.matches;
      const onChange = (ev: MediaQueryListEvent) => {
        reduceMotionRef.current = ev.matches;
      };
      mql.addEventListener("change", onChange);
      mqlCleanup = () => mql.removeEventListener("change", onChange);
    }

    function getCtx(): AudioContext | null {
      if (typeof window === "undefined") return null;
      if (!audioCtxRef.current) {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return null;
        try {
          audioCtxRef.current = new Ctor();
        } catch {
          return null;
        }
      }
      return audioCtxRef.current;
    }

    function playClick() {
      // Throttle so a "double-click" doesn't sound like a stutter.
      const now = performance.now();
      if (now - lastPlayRef.current < 40) return;
      lastPlayRef.current = now;
      try {
        const ctx = getCtx();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume();
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        // Short, bright "tick" — softer than a UI beep so it stays pleasant
        // when a child mashes buttons.
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(540, t + 0.06);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        osc.start(t);
        osc.stop(t + 0.1);
      } catch {
        /* ignore audio errors */
      }
    }

    function findActionable(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      // Match the first ancestor that's an interactive control.
      return target.closest<HTMLElement>(
        'button, a[href], [role="button"], summary, [data-click-sound="true"]',
      );
    }

    /**
     * Returns true when the visual press flash should be suppressed for
     * this element on this activation. Sound still plays — only the
     * `data-click-fx` keyframe is skipped, because the keyframe re-running
     * on top of an existing open-state animation (Radix tooltip/popover
     * open transition, dropdown menu reveal, etc.) reads as a flicker.
     *
     * Suppression rules:
     *   1. data-state="open"        — Radix triggers expose this while the
     *      paired surface is mounted (Popover/Tooltip/Dropdown/Dialog
     *      triggers, accordion items). Re-pressing to close should not
     *      double-flash on top of the close animation either, so we treat
     *      ANY non-"closed" state as a conflict.
     *   2. aria-expanded="true"     — generic ARIA equivalent for menus
     *      and disclosure triggers that don't use Radix.
     *   3. data-click-fx="1"        — a previous flash is still mid-frame.
     *      Re-applying the attribute restarts the animation, which on
     *      fast double-clicks looks like jitter; let the running one
     *      finish instead.
     *   4. data-no-click-fx="true"  — manual opt-out for one-off cases
     *      (e.g. a swatch button that already runs its own scale anim).
     */
    function shouldSkipVisualFx(el: HTMLElement): boolean {
      if (el.dataset.noClickFx === "true") return true;
      if (el.getAttribute("data-click-fx") === "1") return true;
      const state = el.getAttribute("data-state");
      if (state && state !== "closed") return true;
      if (el.getAttribute("aria-expanded") === "true") return true;
      return false;
    }

    /**
     * Shared feedback routine — plays the click sound and toggles the
     * `data-click-fx` attribute that drives the CSS press animation.
     * Used by BOTH the pointerdown and keydown handlers so behaviour is
     * identical regardless of input modality.
     *
     * The visual flash is suppressed (per shouldSkipVisualFx) when the
     * element already has its own ongoing animation/tooltip/popover state,
     * to avoid the double-animation flicker the user reported. Sound is
     * NOT suppressed — the user still triggered an action, so the
     * auditory acknowledgment remains useful feedback.
     */
    /**
     * Returns true when the element (or any ancestor) is hidden from
     * assistive technology. We check both `aria-hidden="true"` and the
     * `inert` attribute — both signal "this control is not perceivable
     * by AT users", so firing audio feedback for it would create a
     * sound with no findable source for screen-reader users.
     */
    function isHiddenFromAT(el: HTMLElement): boolean {
      let node: HTMLElement | null = el;
      while (node) {
        if (node.getAttribute("aria-hidden") === "true") return true;
        if (node.hasAttribute("inert")) return true;
        node = node.parentElement;
      }
      return false;
    }

    /**
     * True when the element is structurally non-interactive for AT users
     * — role="presentation"/role="none" explicitly removes the element's
     * implicit role, so screen readers will not announce it as a control
     * even if it visually looks like one. Skip audio feedback for these.
     */
    function isPresentational(el: HTMLElement): boolean {
      const role = el.getAttribute("role");
      return role === "presentation" || role === "none";
    }

    function triggerFx(
      el: HTMLElement,
      coords?: { clientX: number; clientY: number },
    ) {
      // Skip explicitly opted-out controls (range sliders, color swatches
      // inside the painter, etc. can opt out via data-click-sound="false").
      if (el.dataset.clickSound === "false") return;
      // Skip disabled controls.
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
        return;
      }

      // ── Accessibility gates ────────────────────────────────────────────
      // 1) Reduce-motion users: suppress BOTH sound and pulse. Audio cues
      //    are bundled with motion here because OS reduce-motion settings
      //    typically pair with "minimize unnecessary effects" — a child
      //    using these settings shouldn't be startled by a tick they
      //    didn't ask for. They still get the action's real outcome
      //    (navigation, fill, modal open) — only the gratuitous tick is
      //    skipped.
      // 2) AT-hidden controls: aria-hidden / inert ancestors mean a
      //    screen reader cannot reach this element, so any tick would
      //    have no perceivable source. Better to stay silent.
      // 3) Presentational roles: same reasoning — the element advertises
      //    itself as not-a-control to AT, so audio would be misleading.
      const reduceMotion = reduceMotionRef.current;
      // Audio click cue disabled globally — kept code path for future toggling.
      // (Removed per user request: dashboard click sound was distracting.)

      // Visual flash respects all the same gates plus the existing
      // "already animating" / opt-out checks. Reduce-motion users opt out
      // of the keyframe entirely.
      if (reduceMotion) return;
      if (shouldSkipVisualFx(el)) return;

      // For the ripple variant (data-press-fx="ripple"), set the click
      // coordinates as CSS variables so the circle expands from the
      // actual press point. Pure-HTML usages (no React Pressable wrapper)
      // get this for free; the React hook overrides these on its own
      // pointerdown handler when needed. If we don't have coordinates
      // (keyboard activation via Enter/Space), the CSS falls back to
      // the element center (var(--press-x, 50%) / 50%).
      if (coords && el.dataset.pressFx === "ripple") {
        const rect = el.getBoundingClientRect();
        const x = coords.clientX - rect.left;
        const y = coords.clientY - rect.top;
        el.style.setProperty("--press-x", `${x}px`);
        el.style.setProperty("--press-y", `${y}px`);
      }

      el.setAttribute("data-click-fx", "1");
      window.setTimeout(() => {
        if (el.getAttribute("data-click-fx") === "1") {
          el.removeAttribute("data-click-fx");
        }
      }, 220);
    }

    function onPointerDown(ev: PointerEvent) {
      const el = findActionable(ev.target);
      if (!el) return;
      // Forward the press coordinates so the ripple variant can expand
      // from the actual click point (CSS falls back to center otherwise).
      triggerFx(el, { clientX: ev.clientX, clientY: ev.clientY });
    }

    /**
     * Returns true when the key event would activate the element per the
     * native HTML/ARIA spec. We mirror the browser's own activation rules
     * so the feedback fires exactly when the click is about to happen.
     *   • <a href>            → Enter only
     *   • <button>, role=button, summary, [data-click-sound=true]
     *                         → Enter or Space
     */
    function isActivationKey(el: HTMLElement, key: string): boolean {
      if (key === "Enter") return true;
      if (key !== " " && key !== "Spacebar") return false;
      // Space activates buttons & button-like controls but NOT plain anchors.
      const tag = el.tagName.toLowerCase();
      if (tag === "a") return false;
      return true;
    }

    function onKeyDown(ev: KeyboardEvent) {
      // Ignore key repeats so holding Enter doesn't fire a stream of ticks.
      if (ev.repeat) return;
      // Ignore IME composition (CJK input) — these aren't activations.
      if (ev.isComposing) return;
      // Ignore modified keys (Ctrl/Alt/Meta) — those are app shortcuts,
      // not button activations. Shift+Enter on a button still activates,
      // so we explicitly allow shiftKey through.
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
      // Ignore keys that aren't activation keys at all — cheap pre-check
      // before walking the DOM with closest().
      if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;

      // Skip keys typed into editable fields — Enter/Space there means
      // "type a character" or "submit", not "click feedback".
      const target = ev.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        if (target.isContentEditable) return;
      }

      const el = findActionable(target);
      if (!el) return;
      if (!isActivationKey(el, ev.key)) return;
      triggerFx(el);
    }

    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      // Detach the prefers-reduced-motion media-query listener so we don't
      // leak it across hot-reloads (or future re-mounts of this provider).
      mqlCleanup?.();
      // Best-effort: close the audio context so we don't leak it across
      // hot-reloads in dev.
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  return null;
}
