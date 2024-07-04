import React, { useState, useEffect } from 'react';
import { Card, Table, Title, ScrollArea, Menu, ActionIcon, Group, rem } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { TbDots, TbTrash } from 'react-icons/tb';
import { useLocalStorage } from '@mantine/hooks';
import { SolveStat } from '../util/interfaces'; // Ensure this path is correct

interface StatsViewProps {
  algSetName: string;
  algName?: string; // Optional, if not used, can be removed
}

export const SummaryStatsView: React.FC<StatsViewProps> = ({ algSetName }) => {
  const [allStats, setAllStats] = useLocalStorage<Record<string, SolveStat[]>>({ key: 'stats', defaultValue: {} });
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

export const TimesListView: React.FC<StatsViewProps> = ({ algSetName }) => {
  const [allStats, setAllStats] = useLocalStorage<Record<string, SolveStat[]>>({ key: 'stats', defaultValue: {} });
  const [stats, setStats] = useState<SolveStat[]>([]);

  useEffect(() => {
    setStats(allStats[algSetName] ?? []);
  }, [allStats, algSetName]);

  const getMoveName = (move: string, n: number) => {
    if (n === 0) return "-";
    else if (n === 1) return move;
    else if (n === 2) return move + "2";
    else if (n === 3) return move + "'";
    else return "?";
  };

  const handleDelete = (index: number) => {
    setAllStats(prevStats => {
      const newStats = { ...prevStats };
      newStats[algSetName] = newStats[algSetName].filter((_, i) => i !== index);
      return newStats;
    });
  };

  const handleDeleteAll = () => {
    setAllStats(prevStats => {
      const newStats = Object.fromEntries(Object.entries(prevStats).filter(([key]) => key !== algSetName));
      return newStats;
    });
  };

  const columns = [
    { accessor: 'index', title: '#',  textAlign: 'right', render: (record: SolveStat, index: number) => stats.length - index },
    { accessor: 'name', title: 'Name', render: (record: SolveStat) => record.name },
    { accessor: 'recognitionTime', title: 'Rec', textAlign: 'right', render: (record: SolveStat) => (Math.ceil(record.recognitionTime / 10) / 100).toFixed(2) },
    { accessor: 'executionTime', title: 'Exec', textAlign: 'right', render: (record: SolveStat) => (Math.ceil(record.executionTime / 10) / 100).toFixed(2) },
    { accessor: 'AUFs', title: 'AUFs', textAlign: 'center', render: (record: SolveStat) => getMoveName("U", record.AUFs) },
    { accessor: 'Ys', title: 'Ys', textAlign: 'center', render: (record: SolveStat) => getMoveName("y", record.Ys) },
    { accessor: 'mirroredOverM', title: 'M', textAlign: 'center', render: (record: SolveStat) => record.mirroredOverM ? 'T' : 'F' },
    { accessor: 'mirroredOverS', title: 'S', textAlign: 'center', render: (record: SolveStat) => record.mirroredOverS ? 'T' : 'F' }
  ];

  return (
    <Card withBorder={true} padding={0} h="100%">
      <Card.Section withBorder={true} px="xs">
        <Group justify="space-between">
          <Title order={2}>Times</Title>
          <Menu withinPortal position="bottom-end" shadow="sm">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <TbDots style={{ width: rem(16), height: rem(16) }} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<TbTrash style={{ width: rem(14), height: rem(14) }} />}
                color="red"
                onClick={handleDeleteAll}
              >
                Delete all
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Card.Section>
      <DataTable
        ff="monospace"
        fz="xs"
        withRowBorders={false}
        verticalSpacing={0}
        horizontalSpacing="xs"
        highlightOnHover
        striped
        columns={columns}
        records={stats.toReversed().map((stat, index) => ({ ...stat, id: index }))}
        onRowDoubleClick={({ record, index }) => handleDelete(stats.length - 1 - index)}
      />
    </Card>
  );
};
