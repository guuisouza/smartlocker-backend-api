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
      nome_notebook: notebook.device_name,
      quantidade: data[0]._count.notebook_id,
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

  async getTop5TempoUso() {
    // Consulta raw para calcular tempo médio de uso por notebook_id
    const medias = await this.prisma.$queryRaw<
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

    // Busca os nomes dos notebooks
    const notebookIds = medias.map((m) => m.notebook_id);
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

    // Junta os dados
    const resultado = medias.map((item) => {
      const notebook = notebooks.find((n) => n.id === item.notebook_id);
      return {
        nome_notebook: notebook?.device_name || 'Desconhecido',
        tempo_medio_uso_minutos: Number(item.media_minutos.toFixed(2)),
      };
    });

    return resultado;
  }

  async getDesvioPadrao() {
    const movimentos = await this.prisma.movements.findMany({
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

    // Calcular todos os tempos de uso em minutos
    const tempos = movimentos.map((m) => {
      const inicio = new Date(m.checkout_datetime).getTime();
      const fim = new Date(m.return_datetime!).getTime();
      const minutos = (fim - inicio) / 1000 / 60;
      return minutos;
    });

    if (tempos.length === 0) return { desvio_padrao: 0 };

    const media = tempos.reduce((acc, val) => acc + val, 0) / tempos.length;

    const variancia =
      tempos.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) /
      tempos.length;

    const desvioPadrao = Math.sqrt(variancia);

    return {
      desvio_padrao: desvioPadrao.toFixed(2),
    };
  }

  async getDistribuicaoNormal() {
    const movimentos = await this.prisma.movements.findMany({
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

    const temposUso = movimentos.map((m) => {
      const inicio = new Date(m.checkout_datetime).getTime();
      const fim = new Date(m.return_datetime).getTime();
      return (fim - inicio) / 60000; // minutos
    });

    if (temposUso.length === 0) return [];

    const media =
      temposUso.reduce((acc, tempo) => acc + tempo, 0) / temposUso.length;

    const variancia =
      temposUso.reduce((acc, tempo) => acc + Math.pow(tempo - media, 2), 0) /
      temposUso.length;

    const desvioPadrao = Math.sqrt(variancia);

    const passo = 5; // intervalo em minutos
    const xMin = 0;
    const xMax = Math.ceil(media + 4 * desvioPadrao);

    const distribuicao = [];

    for (let x = xMin; x <= xMax; x += passo) {
      const expoente =
        -Math.pow(x - media, 2) / (2 * Math.pow(desvioPadrao, 2));
      const y =
        (1 / (desvioPadrao * Math.sqrt(2 * Math.PI))) * Math.exp(expoente);
      distribuicao.push({ x, y: parseFloat(y.toFixed(6)) });
    }

    return distribuicao;
  }

  async getPrevisaoRetiradas() {
    const totais = await this.prisma.$queryRawUnsafe<
      { dia_semana: number; total: bigint; dias_distintos: bigint }[]
    >(`
    SELECT
      DAYOFWEEK(checkout_datetime) - 1 AS dia_semana,
      COUNT(*) AS total,
      COUNT(DISTINCT DATE(checkout_datetime)) AS dias_distintos
    FROM movements
    WHERE return_datetime IS NOT NULL
      AND DAYOFWEEK(checkout_datetime) BETWEEN 2 AND 7 -- Segunda (2) a Sábado (7)
    GROUP BY dia_semana
    ORDER BY dia_semana
  `);

    const medias = totais.map(({ dia_semana, total, dias_distintos }) => ({
      dia_semana: Number(dia_semana),
      media: dias_distintos > 0 ? Number(total) / Number(dias_distintos) : 0,
    }));

    const hoje = new Date();

    const previsaoRetiradas = Array.from({ length: 7 }, (_, i) => {
      const data = new Date();
      data.setDate(hoje.getDate() + i + 1);

      const diaSemana = data.getDay(); // JS: 0 = domingo, ..., 6 = sábado

      const media = medias.find((m) => m.dia_semana === diaSemana)?.media || 0;

      return {
        proxima_data: data.toISOString().split('T')[0],
        quantidade_estimativa: Math.round(media),
      };
    });

    return previsaoRetiradas;
  }

  async getRetiradasPorDiaUltimaSemana() {
    const resultados = await this.prisma.$queryRaw<
      { dia_semana: string; total: bigint }[]
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
      END AS dia_semana,
      COUNT(*) AS total
    FROM movements
    WHERE 
      WEEKOFYEAR(checkout_datetime) = WEEKOFYEAR(CURDATE()) - 1
    GROUP BY dia_semana
    ORDER BY FIELD(
      dia_semana, 
      'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'
    )
  `;

    // Definindo os dias da semana com valor 0 inicialmente
    const diasDaSemana = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ];

    // Inicializando todos os dias com total de 0
    const resultadosComZero = diasDaSemana.map((dia) => ({
      dia,
      total_retiradas: 0,
    }));

    // Atualizando os dias com os valores retornados pela query
    resultados.forEach((item) => {
      const diaSemana = item.dia_semana;
      const total = Number(item.total);

      const dia = resultadosComZero.find((d) => d.dia === diaSemana);
      if (dia) {
        dia.total_retiradas = total;
      }
    });

    return resultadosComZero;
  }

  async getNotebooksNaoDevolvidos() {
    const resultados = await this.prisma.$queryRawUnsafe<
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

    return resultados.map((item) => ({
      device_name: item.device_name,
      discipline: item.discipline,
      checkout_datetime: item.checkout_datetime,
    }));
  }
}
