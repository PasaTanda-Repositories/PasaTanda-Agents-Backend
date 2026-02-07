import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InfrastructureModule } from '../../common/intraestructure/infrastructure.module';
import { SecurityModule } from '../../common/security/security.module';
import { LoginModule } from '../login/login.module';

@Module({
  imports: [InfrastructureModule, SecurityModule, LoginModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
