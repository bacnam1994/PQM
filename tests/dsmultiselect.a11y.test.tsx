import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import { describe, it, expect } from 'vitest';
import { DSMultiSelect } from '../components/design';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('DSMultiSelect accessibility', () => {
  it('has no detectable a11y violations when opened', async () => {
    const { container, getByRole } = render(
      <DSMultiSelect options={options} value={[]} onChange={() => {}} placeholder="Chọn..." />
    );

    const trigger = getByRole('button');
    fireEvent.click(trigger);

    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });
});
