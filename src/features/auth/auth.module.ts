import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProvingService } from './proving.service';
import { InfrastructureModule } from '../../common/intraestructure/infrastructure.module';
import { SecurityModule } from '../../common/security/security.module';
import { LoginModule } from '../login/login.module';

@Module({
  imports: [InfrastructureModule, SecurityModule, LoginModule, HttpModule],
  controllers: [AuthController],
  providers: [AuthService, ProvingService],
})
export class AuthModule {}
