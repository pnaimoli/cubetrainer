import React, { useState, useEffect } from 'react';
import { Card, Title } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useLocalStorage } from '@mantine/hooks';
import { SolveStat } from '../util/interfaces'; // Ensure this path is correct

interface SummaryStatsViewProps {
  algSetName: string;
  algName?: string; // Optional, if not used, can be removed
}

const SummaryStatsView: React.FC<SummaryStatsViewProps> = ({ algSetName }) => {
  const [allStats] = useLocalStorage<Record<string, SolveStat[]>>({ key: 'stats', defaultValue: {} });
  const [stats, setStats] = useState<SolveStat[]>([]);

  useEffect(() => {
    setStats(allStats[algSetName] ?? []);
  }, [allStats, algSetName]);

  const getBest = () => {
    return stats.length > 0 ? Math.round(Math.min(...stats.map((stat) => stat.executionTime)) / 10) / 100 : '-';
  };

  const getAo = (n: number) => {
    if (stats.length < n) return '-';
    const times = stats.slice(-n).map((stat) => stat.executionTime);
    return Math.round(times.reduce((a, b) => a + b, 0) / n / 10) / 100;
  };

  const columns = [
    { accessor: 'n', title: 'n', textAlign: 'center', render: () => stats.length },
    { accessor: 'best', title: 'best', textAlign: 'center', render: () => getBest() },
    { accessor: 'ao5', title: 'ao5', textAlign: 'center', render: () => getAo(5) },
    { accessor: 'ao12', title: 'ao12', textAlign: 'center', render: () => getAo(12) },
    { accessor: 'ao50', title: 'ao50', textAlign: 'center', render: () => getAo(50) },
    { accessor: 'ao100', title: 'ao100', textAlign: 'center', render: () => getAo(100) }
  ];

  const records = [
    {
      id: "current",
      n: stats.length,
      best: getBest(),
      ao5: getAo(5),
      ao12: getAo(12),
      ao50: getAo(50),
      ao100: getAo(100)
    }
  ];

  return (
    <Card withBorder={true} padding={0} h="100">
      <Card.Section withBorder={true} px="xs">
        <Title order={2}>Stats</Title>
      </Card.Section>
      <DataTable
        ff="monospace"
        fz="xs"
        verticalSpacing={0}
        horizontalSpacing="xs"
        columns={columns}
        records={records}
      />
    </Card>
  );
};

export default SummaryStatsView;
