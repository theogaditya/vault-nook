/**
 * MyVault WebAuthn / Passkey Helper Utility
 * Wraps WebAuthn API for credential registration and authentication assertion.
 */

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export interface WebAuthnRegisterOptions {
  options: any; // PublicKeyCredentialCreationOptionsJSON
  deviceName: string;
}

export interface WebAuthnAuthenticateOptions {
  options: any; // PublicKeyCredentialRequestOptionsJSON
}

export class PasskeyClient {
  /**
   * Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
   */
  static async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return false;
    }
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Start Passkey Registration Flow
   */
  static async registerPasskey(creationOptions: any) {
    try {
      const attResp = await startRegistration({ optionsJSON: creationOptions });
      return attResp;
    } catch (error: any) {
      if (error.name === 'InvalidStateError') {
        throw new Error('This passkey is already registered on this device.');
      }
      if (error.name === 'NotAllowedError') {
        throw new Error('Passkey creation was canceled or timed out.');
      }
      throw error;
    }
  }

  /**
   * Start Passkey Authentication Flow
   */
  static async authenticatePasskey(requestOptions: any) {
    try {
      const assertionResp = await startAuthentication({ optionsJSON: requestOptions });
      return assertionResp;
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Passkey authentication was canceled or timed out.');
      }
      throw error;
    }
  }
}
