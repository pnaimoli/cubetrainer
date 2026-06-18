import React, { useMemo, useState } from 'react';
import { Card, Title, Group, SegmentedControl, Checkbox, Text } from '@mantine/core';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { useLocalStorage } from '@mantine/hooks';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlgSet, SolveStat, ReportSettings, defaultReportSettings } from '../util/interfaces';

interface ReportsViewProps {
  currentAlgSet: AlgSet;
}

interface CaseReport {
  name: string;
  count: number;
  best: number;
  mean: number;
  stdDev: number;
}

const getTime = (stat: SolveStat, timeType: 'total' | 'rec' | 'exec'): number => {
  if (timeType === 'rec') return stat.recognitionTime;
  if (timeType === 'exec') return stat.executionTime;
  return stat.recognitionTime + stat.executionTime;
};

const computeMean = (times: number[]): number => {
  return times.reduce((a, b) => a + b, 0) / times.length;
};

const computeStdDev = (times: number[], mean: number): number => {
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
  return Math.sqrt(variance);
};

const formatTime = (ms: number | null): string => {
  if (ms === null) return '-';
  return (ms / 1000).toFixed(2);
};

const MOVING_AVERAGES = [
  { window: 12, label: 'ao12', color: '#228be6' },
  { window: 50, label: 'ao50', color: '#40c057' },
  { window: 100, label: 'ao100', color: '#fa5252' },
] as const;

const computeMovingAverages = (times: number[]) => {
  return times.map((_, i) => {
    const point: Record<string, number> = { solve: i + 1 };
    for (const { window, label } of MOVING_AVERAGES) {
      if (i + 1 >= window) {
        const slice = times.slice(i + 1 - window, i + 1);
        point[label] = slice.reduce((a, b) => a + b, 0) / window / 1000;
      }
    }
    return point;
  });
};

const ReportsView: React.FC<ReportsViewProps> = ({ currentAlgSet }) => {
  const [allStats] = useLocalStorage<Record<string, SolveStat[]>>({ key: 'stats', defaultValue: {} });
  const [reportSettings, setReportSettings] = useLocalStorage<ReportSettings>({
    key: 'reportSettings',
    defaultValue: defaultReportSettings,
  });
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<CaseReport>>({
    columnAccessor: 'name',
    direction: 'asc',
  });

  const [timelineTimeType, setTimelineTimeType] = useState<'total' | 'rec' | 'exec'>('total');
  const [timelineEliminateOutliers, setTimelineEliminateOutliers] = useState(true);

  const stats = allStats[currentAlgSet.id] ?? [];

  const reports = useMemo(() => {
    if (stats.length === 0) return [];

    // Group by case name
    const grouped: Record<string, SolveStat[]> = {};
    for (const stat of stats) {
      if (!grouped[stat.name]) grouped[stat.name] = [];
      grouped[stat.name].push(stat);
    }

    const results: CaseReport[] = [];

    for (const [name, caseStats] of Object.entries(grouped)) {
      let times = caseStats.map(s => getTime(s, reportSettings.timeType));

      // Outlier elimination: filter times outside mean +/- 2σ (skip if < 4 samples)
      if (reportSettings.eliminateOutliers && times.length >= 4) {
        const m = computeMean(times);
        const sd = computeStdDev(times, m);
        times = times.filter(t => Math.abs(t - m) <= 2 * sd);
      }

      if (times.length === 0) continue;

      const mean = computeMean(times);
      const stdDev = computeStdDev(times, mean);
      const best = Math.min(...times);

      results.push({ name, count: times.length, best, mean, stdDev });
    }

    return results;
  }, [stats, reportSettings]);

  const totals = useMemo(() => {
    if (reports.length === 0) return null;
    const count = reports.reduce((sum, r) => sum + r.count, 0);
    const best = Math.min(...reports.map(r => r.best));
    // Weighted mean across cases
    const mean = reports.reduce((sum, r) => sum + r.mean * r.count, 0) / count;
    // Pooled std dev across cases
    const pooledVariance = reports.reduce((sum, r) => sum + (r.stdDev ** 2 + (r.mean - mean) ** 2) * r.count, 0) / count;
    const stdDev = Math.sqrt(pooledVariance);
    return { count, best, mean, stdDev };
  }, [reports, stats, reportSettings]);

  const sortedReports = useMemo(() => {
    const sorted = [...reports].sort((a, b) => {
      const col = sortStatus.columnAccessor as keyof CaseReport;
      const va = a[col];
      const vb = b[col];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb);
      return (va as number) - (vb as number);
    });
    return sortStatus.direction === 'desc' ? sorted.reverse() : sorted;
  }, [reports, sortStatus]);

  const timelineData = useMemo(() => {
    if (stats.length === 0) return [];

    const sorted = [...stats].sort((a, b) =>
      new Date(a.timeOfSolve).getTime() - new Date(b.timeOfSolve).getTime()
    );

    let times = sorted.map(s => getTime(s, timelineTimeType));

    if (timelineEliminateOutliers && times.length >= 4) {
      const m = computeMean(times);
      const sd = computeStdDev(times, m);
      times = times.filter(t => Math.abs(t - m) <= 2 * sd);
    }

    return computeMovingAverages(times);
  }, [stats, timelineTimeType, timelineEliminateOutliers]);

  if (stats.length === 0) {
    return (
      <Card withBorder padding="xs">
        <Card.Section withBorder px="xs">
          <Title mt="xs" mb="xs">Average by Alg: {currentAlgSet.name}</Title>
        </Card.Section>
        <Text ta="center" c="dimmed" py="xl">No solves recorded yet.</Text>
      </Card>
    );
  }

  return (
    <Group align="flex-start" wrap="wrap">
      <Card withBorder padding={0} maw={400}>
        <Card.Section withBorder px="xs">
          <Title order={2}>Average by Alg: {currentAlgSet.name}</Title>
        </Card.Section>
        <Card.Section withBorder px="xs" py="xs">
          <Group gap="lg">
            <SegmentedControl
              size="xs"
              value={reportSettings.timeType}
              onChange={(value) => setReportSettings({ ...reportSettings, timeType: value as 'total' | 'rec' | 'exec' })}
              data={[
                { label: 'Total', value: 'total' },
                { label: 'Rec', value: 'rec' },
                { label: 'Exec', value: 'exec' },
              ]}
            />
            <Checkbox
              size="xs"
              label="Eliminate 2σ outliers"
              checked={reportSettings.eliminateOutliers}
              onChange={(event) => setReportSettings({ ...reportSettings, eliminateOutliers: event.currentTarget.checked })}
            />
          </Group>
        </Card.Section>
        <DataTable
          ff="monospace"
          fz="xs"
          withRowBorders={false}
          verticalSpacing={0}
          horizontalSpacing="xs"
          records={sortedReports}
          idAccessor="name"
          sortStatus={sortStatus}
          onSortStatusChange={setSortStatus}
          striped
          highlightOnHover
          defaultColumnProps={{
            textAlign: 'center',
            sortable: true,
          }}
          className="reports-table"
          columns={[
            { accessor: 'name', title: 'Case', textAlign: 'left', footer: 'Total' },
            { accessor: 'count', title: 'n', footer: totals ? String(totals.count) : '' },
            { accessor: 'best', title: 'Best', render: (row) => formatTime(row.best), footer: totals ? formatTime(totals.best) : '' },
            { accessor: 'mean', title: 'Mean', render: (row) => formatTime(row.mean), footer: totals ? formatTime(totals.mean) : '' },
            { accessor: 'stdDev', title: 'σ', render: (row) => formatTime(row.stdDev), footer: totals ? formatTime(totals.stdDev) : '' },
          ]}
        />
      </Card>
      <Card withBorder padding={0} style={{ flex: 1, minWidth: 400 }}>
        <Card.Section withBorder px="xs">
          <Title order={2}>Timeline</Title>
        </Card.Section>
        <Card.Section withBorder px="xs" py="xs">
          <Group gap="lg">
            <SegmentedControl
              size="xs"
              value={timelineTimeType}
              onChange={(value) => setTimelineTimeType(value as 'total' | 'rec' | 'exec')}
              data={[
                { label: 'Total', value: 'total' },
                { label: 'Rec', value: 'rec' },
                { label: 'Exec', value: 'exec' },
              ]}
            />
            <Checkbox
              size="xs"
              label="Eliminate 2σ outliers"
              checked={timelineEliminateOutliers}
              onChange={(event) => setTimelineEliminateOutliers(event.currentTarget.checked)}
            />
          </Group>
        </Card.Section>
        <Card.Section px="xs" py="xs">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timelineData}>
            <XAxis
              dataKey="solve"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
              label={{ value: 'Solve #', position: 'insideBottom', offset: -5 }}
            />
            <YAxis unit="s" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => v.toFixed(2)} />
            <Tooltip
              labelFormatter={(v) => `Solve #${v}`}
              formatter={(value) => [(value as number).toFixed(2) + 's']}
            />
            <Legend wrapperStyle={{ paddingTop: 20 }} />
            {MOVING_AVERAGES.map(({ label, color }) => (
              <Line
                key={label}
                dataKey={label}
                stroke={color}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        </Card.Section>
      </Card>
    </Group>
  );
};

export default ReportsView;
