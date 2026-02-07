export interface AdkSessionSnapshot {
  sessionId: string;
  companyId: string;
  senderId: string;
  context: Record<string, unknown>;
}

export enum Intent {
  BOOKING = 'INTENT_BOOKING',
  SHOPPING = 'INTENT_SHOPPING',
  REPORTING = 'INTENT_REPORTING',
  TWO_FA = 'INTENT_2FA_REPLY',
}

export interface SanitizedTextResult {
  sanitizedText: string;
  normalizedText: string;
  tokens: SanitizationToken[];
}
