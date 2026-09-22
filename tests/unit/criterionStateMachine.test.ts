/**
 * criterionStateMachine.test.ts
 * Bộ kiểm thử đơn vị cho CriterionResultStateMachine và AlternateRuleStateMachine
 * Thẩm định tuân thủ State Machine Contract (docs/contracts/STATE_MACHINES.md)
 */

import { describe, it, expect } from 'vitest';
import {
  CriterionResultStateMachine,
  AlternateRuleStateMachine,
} from '../../src/domain/workflow/criterionStateMachine';

describe('CriterionResultStateMachine Suite', () => {
  it('cho phép chuyển từ NOT_STARTED sang REQUIRED và TESTING', () => {
    expect(CriterionResultStateMachine.canTransition('NOT_STARTED', 'REQUIRED').allowed).toBe(true);
    expect(CriterionResultStateMachine.canTransition('NOT_STARTED', 'TESTING').allowed).toBe(true);
    expect(CriterionResultStateMachine.canTransition('NOT_STARTED', 'EXEMPTED').allowed).toBe(true);
  });

  it('cho phép chuyển từ TESTING sang PASS, FAIL, PENDING', () => {
    expect(CriterionResultStateMachine.canTransition('TESTING', 'PASS').allowed).toBe(true);
    expect(CriterionResultStateMachine.canTransition('TESTING', 'FAIL').allowed).toBe(true);
    expect(CriterionResultStateMachine.canTransition('TESTING', 'PENDING').allowed).toBe(true);
  });

  it('chặn bước chuyển trạng thái nhảy cóc bất hợp lệ', () => {
    // Không thể nhảy trực tiếp từ NOT_STARTED sang PASS mà không qua TESTING
    const check = CriterionResultStateMachine.canTransition('NOT_STARTED', 'PASS');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBeDefined();
  });

  it('ném lỗi khi gọi transition() với bước chuyển không hợp lệ', () => {
    expect(() => {
      CriterionResultStateMachine.transition('NOT_STARTED', 'FAIL');
    }).toThrowError(/Bước chuyển trạng thái không hợp lệ/);
  });
});

describe('AlternateRuleStateMachine Suite', () => {
  it('phân giải chính xác trạng thái EXEMPTED khi Main PASS và không bị triggered', () => {
    const nextState = AlternateRuleStateMachine.resolveNextState({
      isTriggered: false,
      mainIsPass: true,
      altHasValue: false,
      altIsPass: null,
    });
    expect(nextState).toBe('EXEMPTED');
  });

  it('phân giải chính xác TRIGGERED_PENDING khi Main FAIL nhưng Alt chưa nhập', () => {
    const nextState = AlternateRuleStateMachine.resolveNextState({
      isTriggered: true,
      mainIsPass: false,
      altHasValue: false,
      altIsPass: null,
    });
    expect(nextState).toBe('TRIGGERED_PENDING');
  });

  it('phân giải chính xác TRIGGERED_PASS khi Alt nhập đạt', () => {
    const nextState = AlternateRuleStateMachine.resolveNextState({
      isTriggered: true,
      mainIsPass: false,
      altHasValue: true,
      altIsPass: true,
    });
    expect(nextState).toBe('TRIGGERED_PASS');
  });

  it('phân giải chính xác TRIGGERED_FAIL khi Alt nhập không đạt', () => {
    const nextState = AlternateRuleStateMachine.resolveNextState({
      isTriggered: true,
      mainIsPass: false,
      altHasValue: true,
      altIsPass: false,
    });
    expect(nextState).toBe('TRIGGERED_FAIL');
  });

  it('kiểm tra hợp lệ chuyển trạng thái AlternateRule', () => {
    expect(AlternateRuleStateMachine.canTransition('NOT_TRIGGERED', 'EXEMPTED').allowed).toBe(true);
    expect(
      AlternateRuleStateMachine.canTransition('NOT_TRIGGERED', 'TRIGGERED_PENDING').allowed
    ).toBe(true);
    expect(
      AlternateRuleStateMachine.canTransition('TRIGGERED_PENDING', 'TRIGGERED_PASS').allowed
    ).toBe(true);
    expect(
      AlternateRuleStateMachine.canTransition('TRIGGERED_PENDING', 'TRIGGERED_FAIL').allowed
    ).toBe(true);
  });
});
