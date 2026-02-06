export interface UpsertUserParams {
  phone: string;
  username: string;
  preferredCurrency: string;
}

export interface UpsertUserResult {
  userId: number;
  stellarPublicKey: string;
  stellarSecretKey: string;
  normalizedPhone: string;
}

export interface CreateMembershipParams {
  userId: number;
  groupDbId: number;
  isAdmin: boolean;
  turnNumber?: number;
}

export interface CreateDraftGroupParams {
  name: string;
  amount: number;
  frequencyDays: number;
  yieldEnabled: boolean;
  whatsappGroupId?: string;
}

export interface CreateDraftGroupResult {
  groupId: string;
  groupDbId: number;
  whatsappGroupJid: string;
  enableYield: boolean;
}
