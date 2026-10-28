/**
 * Motion System Design Tokens
 * Benchmarked timing & spring physics for high-performance enterprise UI.
 * Prioritizes opacity, transform (GPU-accelerated), and zero layout thrashing.
 */

export const MOTION_TIMINGS = {
  hover: 0.14, // 140ms: snappy press/hover feedback
  dropdown: 0.16, // 160ms: popovers and dropdown menus
  dialog: 0.22, // 220ms: modals and drawers
  tab: 0.18, // 180ms: tab transitions and panels
  stagger: 0.035, // 35ms: sequential list item reveal
} as const;

export const MOTION_SPRINGS = {
  // Snappy: Tabs highlight, micro-interactions, buttons
  snappy: {
    type: 'spring' as const,
    stiffness: 450,
    damping: 35,
    mass: 0.8,
  },
  // Smooth: Collapsible accordion, panels, drawers
  smooth: {
    type: 'spring' as const,
    stiffness: 350,
    damping: 30,
    mass: 1,
  },
  // Gentle: Modal dialog entrance, soft popovers
  gentle: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 25,
    mass: 0.9,
  },
  // Bouncy: Status badge pop, celebration indicators
  bouncy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 22,
    mass: 0.8,
  },
} as const;

export const MOTION_EASE = {
  outCubic: [0.33, 1, 0.68, 1],
  inOutCubic: [0.65, 0, 0.35, 1],
  anticipate: [0.36, 0, 0.66, -0.56],
} as const;
