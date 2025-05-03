export class DashboardResponseDto {
  withdrawalsByCourse: {
    course: string;
    total: number;
  }[];

  mostFrequentNotebook: {
    notebookName: string;
    notebookSerialNumber: string;
    total: number;
  };

  averageUsageTime: number;

  medianUsageTime: number;

  withdrawalsByPeriod: {
    period: string;
    quantity: number;
  }[];

  top5LongestAverageUsage: {
    notebookName: string;
    averageUsageTimeMinutes: number;
  }[];

  usageTimeStdDev: {
    standardDeviation: string | number;
  };

  normalDistribution: {
    minutes: number;
    probability: number;
  }[];

  withdrawalForecast: {
    next_date: string;
    estimated_quantity: number;
  }[];

  dailyWithdrawalsLastWeek: {
    day: string;
    total_withdrawals: number;
  }[];

  unreturnedNotebooks: {
    device_name: string;
    discipline: string;
    checkout_datetime: string;
  }[];
}
