/**
 * AUTH DOMAIN: RULES (VS-16)
 * ==========================
 * Rào chắn an ninh & quy tắc xác thực người dùng (GMP 21 CFR Part 11).
 */

export class AuthRules {
  /**
   * Kiểm tra tính hợp lệ của địa chỉ Email
   */
  static validateEmail(email?: string): void {
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('Địa chỉ email bắt buộc không được để trống.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Định dạng email không hợp lệ.');
    }
  }

  /**
   * Kiểm tra độ phức tạp của mật khẩu (chuẩn an toàn hệ thống)
   */
  static validatePasswordStrength(password?: string): void {
    if (!password || typeof password !== 'string') {
      throw new Error('Mật khẩu bắt buộc không được để trống.');
    }
    if (password.length < 6) {
      throw new Error('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
    }
  }

  /**
   * Kiểm tra thông tin đăng nhập
   */
  static validateLoginCredentials(email?: string, pass?: string): void {
    this.validateEmail(email);
    if (!pass || !pass.trim()) {
      throw new Error('Mật khẩu đăng nhập không được để trống.');
    }
  }

  /**
   * Kiểm tra đổi mật khẩu
   */
  static validatePasswordChange(currentPass?: string, newPass?: string): void {
    if (!currentPass || !currentPass.trim()) {
      throw new Error('Vui lòng nhập mật khẩu hiện tại.');
    }
    this.validatePasswordStrength(newPass);
    if (currentPass === newPass) {
      throw new Error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
    }
  }
}
