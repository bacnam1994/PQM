/**
 * AUTH DOMAIN: AUTH APPLICATION SERVICE (VS-16)
 * =============================================
 * Dịch vụ xác thực ứng dụng (Authentication Application Service).
 * Tuân thủ Clean Architecture: UI -> AuthAppService -> AuthRules -> IAuthRepository.
 */

import { IAuthRepository, firebaseAuthRepository } from '../infrastructure/repository';
import { AuthRules } from '../domain/rules';

export class AuthAppService {
  constructor(private readonly repo: IAuthRepository = firebaseAuthRepository) {}

  async login(email: string, pass: string) {
    AuthRules.validateLoginCredentials(email, pass);
    return await this.repo.signIn(email.trim(), pass);
  }

  async signup(email: string, pass: string) {
    AuthRules.validateLoginCredentials(email, pass);
    AuthRules.validatePasswordStrength(pass);
    return await this.repo.signUp(email.trim(), pass);
  }

  async logout() {
    return await this.repo.signOut();
  }

  async changePassword(currentPass: string, newPass: string) {
    AuthRules.validatePasswordChange(currentPass, newPass);
    return await this.repo.changePassword(currentPass, newPass);
  }

  async resetPassword(email: string) {
    AuthRules.validateEmail(email);
    return await this.repo.resetPassword(email.trim());
  }

  async setPersistence() {
    return await this.repo.setPersistence();
  }
}

export const authAppService = new AuthAppService();
