import React, { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useReducedMotion } from 'motion/react';

export interface AnimatedNumberProps {
  value: number | null | undefined;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  fallback?: string;
  stiffness?: number;
  damping?: number;
}

/**
 * AnimatedNumber - High-performance spring-animated number counter
 * Updates DOM node directly via ref without React re-render overhead on every frame.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  fallback = 'N/A',
  stiffness = 75,
  damping = 15,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const motionValue = useMotionValue(typeof value === 'number' && !isNaN(value) ? value : 0);
  const springValue = useSpring(motionValue, {
    stiffness,
    damping,
  });

  const formatNumber = (num: number) => {
    if (isNaN(num)) return fallback;
    const formatted = num.toLocaleString('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${prefix}${formatted}${suffix}`;
  };

  useEffect(() => {
    if (typeof value === 'number' && !isNaN(value)) {
      if (shouldReduceMotion) {
        if (spanRef.current) {
          spanRef.current.textContent = formatNumber(value);
        }
      } else {
        motionValue.set(value);
      }
    } else {
      if (spanRef.current) {
        spanRef.current.textContent = fallback;
      }
    }
  }, [value, shouldReduceMotion, decimals, prefix, suffix, fallback]);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const unsubscribe = springValue.on('change', (latest) => {
      if (spanRef.current) {
        spanRef.current.textContent = formatNumber(latest);
      }
    });

    return () => unsubscribe();
  }, [springValue, shouldReduceMotion, decimals, prefix, suffix, fallback]);

  if (value === null || value === undefined || isNaN(value)) {
    return <span className={className}>{fallback}</span>;
  }

  return (
    <span ref={spanRef} className={className}>
      {formatNumber(value)}
    </span>
  );
};
