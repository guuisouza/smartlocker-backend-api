import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class MetricsCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async getWithdrawalsByCourse() {
    const groupedMovements = await this.prisma.movements.groupBy({
      by: ['schedule_id'],
      _count: {
        _all: true,
      },
    });

    const allSchedules = await this.prisma.schedules.findMany({
      include: {
        courses: {
          select: {
            id: true,
            short_name: true,
          },
        },
      },
    });

    const withdrawalsByCourse: Record<string, number> = {};

    for (const movement of groupedMovements) {
      const relatedSchedule = allSchedules.find(
        (schedule) => schedule.id === movement.schedule_id,
      );

      if (!relatedSchedule || !relatedSchedule.course_id) continue;

      const courseShortName = relatedSchedule.courses.short_name;
      withdrawalsByCourse[courseShortName] =
        (withdrawalsByCourse[courseShortName] || 0) + movement._count._all;
    }

    const result = Object.entries(withdrawalsByCourse).map(
      ([course, total]) => ({
        course,
        total,
      }),
    );

    return result;
  }

  async getMostFrequentNotebook() {
    const groupedMovements = await this.prisma.movements.groupBy({
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

    if (!groupedMovements.length) return null;

    const notebook = await this.prisma.notebooks.findUnique({
      where: { id: groupedMovements[0].notebook_id },
      select: { device_name: true, serial_number: true },
    });

    if (!notebook) return null;

    return {
      notebookName: notebook.device_name,
      notebookSerialNumber: notebook.serial_number,
      total: groupedMovements[0]._count.notebook_id,
    };
  }

  async getAverageUsageTime(): Promise<number> {
    /* Versão alternativa mais simples (menos precisa):
    const result = await this.prisma.$queryRaw<{ media_minutos: number }[]>`
      SELECT AVG(TIMESTAMPDIFF(MINUTE, checkout_datetime, return_datetime)) AS media_minutos
      FROM movements
      WHERE return_datetime IS NOT NULL
    `;
    */

    const result = await this.prisma.$queryRaw<{ media_minutos: number }[]>`
    SELECT AVG(TIMESTAMPDIFF(SECOND, checkout_datetime, return_datetime) / 60) AS media_minutos
    FROM movements
    WHERE return_datetime IS NOT NULL
  `;

    return result[0]?.media_minutos ?? 0;
  }

  async getMedianUsageTime() {
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
          (SELECT tempo_uso FROM OrderedMovements WHERE row_num = (total_count + 1) / 2)
        ELSE
          (SELECT AVG(tempo_uso) FROM OrderedMovements WHERE row_num IN (total_count / 2, total_count / 2 + 1))
      END AS mediana_minutos
    FROM OrderedMovements
    LIMIT 1;
  `;

    return result[0]?.mediana_minutos || 0;
  }

  async getWithdrawalsByPeriod() {
    const groupedWithdrawals = await this.prisma.movements.groupBy({
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

    const countByPeriod: Record<string, number> = {};

    for (const item of groupedWithdrawals) {
      const schedule = schedules.find((s) => s.id === item.schedule_id);
      if (!schedule || !schedule.course_id) continue;

      const period = schedule.courses.period;
      countByPeriod[period] = (countByPeriod[period] || 0) + item._count._all;
    }

    const result = Object.entries(countByPeriod).map(([period, quantity]) => ({
      period,
      quantity,
    }));

    return result;
  }

  async getTop5LongestAverageUsage() {
    const averageTimes = await this.prisma.$queryRaw<
      { notebook_id: number; media_minutos: number }[]
    >`
    SELECT
      notebook_id,
      AVG(TIMESTAMPDIFF(SECOND, checkout_datetime, return_datetime) / 60) AS media_minutos
    FROM movements
    WHERE return_datetime IS NOT NULL
    GROUP BY notebook_id
    ORDER BY media_minutos DESC
    LIMIT 5
  `;

    const notebookIds = averageTimes.map((item) => item.notebook_id);

    const notebooks = await this.prisma.notebooks.findMany({
      where: {
        id: {
          in: notebookIds,
        },
      },
      select: {
        id: true,
        device_name: true,
      },
    });

    const result = averageTimes.map((item) => {
      const notebook = notebooks.find((n) => n.id === item.notebook_id);
      return {
        notebookName: notebook?.device_name || 'Desconhecido',
        averageUsageTimeMinutes: Number(item.media_minutos.toFixed(2)),
      };
    });

    return result;
  }

  async getUsageTimeStandardDeviation() {
    const movements = await this.prisma.movements.findMany({
      where: {
        return_datetime: {
          not: null,
        },
      },
      select: {
        checkout_datetime: true,
        return_datetime: true,
      },
    });

    const durations = movements.map((movement) => {
      const start = new Date(movement.checkout_datetime).getTime();
      const end = new Date(movement.return_datetime!).getTime();
      return (end - start) / 1000 / 60;
    });

    if (durations.length === 0) {
      return { standardDeviation: 0 };
    }

    const average =
      durations.reduce((acc, val) => acc + val, 0) / durations.length;

    const variance =
      durations.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) /
      durations.length;

    const standardDeviation = Math.sqrt(variance);

    return {
      standardDeviation: Number(standardDeviation.toFixed(2)),
    };
  }

  async getNormalDistribution() {
    const movements = await this.prisma.movements.findMany({
      where: {
        return_datetime: {
          not: null,
        },
      },
      select: {
        checkout_datetime: true,
        return_datetime: true,
      },
    });

    const usageTimes = movements.map((movement) => {
      const start = new Date(movement.checkout_datetime).getTime();
      const end = new Date(movement.return_datetime).getTime();
      return (end - start) / 60000; // minutes
    });

    if (usageTimes.length === 0) return [];

    const mean =
      usageTimes.reduce((acc, time) => acc + time, 0) / usageTimes.length;

    const variance =
      usageTimes.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) /
      usageTimes.length;

    const standardDeviation = Math.sqrt(variance);

    const interval = 5; // interval in minutes
    const minX = 0;
    const maxX = Math.ceil(mean + 4 * standardDeviation);

    const distribution = [];

    for (let x = minX; x <= maxX; x += interval) {
      const exponent =
        -Math.pow(x - mean, 2) / (2 * Math.pow(standardDeviation, 2));
      const y =
        (1 / (standardDeviation * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
      distribution.push({ x, y: parseFloat(y.toFixed(6)) });
    }

    return distribution;
  }

  async getWithdrawalForecast() {
    const totals = await this.prisma.$queryRawUnsafe<
      { day_of_week: number; total: bigint; distinct_days: bigint }[]
    >(`
    SELECT
      DAYOFWEEK(checkout_datetime) - 1 AS day_of_week,
      COUNT(*) AS total,
      COUNT(DISTINCT DATE(checkout_datetime)) AS distinct_days
    FROM movements
    WHERE return_datetime IS NOT NULL
      AND DAYOFWEEK(checkout_datetime) BETWEEN 2 AND 7 -- Monday (2) to Saturday (7)
    GROUP BY day_of_week
    ORDER BY day_of_week
  `);

    const averages = totals.map(({ day_of_week, total, distinct_days }) => ({
      day_of_week: Number(day_of_week),
      average: distinct_days > 0 ? Number(total) / Number(distinct_days) : 0,
    }));

    const today = new Date();

    const forecast = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() + i + 1);

      const dayOfWeek = date.getDay(); // JS: 0 = Sunday, ..., 6 = Saturday

      const average =
        averages.find((a) => a.day_of_week === dayOfWeek)?.average || 0;

      return {
        next_date: date.toISOString().split('T')[0],
        estimated_quantity: Math.round(average),
      };
    });

    return forecast;
  }

  async getDailyWithdrawalsLastWeek() {
    const results = await this.prisma.$queryRaw<
      { day_of_week: string; total: bigint }[]
    >`
    SELECT 
      CASE DAYOFWEEK(checkout_datetime)
        WHEN 2 THEN 'Segunda'
        WHEN 3 THEN 'Terça'
        WHEN 4 THEN 'Quarta'
        WHEN 5 THEN 'Quinta'
        WHEN 6 THEN 'Sexta'
        WHEN 7 THEN 'Sábado'
        WHEN 1 THEN 'Domingo'
      END AS day_of_week,
      COUNT(*) AS total
    FROM movements
    WHERE 
      WEEKOFYEAR(checkout_datetime) = WEEKOFYEAR(CURDATE()) - 1
    GROUP BY day_of_week
    ORDER BY FIELD(
      day_of_week, 
      'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'
    )
  `;

    const daysOfWeek = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ];

    const resultsWithZero = daysOfWeek.map((day) => ({
      day,
      total_withdrawals: 0,
    }));

    results.forEach((item) => {
      const dayOfWeek = item.day_of_week;
      const total = Number(item.total);

      const day = resultsWithZero.find((d) => d.day === dayOfWeek);
      if (day) {
        day.total_withdrawals = total;
      }
    });

    return resultsWithZero;
  }

  async getUnreturnedNotebooks() {
    const results = await this.prisma.$queryRawUnsafe<
      {
        device_name: string;
        discipline: string;
        checkout_datetime: string;
      }[]
    >(`
    SELECT 
      n.device_name,
      s.discipline,
      DATE_FORMAT(m.checkout_datetime, '%Y-%m-%d %H:%i:%s') AS checkout_datetime
    FROM movements m
    JOIN notebooks n ON m.notebook_id = n.id
    JOIN schedules s ON m.schedule_id = s.id
    WHERE m.return_datetime IS NULL
    ORDER BY m.checkout_datetime DESC
  `);

    return results.map((item) => ({
      device_name: item.device_name,
      discipline: item.discipline,
      checkout_datetime: item.checkout_datetime,
    }));
  }
}
