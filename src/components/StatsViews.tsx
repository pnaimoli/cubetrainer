import React, { useState, useEffect } from 'react';
import { Card, Center, Title, Table, ScrollArea } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';

interface StatsViewProps {
  algSetName: string;
  algName: string;
}

export const SummaryStatsView: React.FC<StatsViewProps> = ({ algSetName }) => {
  const [allStats, setAllStats] = useLocalStorage<Record<string, SolveStat[]>>({ key: 'stats' , defaultValue: {} });
  const [stats, setStats] = useState<SolveStat[]>([]);

  useEffect(() => {
    setStats(algSetName in allStats ? allStats[algSetName] : []);
  }, [allStats, algSetName]);

  // useEffect(() => {
  // }, [stats])

  const getBest = () => {
    return Math.round(Math.min(...stats.map((stat) => stat.executionTime)) / 10 ) / 100;
  };

  const getAo = (n: number) => {
    if (stats.length < n) return '-';
    const times = stats.slice(-n - 1, -1).map((stat) => stat.executionTime);
    return Math.round(times.reduce((a, b) => a + b, 0) / n / 10) / 100;
  };

  return (
    <Card withBorder={true}>
      <Card.Section withBorder={true}>
        <Center><Title order={2}>Summary Statistics</Title></Center>
      </Card.Section>
      <Table ta="center" ff="monospace">
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
  const [allStats, setAllStats] = useLocalStorage<Record<string, SolveStat[]>>({ key: 'stats' , defaultValue: {} });
  const [stats, setStats] = useState<SolveStat[]>([]);

  useEffect(() => {
    setStats(algSetName in allStats ? allStats[algSetName] : []);
  }, [allStats, algSetName]);

  // useEffect(() => {
  // }, [stats])

  const getMoveName = (move: string, n: number) => {
    if (n === 0)
      return "-";
    else if (n === 1)
      return move;
    else if (n === 2)
      return move + "2";
    else if (n === 3)
      return move + "'";
    else
      return "?";
  };

  return (
    <Card withBorder={true} h="200px" padding={0}>
        <ScrollArea scrollbars="y">
        <Table stickyHeader ta="center" ff="monospace" verticalSpacing={0} horizontalSpacing={0}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th ta="center">#</Table.Th>
              <Table.Th ta="center">name</Table.Th>
              <Table.Th ta="center">rec</Table.Th>
              <Table.Th ta="center">exec</Table.Th>
              <Table.Th ta="center">AUFs</Table.Th>
              <Table.Th ta="center">y's</Table.Th>
              <Table.Th ta="center">M</Table.Th>
              <Table.Th ta="center">S</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            { stats.toReversed().map((stat, index) => (
              <Table.Tr key={index}>
                <Table.Td>{stats.length - index}</Table.Td>
                <Table.Td>{stat.name}</Table.Td>
                <Table.Td>{Math.ceil(stat.recognitionTime / 10) / 100}</Table.Td>
                <Table.Td>{Math.ceil(stat.executionTime / 10) / 100}</Table.Td>
                <Table.Td>{getMoveName("U", stat.AUFs)}</Table.Td>
                <Table.Td>{getMoveName("y", stat.Ys)}</Table.Td>
                <Table.Td>{stat.mirroredOverM ? 'T' : 'F'}</Table.Td>
                <Table.Td>{stat.mirroredOverS ? 'T' : 'F'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
};
