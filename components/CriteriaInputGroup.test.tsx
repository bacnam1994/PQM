import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CriteriaInputGroup from './CriteriaInputGroup';
import { CriterionType, TCCS } from '../types';
import * as criteriaEvaluation from '../utils/criteriaEvaluation';

// Mock evaluateCriterionSmart để kiểm soát logic pass/fail trong test
vi.mock('../utils/criteriaEvaluation', async (importOriginal) => {
  const actual = await importOriginal<typeof criteriaEvaluation>();
  return {
    ...actual,
    evaluateCriterionSmart: vi.fn(),
    autoFormatInput: (val: string) => val,
  };
});

describe('CriteriaInputGroup', () => {
  const mockSetTestResultsMap = vi.fn();
  
  const basicCriteria = [
    { name: 'C1', type: CriterionType.NUMBER, min: 10, max: 20, unit: 'mg' },
    { name: 'C2', type: CriterionType.TEXT, expectedText: 'Red' }
  ];

  const defaultProps = {
    title: 'Test Group',
    icon: <span data-testid="group-icon">Icon</span>,
    colorClass: 'text-red-500',
    activeTCCS: null,
    testResultsMap: {},
    setTestResultsMap: mockSetTestResultsMap,
    existingResultsForBatch: [],
    criteria: basicCriteria
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    (criteriaEvaluation.evaluateCriterionSmart as any).mockImplementation((c: any, v: any) => {
        if (v === 'PASS' || v === '15') return true;
        if (v === 'FAIL' || v === '25') return false;
        return true;
    });
  });

  it('renders correctly with title and inputs', () => {
    render(<CriteriaInputGroup {...defaultProps} />);
    
    expect(screen.getByText('Test Group')).toBeTruthy();
    expect(screen.getByTestId('group-icon')).toBeTruthy();
    expect(screen.getByText('C1')).toBeTruthy();
    expect(screen.getByText('C2')).toBeTruthy();
    expect(screen.getAllByPlaceholderText('Nhập kết quả...')).toHaveLength(2);
  });

  it('calls setTestResultsMap when input changes', () => {
    render(<CriteriaInputGroup {...defaultProps} />);
    
    const inputs = screen.getAllByPlaceholderText('Nhập kết quả...');
    fireEvent.change(inputs[0], { target: { value: '15' } });
    
    // Kiểm tra xem hàm setTestResultsMap có được gọi không
    // Lưu ý: Do setTestResultsMap thường nhận callback, ta chỉ check nó được gọi
    expect(mockSetTestResultsMap).toHaveBeenCalled();
  });

  it('displays evaluation status (PASS/FAIL)', () => {
    const props = {
        ...defaultProps,
        testResultsMap: { 'C1': '15', 'C2': 'FAIL' }
    };
    
    // Mock specific returns for this test
    (criteriaEvaluation.evaluateCriterionSmart as any).mockImplementation((c: any, v: any) => {
        if (c.name === 'C1') return true;
        if (c.name === 'C2') return false;
        return false;
    });

    render(<CriteriaInputGroup {...props} />);
    
    expect(screen.getByText('ĐẠT')).toBeTruthy();
    expect(screen.getByText('KHÔNG ĐẠT')).toBeTruthy();
  });

  it('displays history from existing results', () => {
    const props = {
        ...defaultProps,
        existingResultsForBatch: [
            {
                id: 'res1',
                batchId: 'b1',
                labName: 'Lab A',
                testDate: '2023-01-01',
                overallStatus: 'PASS',
                results: [{ criteriaName: 'C1', value: '12', isPass: true }]
            }
        ] as any
    };

    render(<CriteriaInputGroup {...props} />);
    
    expect(screen.getByText('Lab A:')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  describe('Alternate Rules Logic', () => {
      const tccsWithRules: TCCS = {
          id: 'tccs1',
          mainQualityCriteria: [{ name: 'Main', type: CriterionType.NUMBER, max: 10, unit: 'mg' }],
          safetyCriteria: [{ name: 'Alt', type: CriterionType.NUMBER, max: 5, unit: 'mg' }],
          alternateRules: [],
          // other required props...
          productId: 'p1', code: 'TCCS1', issueDate: '2023', isActive: true, createdAt: ''
      };

      const criteriaWithAlt = [
          { name: 'Main', type: CriterionType.NUMBER, max: 10, unit: 'mg' },
          { name: 'Alt', type: CriterionType.NUMBER, max: 5, unit: 'mg' }
      ];

      it('FAIL_RETRY: Hides alternate if Main passes', () => {
          const tccs = {
              ...tccsWithRules,
              alternateRules: [{ main: 'Main', alt: 'Alt', type: 'FAIL_RETRY' }]
          } as TCCS;

          const props = {
              ...defaultProps,
              criteria: criteriaWithAlt,
              activeTCCS: tccs,
              testResultsMap: { 'Main': '5' } // 5 <= 10 -> PASS
          };

          (criteriaEvaluation.evaluateCriterionSmart as any).mockReturnValue(true); // Main passes

          render(<CriteriaInputGroup {...props} />);
          
          expect(screen.getByText('Main')).toBeTruthy();
          expect(screen.queryByText('Alt')).toBeNull();
      });

      it('FAIL_RETRY: Shows alternate if Main fails', () => {
          const tccs = {
              ...tccsWithRules,
              alternateRules: [{ main: 'Main', alt: 'Alt', type: 'FAIL_RETRY' }]
          } as TCCS;

          const props = {
              ...defaultProps,
              criteria: criteriaWithAlt,
              activeTCCS: tccs,
              testResultsMap: { 'Main': '15' } // 15 > 10 -> FAIL
          };

          (criteriaEvaluation.evaluateCriterionSmart as any).mockReturnValue(false); // Main fails

          render(<CriteriaInputGroup {...props} />);
          
          expect(screen.getByText('Main')).toBeTruthy();
          expect(screen.getByText('Alt')).toBeTruthy();
      });

      it('CONDITIONAL_CHECK: Shows alternate if Main passes AND value > threshold', () => {
        const tccs = {
            ...tccsWithRules,
            alternateRules: [{ main: 'Main', alt: 'Alt', type: 'CONDITIONAL_CHECK', conditionValue: '8' }]
        } as TCCS;

        const props = {
            ...defaultProps,
            criteria: criteriaWithAlt,
            activeTCCS: tccs,
            testResultsMap: { 'Main': '9' } // 9 <= 10 (PASS) AND 9 > 8 (Threshold) -> Show Alt
        };

        (criteriaEvaluation.evaluateCriterionSmart as any).mockReturnValue(true); // Main passes

        render(<CriteriaInputGroup {...props} />);
        
        expect(screen.getByText('Main')).toBeTruthy();
        expect(screen.getByText('Alt')).toBeTruthy();
      });

      it('CONDITIONAL_CHECK: Hides alternate if Main passes AND value <= threshold', () => {
        const tccs = {
            ...tccsWithRules,
            alternateRules: [{ main: 'Main', alt: 'Alt', type: 'CONDITIONAL_CHECK', conditionValue: '8' }]
        } as TCCS;

        const props = {
            ...defaultProps,
            criteria: criteriaWithAlt,
            activeTCCS: tccs,
            testResultsMap: { 'Main': '7' } // 7 <= 10 (PASS) AND 7 <= 8 (Threshold) -> Hide Alt
        };

        (criteriaEvaluation.evaluateCriterionSmart as any).mockReturnValue(true); // Main passes

        render(<CriteriaInputGroup {...props} />);
        
        expect(screen.getByText('Main')).toBeTruthy();
        expect(screen.queryByText('Alt')).toBeNull();
      });
  });
});