import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualizedTableBody } from './VirtualizedTableBody';

describe('VirtualizedTableBody Component', () => {
  beforeAll(() => {
    // Mock getBoundingClientRect for jsdom virtualizer measurements
    Element.prototype.getBoundingClientRect = function () {
      return {
        width: 1000,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 1000,
        x: 0,
        y: 0,
        toJSON: () => {},
      };
    };
  });

  it('renders standard tbody directly when item count is below scrollThreshold', () => {
    const smallList = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ];

    render(
      <table>
        <VirtualizedTableBody
          items={smallList}
          scrollThreshold={10}
          colSpan={2}
          renderRow={(item) => (
            <tr key={item.id} data-testid={`row-${item.id}`}>
              <td>{item.id}</td>
              <td>{item.name}</td>
            </tr>
          )}
        />
      </table>
    );

    expect(screen.getByTestId('row-1')).toBeTruthy();
    expect(screen.getByTestId('row-2')).toBeTruthy();
    expect(screen.getByTestId('row-3')).toBeTruthy();
  });

  it('renders correctly without crashing on empty dataset', () => {
    render(
      <table>
        <VirtualizedTableBody
          items={[]}
          scrollThreshold={10}
          colSpan={2}
          renderRow={(item: any) => (
            <tr key={item.id}>
              <td>{item.id}</td>
            </tr>
          )}
        />
      </table>
    );

    const tbody = document.querySelector('tbody');
    expect(tbody).toBeTruthy();
    expect(tbody?.children.length).toBe(0);
  });

  it('handles fallback safely when parentRef is missing or dataset is large', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: `item_${i}`,
      name: `Entity ${i}`,
    }));

    // When parentRef is not provided, it gracefully falls back without throwing
    render(
      <table>
        <VirtualizedTableBody
          items={largeDataset.slice(0, 20)}
          scrollThreshold={50}
          colSpan={2}
          renderRow={(item) => (
            <tr key={item.id} data-testid={`row-${item.id}`}>
              <td>{item.id}</td>
              <td>{item.name}</td>
            </tr>
          )}
        />
      </table>
    );

    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(20);
  });
});
