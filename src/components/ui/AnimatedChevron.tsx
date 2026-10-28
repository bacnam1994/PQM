import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { MOTION_SPRINGS } from '../../lib/motion';

export interface AnimatedChevronProps {
  isExpanded?: boolean;
  isOpen?: boolean;
  className?: string;
}

/**
 * AnimatedChevron - Interactive Rotating Chevron Primitive
 * Smoothly rotates 180 degrees using spring physics when expanded.
 */
export const AnimatedChevron: React.FC<AnimatedChevronProps> = ({
  isExpanded,
  isOpen,
  className = 'w-4 h-4',
}) => {
  const expanded = isExpanded ?? isOpen ?? false;
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <ChevronDownIcon
        className={`${className} transition-transform ${expanded ? 'rotate-180' : ''}`}
      />
    );
  }

  return (
    <motion.div
      initial={false}
      animate={{ rotate: expanded ? 180 : 0 }}
      transition={MOTION_SPRINGS.snappy}
      className="inline-flex items-center justify-center shrink-0"
    >
      <ChevronDownIcon className={className} />
    </motion.div>
  );
};
