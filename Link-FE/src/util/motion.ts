/** Scroll behaviour for scripted scrolling, which the reduced-motion CSS rule can't override. */
export function scrollMotion(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
