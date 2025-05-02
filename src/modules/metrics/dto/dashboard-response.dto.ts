export class DashboardResponseDto {
  retiradaPorCurso: {
    curso: string;
    quantidade: number;
  }[];

  modaNotebook: {
    nome_notebook: string;
    quantidade: number;
  };

  mediaTempoUso: number;

  medianaTempoUso: number;

  retiradaPorPeriodo: {
    period: string;
    quantidade: number;
  }[];

  top5TempoUso: {
    nome_notebook: string;
    tempo_medio_uso_minutos: number;
  }[];

  desvioPadrao: {
    desvio_padrao: string | number;
  };

  distribuicaoNormal: {
    minutos: number;
    probabilidade: number;
  }[];

  previsaoRetiradas: {
    proxima_data: string;
    quantidade_estimativa: number;
  }[];

  retiradasPorDiaUltimaSemana: {
    dia: string;
    total_retiradas: number;
  }[];

  notebooksNaoDevolvidos: {
    device_name: string;
    discipline: string;
    checkout_datetime: string;
  }[];
}
