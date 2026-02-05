export type PasatandaIntent =
  | 'PAY_QUOTA'
  | 'PAYOUT_WINNER'
  | 'CHECK_STATUS'
  | 'CREATE_GROUP'
  | 'ADD_PARTICIPANT'
  | 'CONFIGURE_TANDA'
  | 'START_TANDA'
  | 'UPLOAD_PROOF'
  | 'VERIFY_PHONE'
  | 'GENERAL_HELP'
  | 'UNKNOWN';

export interface OrchestrationResult {
  intent: PasatandaIntent;
  agentUsed: string;
  responseText?: string;
  sessionState?: Record<string, unknown>;
}
