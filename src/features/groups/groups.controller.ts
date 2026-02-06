import { Body, Controller, Get, Headers, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../common/security/token.service';
import { GroupCreationService } from './services/group-creation.service';
import { CreateGroupDto, JoinGroupDto } from './dto/group.dto';

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly tokens: TokenService,
    private readonly groups: GroupCreationService,
  ) {}

  @Get()
  async list(@Headers('authorization') authorization: string) {
    const { userId } = this.resolveUser(authorization);
    return this.groups.listGroupsForUser(userId);
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string,
    @Body() body: CreateGroupDto,
  ): Promise<{ groupId: string; inviteLink: string }> {
    const { userId } = this.resolveUser(authorization);
    const created = await this.groups.createGroup({
      name: body.name,
      contributionAmount: body.contributionAmount,
      guaranteeAmount: body.guaranteeAmount,
      frequency: body.frequency,
      totalRounds: body.totalRounds,
      createdBy: userId,
    });

    await this.groups.addMembership({
      groupId: created.id,
      userId,
      turnNumber: 1,
      isAdmin: true,
    });

    return {
      groupId: created.id,
      inviteLink: `https://pasatanda.lat/join/${created.inviteCode}`,
    };
  }

  @Post(':id/join')
  async join(
    @Headers('authorization') authorization: string,
    @Param('id') groupId: string,
    @Body() body: JoinGroupDto,
  ): Promise<{ membershipId: string; turnIndex: number }> {
    const { userId } = this.resolveUser(authorization);
    const turnNumber = body.turnNumber ?? (await this.groups.getNextTurnNumber(groupId));
    const membershipId = await this.groups.addMembership({
      groupId,
      userId,
      turnNumber,
      isAdmin: false,
    });

    return { membershipId, turnIndex: turnNumber };
  }

  @Get(':id/dashboard')
  async dashboard(
    @Headers('authorization') authorization: string,
    @Param('id') groupId: string,
    @Query('userId') overrideUserId?: string,
  ) {
    const { userId } = this.resolveUser(authorization);
    const requester = overrideUserId ?? userId;
    return this.groups.getDashboard(groupId, requester);
  }

  private resolveUser(authorization?: string): { userId: string } {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header inválido');
    }
    const token = authorization.slice('Bearer '.length).trim();
    const payload = this.tokens.verifyToken(token);
    return { userId: payload.userId };
  }
}
