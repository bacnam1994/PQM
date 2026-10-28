import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { collapsibleVariants } from '../../lib/motion';

export interface AnimatedCollapsibleProps {
  isOpen: boolean;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * AnimatedCollapsible - Accordion & Expandable Content Primitive
 * Smoothly transitions height between 0 and auto with spring physics.
 * Avoids abrupt layout jumps when expanding cards, table details, or TCCS structure.
 */
export const AnimatedCollapsible: React.FC<AnimatedCollapsibleProps> = ({
  isOpen,
  children,
  className = '',
  id,
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    if (!isOpen) return null;
    return (
      <div id={id} className={className}>
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          id={id}
          key="collapsible-content"
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          variants={collapsibleVariants}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
