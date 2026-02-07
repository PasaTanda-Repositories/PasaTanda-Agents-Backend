import { Body, Controller, Post } from '@nestjs/common';

@Controller('webhooks')
export class ExternalWebhooksController {
  @Post('bank-provider')
  async handleBank(
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    // Placeholder: aquí se integrará validación y conciliación bancaria
    return { status: 'accepted' };
  }

  @Post('circle')
  async handleCircle(
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    return { status: 'accepted' };
  }

  @Post('sui-indexer')
  async handleSuiIndexer(
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    return { status: 'accepted' };
  }
}
