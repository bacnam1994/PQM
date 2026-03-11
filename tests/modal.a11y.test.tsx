import React from 'react';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, it, expect } from 'vitest';
import { Modal } from '../components/CommonUI';

describe('Modal accessibility', () => {
  it('has no detectable a11y violations', async () => {
    const { container } = render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal" icon={() => null}>
        <button>Close</button>
      </Modal>
    );

    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });
});
