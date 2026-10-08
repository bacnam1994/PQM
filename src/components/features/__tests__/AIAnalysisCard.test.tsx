/**
 * src/components/features/__tests__/AIAnalysisCard.test.tsx
 * Unit tests for AIAnalysisCard component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AIAnalysisCard } from '../AIAnalysisCard';
import type { AISummaryResult, AIAuditMetadata } from '../../../services/ai/aiBackendClient';

describe('AIAnalysisCard', () => {
  const mockData: AISummaryResult = {
    summary: 'Hồ sơ lô BATCH-001 đạt yêu cầu kiểm nghiệm sơ bộ.',
    riskLevel: 'LOW',
    findings: [
      {
        title: 'Chỉ tiêu hàm lượng đạt',
        description: 'Hàm lượng hoạt chất đạt 99.8% trong khoảng 90-110%',
        evidence: [
          {
            sourceType: 'TEST_RESULT',
            sourceId: 'TR-101',
            quoteOrMetric: '99.8%',
          },
        ],
      },
    ],
    recommendations: ['Tiến hành kiểm tra nhãn thành phẩm'],
    limitations: ['Kết quả chỉ mang tính hỗ trợ ra quyết định cho QA/QC.'],
  };

  const mockMetadata: AIAuditMetadata = {
    aiAnalysisId: 'AI-ANL-123',
    uid: 'user-qa-1',
    userEmail: 'qa@vbiotech.com',
    timestamp: '2026-10-08T00:00:00Z',
    model: 'gemini-2.5-flash',
    promptVersion: 'BATCH_ANALYSIS_V1',
    analysisType: 'batch_analysis',
    contextHash: 'hash-abc',
    inputRecordIds: ['BATCH-001', 'TR-101'],
    correlationId: 'REQ-XYZ',
  };

  it('renders summary, risk level and metadata', () => {
    render(<AIAnalysisCard data={mockData} metadata={mockMetadata} />);

    expect(screen.getByText('Hồ sơ lô BATCH-001 đạt yêu cầu kiểm nghiệm sơ bộ.')).toBeDefined();
    expect(screen.getByText('RỦI RO THẤP (LOW RISK)')).toBeDefined();
    expect(screen.getByText('AI-ANL-123')).toBeDefined();
  });

  it('renders findings and evidence chips', () => {
    render(<AIAnalysisCard data={mockData} metadata={mockMetadata} />);

    expect(screen.getByText('Chỉ tiêu hàm lượng đạt')).toBeDefined();
    expect(screen.getByText('TR-101')).toBeDefined();
    expect(screen.getByText('(99.8%)')).toBeDefined();
  });

  it('renders recommendations and limitations banner', () => {
    render(<AIAnalysisCard data={mockData} metadata={mockMetadata} />);

    expect(screen.getByText('Tiến hành kiểm tra nhãn thành phẩm')).toBeDefined();
    expect(
      screen.getByText('• Kết quả chỉ mang tính hỗ trợ ra quyết định cho QA/QC.')
    ).toBeDefined();
  });
});
