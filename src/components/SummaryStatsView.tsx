import React, { useState, useEffect } from 'react';
import { Group, Card, Title, SegmentedControl } from '@mantine/core';
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
  const [selectedTimeType, setSelectedTimeType] = useState<'rec' | 'exec' | 'total'>('total');

  useEffect(() => {
    setStats(allStats[algSetName] ?? []);
  }, [allStats, algSetName]);

  const getBest = () => {
    if (stats.length === 0) return '-';
    let times;
    if (selectedTimeType === 'rec') {
      times = stats.map((stat) => stat.recognitionTime);
    } else if (selectedTimeType === 'exec') {
      times = stats.map((stat) => stat.executionTime);
    } else {
      times = stats.map((stat) => stat.recognitionTime + stat.executionTime);
    }
    return Math.round(Math.min(...times) / 10) / 100;
  };

  const getAo = (n: number) => {
    if (stats.length < n) return '-';
    let times;
    if (selectedTimeType === 'rec') {
      times = stats.slice(-n).map((stat) => stat.recognitionTime);
    } else if (selectedTimeType === 'exec') {
      times = stats.slice(-n).map((stat) => stat.executionTime);
    } else {
      times = stats.slice(-n).map((stat) => stat.recognitionTime + stat.executionTime);
    }
    return Math.round(times.reduce((a, b) => a + b, 0) / n / 10) / 100;
  };

  const columns = [
    { accessor: 'n', title: 'n', render: () => stats.length },
    { accessor: 'best', title: 'best', render: () => getBest() },
    { accessor: 'ao5', title: 'ao5', render: () => getAo(5) },
    { accessor: 'ao12', title: 'ao12', render: () => getAo(12) },
    { accessor: 'ao50', title: 'ao50', render: () => getAo(50) },
    { accessor: 'ao100', title: 'ao100', render: () => getAo(100) }
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
        <Group justify="space-between">
          <Title order={2}>Stats</Title>
          <SegmentedControl
			size="xs"
            value={selectedTimeType}
            onChange={(value) => setSelectedTimeType(value as 'rec' | 'exec' | 'total')}
            data={[
              { label: 'Rec', value: 'rec' },
              { label: 'Exec', value: 'exec' },
              { label: 'Total', value: 'total' },
            ]}
          />
        </Group>
      </Card.Section>
      <DataTable
        ff="monospace"
        fz="xs"
        verticalSpacing={0}
        horizontalSpacing="xs"
        columns={columns}
        records={records}
        defaultColumnProps={{
          textAlign: 'center',
        }}
      />
    </Card>
  );
};

export default SummaryStatsView;
