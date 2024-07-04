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

  const handleDeleteAll = () => {
    setAllStats(prevStats => {
      const newStats = Object.fromEntries(Object.entries(prevStats).filter(([key]) => key !== algSetName));
      return newStats;
    });
  };

  return (
    <Card withBorder={true}>
      <Card.Section withBorder={true} px="xs">
        <Group justify="space-between">
          <Title order={2}>Summary Stats</Title>
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
      <Table ta="center" ff="monospace" withColumnBorders={true}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>n</Table.Th>
            <Table.Th>best</Table.Th>
            <Table.Th>ao5</Table.Th>
            <Table.Th>ao12</Table.Th>
            <Table.Th>ao50</Table.Th>
            <Table.Th>ao100</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr key={algSetName}>
            <Table.Td>{stats.length}</Table.Td>
            <Table.Td>{getBest()}</Table.Td>
            <Table.Td>{getAo(5)}</Table.Td>
            <Table.Td>{getAo(12)}</Table.Td>
            <Table.Td>{getAo(50)}</Table.Td>
            <Table.Td>{getAo(100)}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
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

  const columns = [
    { accessor: 'index', title: '#',  textAlign: 'right', render: (record: SolveStat, index: number) => stats.length - index },
    { accessor: 'name', title: 'Name', render: (record: SolveStat) => record.name },
    { accessor: 'recognitionTime', title: 'Rec', textAlign: 'right', render: (record: SolveStat) => Math.ceil(record.recognitionTime / 10) / 100 },
    { accessor: 'executionTime', title: 'Exec', textAlign: 'right', render: (record: SolveStat) => Math.ceil(record.executionTime / 10) / 100 },
    { accessor: 'AUFs', title: 'AUFs', textAlign: 'center', render: (record: SolveStat) => getMoveName("U", record.AUFs) },
    { accessor: 'Ys', title: 'Ys', textAlign: 'center', render: (record: SolveStat) => getMoveName("y", record.Ys) },
    { accessor: 'mirroredOverM', title: 'M', textAlign: 'center', render: (record: SolveStat) => record.mirroredOverM ? 'T' : 'F' },
    { accessor: 'mirroredOverS', title: 'S', textAlign: 'center', render: (record: SolveStat) => record.mirroredOverS ? 'T' : 'F' }
  ];

  return (
    <DataTable
      ff="monospace"
      fz="xs"
      withTableBorder
      withRowBorders={false}
      borderRadius="sm"
      verticalSpacing={0}
      horizontalSpacing="xs"
      highlightOnHover
      striped
      columns={columns}
      records={stats.toReversed().map((stat, index) => ({ ...stat, id: index }))}
      onRowDoubleClick={({ record, index }) => handleDelete(stats.length - 1 - index)}
    />
  );
};
