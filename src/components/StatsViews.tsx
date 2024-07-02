import React, { useState, useEffect } from 'react';
import { Card, Center, Title, Table } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';

interface StatsViewProps {
  algSetName: string;
  algName: string;
}

export const StatsView: React.FC<StatsViewProps> = ({ algSetName }) => {
  const [stats, setStats] = useLocalStorage<SolveStat[]>({ key: 'stats' , defaultValue: {} });

  useEffect(() => {
    // Process stats to create pivot table data
  }, [stats]);

//            {Object.entries(pivotStats).map(([key, stat]: [string, any]) => (
//<td>{stat.ao5.reduce((a, b) => a + b, 0) / stat.ao5.length || '-'}</td>
  return (
    <Card withBorder={true}>
      <Card.Section withBorder={true}>
        <Center><Title order={2}>Summary Statistics</Title></Center>
      </Card.Section>
        <Table>
          <thead>
            <tr>
              <th>Count</th>
              <th>Best</th>
              <th>ao5</th>
              <th>ao12</th>
              <th>ao50</th>
              <th>ao100</th>
            </tr>
          </thead>
          <tbody>
              <tr key={algSetName}>
                <td>{algSetName in stats ? stats[algSetName].length : ' '}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
          </tbody>
        </Table>
    </Card>
  );
};
