import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  MOTION_TIMINGS,
  MOTION_SPRINGS,
  fadeInVariants,
  slideUpVariants,
  dialogVariants,
  collapsibleVariants,
  dropdownVariants,
  createStaggerContainer,
} from './index';
import { AnimatedCollapsible } from '../../components/ui/AnimatedCollapsible';
import { AnimatedChevron } from '../../components/ui/AnimatedChevron';

describe('PQM Motion System Core Tokens & Presets', () => {
  it('định nghĩa đầy đủ các mốc thời gian chuyển động (MOTION_TIMINGS)', () => {
    expect(MOTION_TIMINGS.hover).toBeLessThanOrEqual(0.16);
    expect(MOTION_TIMINGS.dropdown).toBeLessThanOrEqual(0.18);
    expect(MOTION_TIMINGS.dialog).toBeLessThanOrEqual(0.24);
    expect(MOTION_TIMINGS.tab).toBeLessThanOrEqual(0.22);
    expect(MOTION_TIMINGS.stagger).toBeLessThanOrEqual(0.045);
  });

  it('định nghĩa đầy đủ các cấu hình Spring physics (MOTION_SPRINGS)', () => {
    expect(MOTION_SPRINGS.snappy.type).toBe('spring');
    expect(MOTION_SPRINGS.snappy.stiffness).toBeGreaterThan(400);

    expect(MOTION_SPRINGS.smooth.type).toBe('spring');
    expect(MOTION_SPRINGS.smooth.damping).toBeGreaterThanOrEqual(25);

    expect(MOTION_SPRINGS.gentle.type).toBe('spring');
    expect(MOTION_SPRINGS.bouncy.type).toBe('spring');
  });

  it('chứa các biến thể variants chuẩn không gây reflow thuộc tính nặng', () => {
    expect(fadeInVariants.hidden).toHaveProperty('opacity', 0);
    expect(fadeInVariants.visible).toHaveProperty('opacity', 1);

    expect(slideUpVariants.hidden).toHaveProperty('y');
    expect(slideUpVariants.visible).toHaveProperty('y', 0);

    expect(dialogVariants.hidden).toHaveProperty('scale');
    expect(dropdownVariants.hidden).toHaveProperty('scale');

    expect(collapsibleVariants.collapsed).toHaveProperty('height', 0);
    expect(collapsibleVariants.expanded).toHaveProperty('height', 'auto');
  });

  it('tạo stagger container với độ trễ tùy biến chính xác', () => {
    const container = createStaggerContainer(0.04);
    expect(container.visible).toBeDefined();
    expect((container.visible as any).transition?.staggerChildren).toBe(0.04);
  });

  it('AnimatedCollapsible khởi tạo thành công với isOpen và children', () => {
    const el = React.createElement(AnimatedCollapsible, {
      isOpen: true,
      children: React.createElement('div', null, 'Nội dung chi tiết'),
    });
    expect(el).toBeDefined();
    expect((el.props as any).isOpen).toBe(true);
  });

  it('AnimatedChevron khởi tạo thành công với isExpanded', () => {
    const chevronOpen = React.createElement(AnimatedChevron, { isExpanded: true });
    expect(chevronOpen).toBeDefined();
    expect(chevronOpen.props.isExpanded).toBe(true);

    const chevronClosed = React.createElement(AnimatedChevron, { isExpanded: false });
    expect(chevronClosed.props.isExpanded).toBe(false);
  });
});
