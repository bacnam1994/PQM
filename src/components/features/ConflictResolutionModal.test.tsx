import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { ConflictReport } from '../../services/conflictResolutionService';

describe('Phase 8: ConflictResolutionModal - Concurrent Edit Collision UI', () => {
  const mockReport: ConflictReport = {
    id: 'conf_123',
    path: 'batches/b1',
    entityType: 'BATCHES',
    entityId: 'b1',
    expectedVersion: 1,
    serverVersion: 2,
    strategy: 'SAFE_MERGE',
    diffs: [
      {
        fieldName: 'status',
        serverValue: 'TESTING',
        clientValue: 'RELEASED',
        isConflicting: true,
      },
      {
        fieldName: 'notes',
        serverValue: 'Ghi chú cũ',
        clientValue: 'Ghi chú mới',
        isConflicting: false,
      },
    ],
    conflictingFields: ['status'],
    nonConflictingFields: ['notes'],
    timestamp: Date.now(),
  };

  it('hiển thị cảnh báo xung đột và các trường phân biệt giữa Client và Server', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={() => {}}
        conflictReport={mockReport}
        onResolve={() => {}}
      />
    );

    expect(screen.getByText(/Phát hiện thay đổi đồng thời trên Server/i)).toBeDefined();
    expect(screen.getByText('status')).toBeDefined();
    expect(screen.getByText('TESTING')).toBeDefined();
    expect(screen.getByText('RELEASED')).toBeDefined();
    expect(screen.getByText('Xung đột')).toBeDefined();
  });

  it('kích hoạt onResolve khi người dùng chọn chiến lược SERVER_WINS hoặc CLIENT_WINS', () => {
    const handleResolve = vi.fn();

    render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={() => {}}
        conflictReport={mockReport}
        onResolve={handleResolve}
      />
    );

    const serverWinsBtn = screen.getByText(/Giữ dữ liệu Máy chủ/i);
    fireEvent.click(serverWinsBtn);
    expect(handleResolve).toHaveBeenCalledWith('SERVER_WINS');

    const clientWinsBtn = screen.getByText(/Ghi đè bằng Dữ liệu của tôi/i);
    fireEvent.click(clientWinsBtn);
    expect(handleResolve).toHaveBeenCalledWith('CLIENT_WINS');
  });
});
