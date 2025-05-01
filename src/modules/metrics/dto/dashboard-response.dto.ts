export class DashboardResponseDto {
  retiradaPorCurso: {
    curso: string;
    quantidade: number;
  }[];

  modaNotebook: {
    nome: string;
    vezes: number;
  };

  mediaTempoUso: number;

  medianaTempoUso: number;

  retiradaPorPeriodo: {
    matutino: number;
    noturno: number;
  };

  top5TempoUso: {
    notebook: string;
    tempo_medio: number;
  }[];

  desvioPadrao: number;

  distribuicaoNormal: {
    minutos: number;
    probabilidade: number;
  }[];

  previsaoRetiradas: {
    proxima_data: string; // ou Date se quiser formatar no front
    quantidade_estimativa: number;
  };
}
