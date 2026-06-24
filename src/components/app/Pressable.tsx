import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Press feedback system — React surface
 * -------------------------------------
 * Three small, composable pieces that share the same CSS keyframes
 * defined in `src/styles.css` (.press-pulse / .press-ripple), so every
 * "press" feedback in the app looks and feels identical regardless of
 * where it lives in the tree.
 *
 *   1. `pressable(variant?)`  — a class-name helper for use with cn().
 *      Drop into any existing className to get consistent feedback
 *      without restructuring the component. Pairs with GlobalClickFx
 *      for the actual trigger; here we only opt into the variant.
 *
 *   2. `usePressableRipple()` — a hook that returns an onPointerDown
 *      handler which writes the click coordinates as CSS variables
 *      (--press-x / --press-y). Required ONLY when using the ripple
 *      variant — without it the ripple is centered.
 *
 *   3. `<Pressable>`           — a thin render-prop wrapper for cases
 *      where you want both the class AND the coordinate handler
 *      auto-wired. Renders a `<button>` by default; override via `as`.
 *
 * GlobalClickFx (the document-level listener) reads `data-press-fx`
 * to decide which keyframe to run, so adding `pressable("ripple")` to
 * a button is enough to upgrade it from pulse to ripple. Sound + AT
 * gating + reduce-motion all stay handled centrally.
 */

export type PressVariant = "pulse" | "ripple";

/**
 * Returns the className string to apply to any actionable element so
 * it joins the unified press-feedback system.
 *
 * Why a class helper instead of a wrapper component: most call sites
 * are already custom <button> elements with their own structure. A
 * className utility composes cleanly with cn() and existing styles
 * instead of forcing a refactor to a new component shape.
 */
export function pressable(variant: PressVariant = "pulse"): string {
  // For the ripple variant we MUST guarantee position:relative and
  // overflow:hidden so the expanding circle clips to the element. For
  // pulse the class is purely additive — no layout impact.
  if (variant === "ripple") {
    return "press-ripple relative overflow-hidden";
  }
  return "press-pulse-host";
}

/**
 * Convenience attributes applied alongside `pressable()` so the global
 * click listener can pick the right keyframe. Spread onto the element:
 *
 *   <button {...pressableProps("ripple")} className={cn(pressable("ripple"), ...)}>
 *
 * Kept separate from pressable() (which only returns a string) so it
 * doesn't pollute className with non-class data attributes.
 */
export function pressableProps(
  variant: PressVariant = "pulse",
): { "data-press-fx": PressVariant } {
  return { "data-press-fx": variant };
}

/**
 * Hook for the ripple variant — returns an onPointerDown handler that
 * stores the click coordinates as CSS variables on the element so the
 * ripple expands from the actual press point, not the center.
 *
 * Returns a stable handler that you can compose with your own
 * onPointerDown via the helper's `compose` argument.
 */
export function usePressableRipple<T extends HTMLElement = HTMLElement>(
  userHandler?: React.PointerEventHandler<T>,
): React.PointerEventHandler<T> {
  return React.useCallback(
    (ev: React.PointerEvent<T>) => {
      const el = ev.currentTarget;
      const rect = el.getBoundingClientRect();
      // Coordinates relative to the element, in px — fed directly to
      // the CSS variables consumed by the .press-ripple::after rule.
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      el.style.setProperty("--press-x", `${x}px`);
      el.style.setProperty("--press-y", `${y}px`);
      userHandler?.(ev);
    },
    [userHandler],
  );
}

type PressableProps<TElement extends keyof React.JSX.IntrinsicElements> = {
  /** Visual variant. Defaults to "pulse". */
  variant?: PressVariant;
  /** Element to render. Defaults to "button". */
  as?: TElement;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.JSX.IntrinsicElements[TElement], "ref" | "className" | "children">;

/**
 * Thin wrapper that auto-wires `pressable()` + `pressableProps()` and,
 * for the ripple variant, the onPointerDown coordinate handler. Render
 * any element via the `as` prop:
 *
 *   <Pressable variant="ripple" onClick={save}>Save</Pressable>
 *   <Pressable as="a" href="/perfil">Perfil</Pressable>
 *
 * For more advanced cases (e.g. you need a ref), use the `pressable()`
 * + `usePressableRipple()` primitives directly on your own element.
 */
export function Pressable<TElement extends keyof React.JSX.IntrinsicElements = "button">({
  variant = "pulse",
  as,
  className,
  children,
  ...rest
}: PressableProps<TElement>) {
  const Tag = (as ?? "button") as React.ElementType;
  // The hook is always called (Rules of Hooks) — it's a no-op pointer
  // handler under "pulse" since the variables it sets aren't read.
  const onPointerDown = usePressableRipple(
    (rest as { onPointerDown?: React.PointerEventHandler<HTMLElement> }).onPointerDown,
  );
  const variantProps = variant === "ripple" ? { onPointerDown } : {};
  return (
    <Tag
      {...rest}
      {...pressableProps(variant)}
      {...variantProps}
      className={cn(pressable(variant), className)}
    >
      {children}
    </Tag>
  );
}
