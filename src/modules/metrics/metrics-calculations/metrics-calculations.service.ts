import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class MetricsCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async getRetiradasPorCurso() {
    const data = await this.prisma.movements.groupBy({
      by: ['schedule_id'],
      _count: {
        _all: true,
      },
    });

    const schedules = await this.prisma.schedules.findMany({
      include: {
        courses: {
          select: {
            id: true,
            short_name: true,
          },
        },
      },
    });

    const contadorPorCurso: Record<string, number> = {};

    for (const item of data) {
      const schedule = schedules.find((s) => s.id === item.schedule_id);
      if (!schedule || !schedule.course_id) continue;

      const curso = schedule.courses.short_name;
      contadorPorCurso[curso] =
        (contadorPorCurso[curso] || 0) + item._count._all;
    }

    const resultado = Object.entries(contadorPorCurso).map(
      ([curso, quantidade]) => ({
        curso,
        quantidade,
      }),
    );

    return resultado;
  }

  async getModaNotebook() {
    const data = await this.prisma.movements.groupBy({
      by: ['notebook_id'],
      _count: {
        notebook_id: true,
      },
      orderBy: {
        _count: {
          notebook_id: 'desc',
        },
      },
      take: 1,
    });

    if (!data.length) return null;

    const notebook = await this.prisma.notebooks.findUnique({
      where: { id: data[0].notebook_id },
      select: { device_name: true },
    });

    if (!notebook) return null;

    return {
      notebook_name: notebook.device_name,
      count: data[0]._count.notebook_id,
    };
  }

  async getMediaTempoUso(): Promise<number> {
    //   const result = await this.prisma.$queryRaw<{ media_minutos: number }[]>`
    //   SELECT AVG(TIMESTAMPDIFF(MINUTE, checkout_datetime, return_datetime)) AS media_minutos
    //   FROM movements
    //   WHERE return_datetime IS NOT NULL
    // `;

    const result = await this.prisma.$queryRaw<{ media_minutos: number }[]>`
      SELECT AVG(TIMESTAMPDIFF(SECOND, checkout_datetime, return_datetime) / 60) AS media_minutos
      FROM movements
      WHERE return_datetime IS NOT NULL
    `;

    return result[0]?.media_minutos ?? 0;
  }

  async getMedianaTempoUso() {
    const result = await this.prisma.$queryRaw<{ mediana_minutos: number }[]>`
    WITH OrderedMovements AS (
      SELECT
        TIMESTAMPDIFF(SECOND, checkout_datetime, return_datetime) / 60 AS tempo_uso,
        ROW_NUMBER() OVER (ORDER BY TIMESTAMPDIFF(SECOND, checkout_datetime, return_datetime) / 60.0) AS row_num,
        COUNT(*) OVER () AS total_count
      FROM movements
      WHERE return_datetime IS NOT NULL
    )
    SELECT 
      CASE
        WHEN total_count % 2 = 1 THEN
          -- Se o total de registros for ímpar, pegamos o valor central
          (SELECT tempo_uso FROM OrderedMovements WHERE row_num = (total_count + 1) / 2)
        ELSE
          -- Se o total de registros for par, pegamos a média dos dois valores centrais
          (SELECT AVG(tempo_uso) FROM OrderedMovements WHERE row_num IN (total_count / 2, total_count / 2 + 1))
      END AS mediana_minutos
    FROM OrderedMovements
    LIMIT 1;
  `;

    return result[0]?.mediana_minutos || 0;
  }

  async getRetiradaPorPeriodo() {
    const data = await this.prisma.movements.groupBy({
      by: ['schedule_id'],
      _count: {
        _all: true,
      },
    });

    const schedules = await this.prisma.schedules.findMany({
      include: {
        courses: {
          select: {
            id: true,
            period: true,
          },
        },
      },
    });

    const contadorPorPeriodo: Record<string, number> = {};

    for (const item of data) {
      const schedule = schedules.find((s) => s.id === item.schedule_id);
      if (!schedule || !schedule.course_id) continue;

      const period = schedule.courses.period;
      contadorPorPeriodo[period] =
        (contadorPorPeriodo[period] || 0) + item._count._all;
    }

    const resultado = Object.entries(contadorPorPeriodo).map(
      ([period, quantidade]) => ({
        period,
        quantidade,
      }),
    );

    return resultado;
  }

  // async getTop5TempoUso() {}
  // async getDesvioPadrao() {}
  // async getDistribuicaoNormal() {}
  // async getPrevisaoRetiradas() {}
}
