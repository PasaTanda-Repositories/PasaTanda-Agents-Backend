export interface IssueCodeResult {
  code: string;
  expiresAt: Date;
}

export interface VerificationRecord {
  phone: string;
  code: string | null;
  expiresAt: Date;
  verified: boolean;
  timestamp: Date | null;
  whatsappUsername?: string;
  whatsappNumber?: string;
}

export interface DbVerificationRow {
  id: number;
  phone: string;
  code: string | null;
  expires_at: string | null;
  verified: boolean;
  verified_at: string | null;
  whatsapp_username: string | null;
  whatsapp_number: string | null;
}

export interface ConfirmVerificationInput {
  phone: string;
  verified: boolean;
  timestamp?: number;
  whatsappUsername?: string;
  whatsappNumber?: string;
}

export interface VerificationConfirmationPayload {
  phone: string;
  verified: boolean;
  timestamp: number;
  whatsappUsername?: string;
  whatsappNumber?: string;
}
