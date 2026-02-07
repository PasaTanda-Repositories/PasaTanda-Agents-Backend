import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('webhooks')
@Controller('webhooks')
export class ExternalWebhooksController {
  @Post('bank-provider')
  @ApiOperation({ summary: 'Webhook de proveedor bancario (mock)' })
  async handleBank(
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    // Placeholder: aquí se integrará validación y conciliación bancaria
    return { status: 'accepted' };
  }

  @Post('circle')
  @ApiOperation({ summary: 'Webhook de pagos Circle (mock)' })
  async handleCircle(
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    return { status: 'accepted' };
  }

  @Post('sui-indexer')
  @ApiOperation({ summary: 'Webhook de indexador Sui (mock)' })
  async handleSuiIndexer(
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    return { status: 'accepted' };
  }
}
