/**
 * AUTH DOMAIN UNIT TESTS (VS-16)
 * ===============================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthRules } from '../domain/rules';
import { AuthAppService } from '../application/authAppService';
import { IAuthRepository } from '../infrastructure/repository';

describe('Auth Domain: Canonical Unit Tests (VS-16)', () => {
  describe('1. AuthRules Validation', () => {
    it('validateEmail: chấp thuận email hợp lệ và ném lỗi khi không hợp lệ', () => {
      expect(() => AuthRules.validateEmail('admin@vbiotech.vn')).not.toThrow();
      expect(() => AuthRules.validateEmail('')).toThrow(/bắt buộc không được để trống/);
      expect(() => AuthRules.validateEmail('invalid-email')).toThrow(
        /Định dạng email không hợp lệ/
      );
      expect(() => AuthRules.validateEmail('test@')).toThrow(/Định dạng email không hợp lệ/);
    });

    it('validatePasswordStrength: bắt buộc mật khẩu >= 6 ký tự', () => {
      expect(() => AuthRules.validatePasswordStrength('123456')).not.toThrow();
      expect(() => AuthRules.validatePasswordStrength('Admin@123')).not.toThrow();
      expect(() => AuthRules.validatePasswordStrength('')).toThrow(
        /Mật khẩu bắt buộc không được để trống/
      );
      expect(() => AuthRules.validatePasswordStrength('12345')).toThrow(/tối thiểu 6 ký tự/);
    });

    it('validateLoginCredentials: kiểm tra cả email và mật khẩu', () => {
      expect(() => AuthRules.validateLoginCredentials('user@vbiotech.vn', 'pass123')).not.toThrow();
      expect(() => AuthRules.validateLoginCredentials('', 'pass123')).toThrow();
      expect(() => AuthRules.validateLoginCredentials('user@vbiotech.vn', '')).toThrow(
        /Mật khẩu đăng nhập không được để trống/
      );
    });

    it('validatePasswordChange: kiểm tra mật khẩu hiện tại và không cho phép trùng mật khẩu mới', () => {
      expect(() => AuthRules.validatePasswordChange('oldPass123', 'newPass456')).not.toThrow();
      expect(() => AuthRules.validatePasswordChange('', 'newPass456')).toThrow(
        /Vui lòng nhập mật khẩu hiện tại/
      );
      expect(() => AuthRules.validatePasswordChange('samePass123', 'samePass123')).toThrow(
        /Mật khẩu mới không được trùng với mật khẩu hiện tại/
      );
    });
  });

  describe('2. AuthAppService Integration', () => {
    let mockRepo: IAuthRepository;
    let service: AuthAppService;

    beforeEach(() => {
      mockRepo = {
        signIn: vi.fn().mockResolvedValue({ user: { uid: 'u1', email: 'test@vbiotech.vn' } }),
        signUp: vi.fn().mockResolvedValue({ uid: 'u2', email: 'new@vbiotech.vn' }),
        signOut: vi.fn().mockResolvedValue(undefined),
        changePassword: vi.fn().mockResolvedValue(undefined),
        resetPassword: vi.fn().mockResolvedValue(undefined),
        setPersistence: vi.fn().mockResolvedValue(undefined),
      };
      service = new AuthAppService(mockRepo);
    });

    it('login: gọi repository signIn khi thông tin hợp lệ', async () => {
      await expect(service.login('admin@vbiotech.vn', 'password123')).resolves.not.toThrow();
      expect(mockRepo.signIn).toHaveBeenCalledWith('admin@vbiotech.vn', 'password123');
    });

    it('login: ném lỗi trước khi gọi repository nếu email sai', async () => {
      await expect(service.login('invalid', 'password123')).rejects.toThrow();
      expect(mockRepo.signIn).not.toHaveBeenCalled();
    });

    it('signup: gọi repository signUp khi mật khẩu đủ mạnh', async () => {
      await expect(service.signup('new@vbiotech.vn', 'securePass123')).resolves.not.toThrow();
      expect(mockRepo.signUp).toHaveBeenCalledWith('new@vbiotech.vn', 'securePass123');
    });

    it('logout: gọi repository signOut', async () => {
      await expect(service.logout()).resolves.not.toThrow();
      expect(mockRepo.signOut).toHaveBeenCalled();
    });

    it('changePassword: đổi mật khẩu thành công', async () => {
      await expect(service.changePassword('oldPass123', 'newPass456')).resolves.not.toThrow();
      expect(mockRepo.changePassword).toHaveBeenCalledWith('oldPass123', 'newPass456');
    });

    it('resetPassword: gửi email đặt lại mật khẩu', async () => {
      await expect(service.resetPassword('admin@vbiotech.vn')).resolves.not.toThrow();
      expect(mockRepo.resetPassword).toHaveBeenCalledWith('admin@vbiotech.vn');
    });
  });
});
