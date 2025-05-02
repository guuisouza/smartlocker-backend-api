import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Controller('dashboard')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getDashboard(): Promise<DashboardResponseDto> {
    return this.metricsService.getDashboardData();
  }
}
