import React, { useState, useEffect } from 'react';
import { Card, Title, Menu, ActionIcon, Group, rem } from '@mantine/core';
import { DataTable, DataTableColumn } from 'mantine-datatable';
import { TbDots, TbTrash, TbInfoCircle, TbDownload } from 'react-icons/tb';
import { useLocalStorage } from '@mantine/hooks';
import { mkConfig, generateCsv, download } from 'export-to-csv';
import { SolveStat } from '../util/interfaces'; // Ensure this path is correct

interface TimesListViewProps {
  algSetName: string;
  algName?: string; // Optional, if not used, can be removed
}

const TimesListView: React.FC<TimesListViewProps> = ({ algSetName }) => {
  const [allStats, setAllStats] = useLocalStorage<Record<string, SolveStat[]>>({ key: 'stats', defaultValue: {} });
  const [stats, setStats] = useState<SolveStat[]>([]);

  useEffect(() => {
    setStats(allStats[algSetName] ?? []);
  }, [allStats, algSetName]);

  const getMoveName = (move: string, n: number) => {
    if (n === 0) return "";
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

  const handleExportData = () => {
    const formatTimestamp = (date: Date) => {
      const pad = (num: number) => (num < 10 ? '0' : '') + num;
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    };

    const timestamp = formatTimestamp(new Date());
    const filename = `${algSetName}-stats-${timestamp}`;

    const csvConfig = mkConfig({
      filename,
      useKeysAsHeaders: true,
      showColumnHeaders: true,
    });

    const simplifiedStats = stats.map(stat => ({
      ...stat,
      moves: stat.moves.length, // Convert moves array to its length
    }));

    const csv = generateCsv(csvConfig)(simplifiedStats);
    download(csvConfig)(csv);
  };

  const columns: DataTableColumn<SolveStat>[] = [
    { accessor: 'index', title: '#', textAlign: 'right', render: (_: SolveStat, index: number) => stats.length - index },
    { accessor: 'name', title: 'Name', render: (record: SolveStat) => record.name },
    { accessor: 'recognitionTime', title: 'Rec', textAlign: 'right', render: (record: SolveStat) => (Math.ceil(record.recognitionTime / 10) / 100).toFixed(2) },
    { accessor: 'executionTime', title: 'Exec', textAlign: 'right', render: (record: SolveStat) => (Math.ceil(record.executionTime / 10) / 100).toFixed(2) },
    { accessor: 'AUFs', title: 'AUFs', textAlign: 'center', render: (record: SolveStat) => getMoveName("U", record.AUFs) },
    { accessor: 'Ys', title: 'Ys', textAlign: 'center', render: (record: SolveStat) => getMoveName("y", record.Ys) },
    { accessor: 'mirroredOverM', title: 'M', textAlign: 'center', render: (record: SolveStat) => record.mirroredOverM ? '✓' : '' },
    { accessor: 'mirroredOverS', title: 'S', textAlign: 'center', render: (record: SolveStat) => record.mirroredOverS ? '✓' : '' }
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
                leftSection={<TbInfoCircle/>}
                disabled
              >
                Hint: double-click a row to remove that time
              </Menu.Item>
              <Menu.Item
                leftSection={<TbDownload style={{ width: rem(14), height: rem(14) }} />}
                onClick={handleExportData}
              >
                Export to CSV
              </Menu.Item>
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
        onRowDoubleClick={({ index }) => handleDelete(stats.length - 1 - index)}
        rowStyle={() => ({ cursor: 'not-allowed' })}
      />
    </Card>
  );
};

export default TimesListView;
