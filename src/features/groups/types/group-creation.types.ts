export type FrequencyType = 'WEEKLY' | 'MONTHLY' | 'BIWEEKLY';

export interface CreateGroupParams {
  name: string;
  contributionAmount: number;
  guaranteeAmount: number;
  frequency: FrequencyType;
  totalRounds: number;
  createdBy: string;
}

export interface CreateGroupResult {
  id: string;
  inviteCode: string;
}

export interface GroupInviteLookup {
  id: string;
  name: string;
  status: string;
  contributionAmount: number;
  guaranteeAmount: number;
  frequency: FrequencyType;
  totalRounds: number;
  inviteCode: string;
}

export interface InviteInfo {
  inviteCode: string;
  inviteLink: string;
  groupName: string;
}

export interface AddMembershipParams {
  groupId: string;
  userId: string;
  turnNumber?: number;
  isAdmin?: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  status: string;
  contributionAmount: number;
  myTurn: number | null;
}

export interface GroupDetails {
  id: string;
  name: string | null;
  status: string;
  objectId: string | null;
  contributionAmount: number | null;
  guaranteeAmount: number | null;
  frequency: FrequencyType | null;
  totalRounds: number | null;
  inviteCode: string | null;
  createdBy: string | null;
}

export interface GroupParticipant {
  membershipId: string;
  userId: string;
  alias: string | null;
  isAdmin: boolean;
  turnNumber: number | null;
  joinedAt: string | null;
  suiAddress: string | null;
}

export interface GroupTransaction {
  id: string;
  userId: string;
  type: string;
  method: string;
  status: string;
  amount: number | null;
  currency: 'USDC';
  externalPaymentUrl: string | null;
  qrImageLink: string | null;
  createdAt: string | null;
}

export interface GroupDashboard {
  group: GroupDetails;
  participants: GroupParticipant[];
  transactions: GroupTransaction[];
  myStatus: string;
  memberAddresses: Array<string | null>;
}
