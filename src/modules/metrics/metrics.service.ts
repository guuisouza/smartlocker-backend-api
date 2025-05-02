import { Injectable } from '@nestjs/common';
import { MetricsCalculationService } from './metrics-calculations/metrics-calculations.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class MetricsService {
  constructor(private readonly calculations: MetricsCalculationService) {}

  async getDashboardData(): Promise<DashboardResponseDto> {
    return {
      retiradaPorCurso: await this.calculations.getRetiradasPorCurso(),
      modaNotebook: await this.calculations.getModaNotebook(),
      mediaTempoUso: await this.calculations.getMediaTempoUso(),
      medianaTempoUso: await this.calculations.getMedianaTempoUso(),
      retiradaPorPeriodo: await this.calculations.getRetiradaPorPeriodo(),
      top5TempoUso: await this.calculations.getTop5TempoUso(),
      desvioPadrao: await this.calculations.getDesvioPadrao(),
      distribuicaoNormal: await this.calculations.getDistribuicaoNormal(),
      previsaoRetiradas: await this.calculations.getPrevisaoRetiradas(),
      retiradasPorDiaUltimaSemana:
        await this.calculations.getRetiradasPorDiaUltimaSemana(),
      notebooksNaoDevolvidos:
        await this.calculations.getNotebooksNaoDevolvidos(),
    };
  }
}
