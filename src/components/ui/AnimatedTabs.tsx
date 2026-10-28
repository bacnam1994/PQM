import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface AnimatedTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number | string;
  countClassName?: string;
}

export interface AnimatedTabsProps<T extends string = string> {
  tabs: AnimatedTabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * AnimatedTabs - Motion-highlighted tabs primitive
 * Inspired by Animate UI and modern UI primitives (Linear/Vercel style).
 * Features smooth spring-based gliding indicator between active tabs.
 */
export function AnimatedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId = 'animated-tab-highlight',
  className = '',
  size = 'md',
}: AnimatedTabsProps<T>) {
  const shouldReduceMotion = useReducedMotion();

  const isSmall = size === 'sm';

  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 p-1 bg-surface-2/90 dark:bg-surface-2/70 border border-border/80 rounded-xl backdrop-blur-xs select-none ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 rounded-lg font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
              isSmall ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
            } ${
              isActive
                ? 'text-white dark:text-emerald-950 font-extrabold'
                : 'text-ink-muted hover:text-ink hover:bg-surface-3/50'
            }`}
          >
            {/* Sliding Pill Indicator */}
            {isActive &&
              (shouldReduceMotion ? (
                <div className="absolute inset-0 z-0 bg-emerald-600 dark:bg-emerald-400 rounded-lg shadow-sm" />
              ) : (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 z-0 bg-emerald-600 dark:bg-emerald-400 rounded-lg shadow-sm"
                  transition={{
                    type: 'spring',
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              ))}

            {/* Content: Icon, Label, and Optional Badge */}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon className={isSmall ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums transition-colors ${
                    isActive
                      ? 'bg-black/20 text-white dark:bg-emerald-950/20 dark:text-emerald-950 font-bold'
                      : tab.countClassName || 'bg-surface-3 text-ink-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
