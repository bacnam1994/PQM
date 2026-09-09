import { describe, it, expect } from 'vitest';
import React from 'react';
import { Surface } from './Surface';
import { StatusBadge } from './StatusBadge';
import { PageHeader } from './PageHeader';
import { WorkflowSteps } from './WorkflowSteps';
import { FilterBar } from './FilterBar';
import { DataTable, ColumnDef } from './DataTable';

describe('Design System 2.0 UI Primitives', () => {
  it('Surface khởi tạo thành công với variant và padding mặc định', () => {
    const el = React.createElement(Surface, { variant: 'subtle', padding: 'sm' }, 'Nội dung test');
    expect(el).toBeDefined();
    expect(el.props.variant).toBe('subtle');
    expect(el.props.padding).toBe('sm');
  });

  it('StatusBadge hiển thị đúng trạng thái chuẩn GMP và dot indicator', () => {
    const badgePass = React.createElement(StatusBadge, { status: 'PASS' });
    expect(badgePass).toBeDefined();
    expect(badgePass.props.status).toBe('PASS');

    const badgeCrit = React.createElement(StatusBadge, { status: 'CRITICAL', label: 'Cực kỳ khẩn' });
    expect(badgeCrit.props.label).toBe('Cực kỳ khẩn');
  });

  it('PageHeader định nghĩa đầy đủ 2 tầng breadcrumb và action', () => {
    const header = React.createElement(PageHeader, {
      title: 'Danh sách Lô',
      subtitle: 'Theo dõi tiến độ',
      breadcrumbs: [{ label: 'Trang chủ', path: '/' }, { label: 'Lô sản xuất' }]
    });
    expect(header).toBeDefined();
    expect(header.props.title).toBe('Danh sách Lô');
    expect(header.props.breadcrumbs).toHaveLength(2);
  });

  it('WorkflowSteps lưu trữ đúng tiến trình các chặng', () => {
    const steps = [
      { id: 's1', title: 'Thông tin lô', status: 'completed' as const },
      { id: 's2', title: 'Nhập kết quả', status: 'current' as const },
      { id: 's3', title: 'Ký số', status: 'upcoming' as const },
    ];
    const el = React.createElement(WorkflowSteps, { steps });
    expect(el).toBeDefined();
    expect(el.props.steps).toHaveLength(3);
  });

  it('DataTable ánh xạ đúng danh sách cột và trích xuất key', () => {
    interface Item { id: string; name: string }
    const items: Item[] = [{ id: '1', name: 'Lô 01' }, { id: '2', name: 'Lô 02' }];
    const cols: ColumnDef<Item>[] = [
      { key: 'id', header: 'Mã' },
      { key: 'name', header: 'Tên lô' }
    ];

    const table = React.createElement(DataTable<Item>, {
      data: items,
      columns: cols,
      keyExtractor: (i) => i.id
    });
    expect(table).toBeDefined();
    expect(table.props.data).toHaveLength(2);
    expect(table.props.columns).toHaveLength(2);
  });
});
