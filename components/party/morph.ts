import type { Transition } from "framer-motion";

// Shared spring-ish tween for the layout morph (panels sliding/resizing between
// the lyrics layout and the hero layout).
export const MORPH: Transition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] };
