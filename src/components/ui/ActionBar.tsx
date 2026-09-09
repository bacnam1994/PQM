import React from 'react';

export interface ActionBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * ActionBar - Tailwind UI Sticky Action Toolbar
 * Thanh tác vụ cố định đáy trang hỗ trợ Dark mode với bg-surface/95 và border-border.
 */
export const ActionBar: React.FC<ActionBarProps> = ({
  left,
  right,
  leftContent,
  rightContent,
  children,
  className = ''
}) => {
  const effectiveLeft = leftContent || left;
  const effectiveRight = rightContent || right;

  return (
    <div
      className={`sticky bottom-0 z-30 -mx-4 -mb-6 sm:-mx-6 sm:-mb-8 px-4 sm:px-6 py-3.5 bg-surface/95 backdrop-blur-md border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3 transition-colors ${className}`}
    >
      {children ? (
        children
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {effectiveLeft}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {effectiveRight}
          </div>
        </>
      )}
    </div>
  );
};

