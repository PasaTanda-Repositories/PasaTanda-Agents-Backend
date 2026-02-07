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

export interface GroupDashboard {
  group: { objectId: string | null; status: string };
  participants: Array<{ alias: string | null; status: string }>;
  myStatus: string;
}
