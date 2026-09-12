import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TestResultFormPage from './TestResultFormPage';
import { writeAIDraft, peekAIDraft, clearAIDraft } from '../../services/ai/aiDraftManager';
import { useAppStore } from '../../store/useAppStore';

// Mock Firebase Realtime Database
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  get: vi.fn(() => Promise.resolve({ exists: () => false, val: () => null })),
  query: vi.fn(() => ({})),
  orderByChild: vi.fn(() => ({})),
  equalTo: vi.fn(() => ({})),
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

describe('TestResultFormPage AI Draft & Hardening Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();

    useAppStore.setState({
      products: [
        { id: 'prod_1', code: 'SP-001', name: 'Ginkgo Biloba 120mg', group: 'TPBVSK', status: 'ACTIVE' } as any,
      ],
      batches: [
        {
          id: 'batch_1',
          batchNo: 'L260101',
          productId: 'prod_1',
          tccsId: 'tccs_1',
          status: 'TESTING',
          mfgDate: '2026-01-01',
          expDate: '2029-01-01',
        } as any,
      ],
      tccsList: [
        {
          id: 'tccs_1',
          productId: 'prod_1',
          code: 'TCCS-01',
          isActive: true,
          issueDate: '2026-01-01',
          mainQualityCriteria: [
            { name: 'Độ ẩm', unit: '%', min: 0, max: 9.0, type: 'NUMBER' as any },
            { name: 'pH', unit: '', min: 6.0, max: 7.5, type: 'NUMBER' as any },
          ],
          safetyCriteria: [],
        } as any,
      ],
      testResults: [],
      allTestResults: [],
      aiLearnedMappings: [],
      user: { uid: 'u1', email: 'lab@example.com', role: 'LAB' } as any,
      role: 'LAB',
      isAdmin: false,
    });
  });

  afterEach(() => {
    clearAIDraft();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders form in ADD mode without AI draft normally without errors', async () => {
    render(
      <MemoryRouter initialEntries={['/test-results/new']}>
        <Routes>
          <Route path="/test-results/new" element={<TestResultFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Header and sections render properly
    expect(await screen.findByText('1. Thông tin Lô & Phòng Kiểm nghiệm')).toBeDefined();
    expect(screen.getByText('2. Đánh giá Chỉ tiêu Chất lượng')).toBeDefined();
  });

  it('consumes AI draft exactly once and populates form fields without needing location.state', async () => {
    const aiData = {
      labName: 'QUATEST 3',
      testDate: '12/09/2026',
      batchNo: 'L260101',
      testResults: [
        { criteriaName: 'Độ ẩm', value: '5.2' },
        { criteriaName: 'pH', value: '6.8' },
        { criteriaName: 'Chỉ tiêu lạ chưa có', value: '100', unit: 'mg' },
      ],
    };

    writeAIDraft(aiData);
    expect(peekAIDraft()).not.toBeNull();

    render(
      <MemoryRouter initialEntries={['/test-results/new']}>
        <Routes>
          <Route path="/test-results/new" element={<TestResultFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Draft must be consumed from sessionStorage
      expect(peekAIDraft()).toBeNull();
    });

    // Form inputs should contain AI values
    await waitFor(() => {
      const labInput = document.querySelector('input[name="labName"]') as HTMLInputElement;
      expect(labInput).not.toBeNull();
      expect(labInput.value).toBe('QUATEST 3');
      // Known TCCS criteria should be filled in the testResultsMap inputs
      expect(screen.getByDisplayValue('5.2')).toBeDefined();
      expect(screen.getByDisplayValue('6.8')).toBeDefined();
    });

    // Extra criteria section should have ONLY the unmatched criterion
    expect(screen.getByDisplayValue('Chỉ tiêu lạ chưa có')).toBeDefined();
    expect(screen.queryByDisplayValue('Độ ẩm')).toBeNull(); // name input in extra criteria should not exist for known criteria
  });

  it('refresh/remount after consumption does not reapply or duplicate AI data', async () => {
    const aiData = {
      labName: 'LAB VIETNAM',
      batchNo: 'L260101',
      testResults: [{ criteriaName: 'Độ ẩm', value: '4.8' }],
    };

    writeAIDraft(aiData);

    const { unmount } = render(
      <MemoryRouter initialEntries={['/test-results/new']}>
        <Routes>
          <Route path="/test-results/new" element={<TestResultFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(peekAIDraft()).toBeNull();
    });

    unmount();

    // Remount to simulate navigation/refresh after draft is consumed
    render(
      <MemoryRouter initialEntries={['/test-results/new']}>
        <Routes>
          <Route path="/test-results/new" element={<TestResultFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Form should render clean ADD mode without crashing
    expect(await screen.findByText('1. Thông tin Lô & Phòng Kiểm nghiệm')).toBeDefined();
  });

  it('handles malformed AI storage payload safely without crashing the page', async () => {
    sessionStorage.setItem('pqm:ai-draft:test-result', JSON.stringify({ corrupted: true }));

    render(
      <MemoryRouter initialEntries={['/test-results/new']}>
        <Routes>
          <Route path="/test-results/new" element={<TestResultFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('1. Thông tin Lô & Phòng Kiểm nghiệm')).toBeDefined();
    // Malformed storage should be purged
    expect(sessionStorage.getItem('pqm:ai-draft:test-result')).toBeNull();
  });

  it('does NOT consume AI draft when opening EDIT route (/test-results/:id/edit)', async () => {
    useAppStore.setState({
      testResults: [
        {
          id: 'res_existing_1',
          batchId: 'batch_1',
          labName: 'Lab Cũ',
          testDate: '2026-02-01',
          overallStatus: 'PASS',
          results: [{ criteriaName: 'Độ ẩm', value: 4.5, isPass: true }],
        } as any,
      ],
    });

    writeAIDraft({ labName: 'LAB AI TRANSIENT', batchNo: 'L260101' });
    expect(peekAIDraft()).not.toBeNull();

    render(
      <MemoryRouter initialEntries={['/test-results/res_existing_1/edit']}>
        <Routes>
          <Route path="/test-results/:id/edit" element={<TestResultFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('1. Thông tin Lô & Phòng Kiểm nghiệm');

    // In EDIT mode, AI draft MUST NOT be consumed
    expect(peekAIDraft()).not.toBeNull();
    expect(peekAIDraft()?.data.labName).toBe('LAB AI TRANSIENT');
  });

  it('gives AI draft priority over existing localStorage draft', async () => {
    // Old manual draft left in localStorage
    localStorage.setItem(
      'TEST_RESULT_DRAFT',
      JSON.stringify({
        batchId: '',
        labName: 'OLD MANUAL DRAFT LAB',
        testDate: '2026-01-01',
        testResultsMap: {},
        extraCriteria: [],
        attachments: [],
      })
    );

    // Newly arrived AI draft
    writeAIDraft({
      labName: 'NEW AI LAB',
      batchNo: 'L260101',
      testResults: [{ criteriaName: 'Độ ẩm', value: '4.2' }],
    });

    render(
      <MemoryRouter initialEntries={['/test-results/new']}>
        <Routes>
          <Route path="/test-results/new" element={<TestResultFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    // AI data should win
    await waitFor(() => {
      const labInput = document.querySelector('input[name="labName"]') as HTMLInputElement;
      expect(labInput).not.toBeNull();
      expect(labInput.value).toBe('NEW AI LAB');
    });
  });
});
