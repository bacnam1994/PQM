import { Variants } from 'motion/react';
import { MOTION_SPRINGS, MOTION_TIMINGS } from './tokens';

/**
 * Standard Enter-Exit Fade
 */
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: MOTION_TIMINGS.dropdown, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_TIMINGS.dropdown * 0.75, ease: 'easeIn' },
  },
};

/**
 * Subtle Slide Up (for cards, headers, panels)
 */
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: MOTION_SPRINGS.gentle,
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: MOTION_TIMINGS.hover, ease: 'easeIn' },
  },
};

/**
 * Dialog / Modal Entrance
 */
export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: MOTION_SPRINGS.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: MOTION_TIMINGS.hover, ease: 'easeIn' },
  },
};

/**
 * Dropdown Menu / Popover
 */
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: MOTION_SPRINGS.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: { duration: MOTION_TIMINGS.hover * 0.8, ease: 'easeIn' },
  },
};

/**
 * Collapsible Content (Accordion / Expandable sections)
 */
export const collapsibleVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: MOTION_TIMINGS.dialog, ease: [0.33, 1, 0.68, 1] },
      opacity: { duration: MOTION_TIMINGS.dialog * 0.6, ease: 'easeIn' },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: MOTION_SPRINGS.smooth,
      opacity: { duration: MOTION_TIMINGS.dialog, ease: 'easeOut' },
    },
  },
};

/**
 * Sequential Stagger List Container
 */
export const createStaggerContainer = (
  staggerDelay: number = MOTION_TIMINGS.stagger
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: 0.02,
    },
  },
});

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: MOTION_SPRINGS.smooth,
  },
};

/**
 * Status Badge State Pop
 */
export const badgePopVariants: Variants = {
  initial: { scale: 0.94, opacity: 0.8 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: MOTION_SPRINGS.bouncy,
  },
};
