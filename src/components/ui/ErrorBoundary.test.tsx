import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const ProblemChild: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test crash in component');
  }
  return <div>Normal Content</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal Content')).toBeDefined();
  });

  it('renders fallback error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Đã xảy ra sự cố')).toBeDefined();
    expect(screen.getByText('Thử khôi phục')).toBeDefined();
    expect(screen.getByText('Danh sách')).toBeDefined();
    expect(screen.getByText('Tải lại')).toBeDefined();
  });

  it('clears error state when "Thử khôi phục" is clicked', () => {
    let hasThrown = true;
    const ConditionalChild: React.FC = () => {
      if (hasThrown) {
        throw new Error('First time crash');
      }
      return <div>Recovered Content</div>;
    };

    render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Đã xảy ra sự cố')).toBeDefined();

    // Fix the error condition and click recover
    hasThrown = false;
    fireEvent.click(screen.getByText('Thử khôi phục'));

    expect(screen.getByText('Recovered Content')).toBeDefined();
  });
});
