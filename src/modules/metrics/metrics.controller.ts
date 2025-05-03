import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getDashboard() {
    return this.metricsService.getDashboardData();
  }
}
