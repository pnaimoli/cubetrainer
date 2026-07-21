import React, { useMemo, useState } from 'react';
import { Card, Title, Group, SegmentedControl, Checkbox, Text, Button, Select } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import { TbArrowLeft } from 'react-icons/tb';

import type { OLLPredictionStat } from './OLLPredictionView';

interface OLLPredictionReportsViewProps {
  stats: OLLPredictionStat[];
  onBack: () => void;
}

interface CaseReport {
  name: string;
  count: number;
  firstTryPct: number;
  correctPct: number;
  best: number;
  meanOrMedian: number;
  stdDev: number;
}

const computeMean = (times: number[]): number => {
  return times.reduce((a, b) => a + b, 0) / times.length;
};

const computeMedian = (times: number[]): number => {
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

type TimeType = '% Correct' | 'Insp' | 'Exec';

const OLLPredictionReportsView: React.FC<OLLPredictionReportsViewProps> = ({ stats, onBack }) => {
  const [timeType, setTimeType] = useLocalStorage<TimeType>({ key: 'ollReportTimeType', defaultValue: '% Correct', getInitialValueInEffect: false });
  const [metric, setMetric] = useLocalStorage<'mean' | 'median'>({ key: 'ollReportMetric', defaultValue: 'mean', getInitialValueInEffect: false });
  const [eliminateOutliers, setEliminateOutliers] = useLocalStorage<boolean>({ key: 'ollReportEliminateOutliers', defaultValue: true, getInitialValueInEffect: false });
  const [timelineCase, setTimelineCase] = useState<string>('all');
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<CaseReport>>({
    columnAccessor: 'name',
    direction: 'asc',
  });

  const isTimedMode = timeType === 'Insp' || timeType === 'Exec';

  // All distinct OLL case names sorted
  const caseNames = useMemo(() => {
    const names = new Set(stats.map(s => `OLL-${s.ollCase}`));
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [stats]);

  const getTime = (stat: OLLPredictionStat): number => {
    return timeType === 'Insp' ? stat.inspectionMs : stat.executionMs;
  };

  const reports = useMemo(() => {
    if (stats.length === 0) return [];

    const grouped: Record<string, OLLPredictionStat[]> = {};
    for (const stat of stats) {
      const key = `OLL-${stat.ollCase}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(stat);
    }

    const results: CaseReport[] = [];

    for (const [name, caseStats] of Object.entries(grouped)) {
      if (isTimedMode) {
        // Only correct entries with real times
        let times = caseStats.filter(s => s.correct && s.executionMs > 0).map(s => getTime(s));

        if (eliminateOutliers && times.length >= 4) {
          const m = computeMean(times);
          const sd = computeStdDev(times, m);
          times = times.filter(t => Math.abs(t - m) <= 2 * sd);
        }

        if (times.length === 0) continue;

        const mean = computeMean(times);
        const stdDev = computeStdDev(times, mean);
        const best = Math.min(...times);
        const meanOrMedian = metric === 'mean' ? mean : computeMedian(times);

        results.push({ name, count: times.length, firstTryPct: 0, correctPct: 0, best, meanOrMedian, stdDev });
      } else {
        // % Correct mode
        const total = caseStats.length;
        const correct = caseStats.filter(s => s.correct).length;
        const firstTry = caseStats.filter(s => s.correct && s.attempts === 1).length;

        results.push({
          name,
          count: total,
          firstTryPct: total > 0 ? (firstTry / total) * 100 : 0,
          correctPct: total > 0 ? (correct / total) * 100 : 0,
          best: 0,
          meanOrMedian: 0,
          stdDev: 0,
        });
      }
    }

    return results;
  }, [stats, eliminateOutliers, metric, timeType, isTimedMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    if (reports.length === 0) return null;

    if (isTimedMode) {
      const count = reports.reduce((sum, r) => sum + r.count, 0);
      const best = Math.min(...reports.map(r => r.best));

      if (metric === 'median') {
        let allTimes = stats.filter(s => s.correct && s.executionMs > 0).map(s => getTime(s));
        if (eliminateOutliers && allTimes.length >= 4) {
          const m = computeMean(allTimes);
          const sd = computeStdDev(allTimes, m);
          allTimes = allTimes.filter(t => Math.abs(t - m) <= 2 * sd);
        }
        const median = computeMedian(allTimes);
        const mean = computeMean(allTimes);
        const stdDev = computeStdDev(allTimes, mean);
        return { count, best, meanOrMedian: median, stdDev, firstTryPct: 0, correctPct: 0 };
      }

      const mean = reports.reduce((sum, r) => sum + r.meanOrMedian * r.count, 0) / count;
      const pooledVariance = reports.reduce((sum, r) => sum + (r.stdDev ** 2 + (r.meanOrMedian - mean) ** 2) * r.count, 0) / count;
      const stdDev = Math.sqrt(pooledVariance);
      return { count, best, meanOrMedian: mean, stdDev, firstTryPct: 0, correctPct: 0 };
    } else {
      const totalCount = reports.reduce((sum, r) => sum + r.count, 0);
      const totalCorrect = stats.filter(s => s.correct).length;
      const totalFirstTry = stats.filter(s => s.correct && s.attempts === 1).length;
      return {
        count: totalCount,
        firstTryPct: totalCount > 0 ? (totalFirstTry / totalCount) * 100 : 0,
        correctPct: totalCount > 0 ? (totalCorrect / totalCount) * 100 : 0,
        best: 0,
        meanOrMedian: 0,
        stdDev: 0,
      };
    }
  }, [reports, stats, eliminateOutliers, metric, timeType, isTimedMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedReports = useMemo(() => {
    const sorted = [...reports].sort((a, b) => {
      const col = sortStatus.columnAccessor as keyof CaseReport;
      const va = a[col];
      const vb = b[col];
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, undefined, { numeric: true });
      return (va as number) - (vb as number);
    });
    return sortStatus.direction === 'desc' ? sorted.reverse() : sorted;
  }, [reports, sortStatus]);

  const timelineData = useMemo(() => {
    if (stats.length === 0) return [];

    const sorted = [...stats].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const filtered = timelineCase === 'all'
      ? sorted
      : sorted.filter(s => `OLL-${s.ollCase}` === timelineCase);

    if (isTimedMode) {
      // Only correct entries with real times
      let entries = filtered.filter(s => s.correct && s.executionMs > 0);
      let times = entries.map(s => getTime(s));

      if (eliminateOutliers && times.length >= 4) {
        const m = computeMean(times);
        const sd = computeStdDev(times, m);
        const mask = times.map(t => Math.abs(t - m) <= 2 * sd);
        times = times.filter((_, i) => mask[i]);
      }

      return times.map((_, i) => {
        const point: Record<string, number> = { solve: i + 1 };
        for (const { window, label } of MOVING_AVERAGES) {
          const size = Math.min(window, i + 1);
          const slice = times.slice(i + 1 - size, i + 1);
          const val = metric === 'mean'
            ? slice.reduce((a, b) => a + b, 0) / size
            : computeMedian(slice);
          point[label] = val / 1000;
        }
        return point;
      });
    } else {
      // % Correct mode: rolling % of first-try-correct
      return filtered.map((_, i) => {
        const point: Record<string, number> = { solve: i + 1 };
        for (const { window, label } of MOVING_AVERAGES) {
          const size = Math.min(window, i + 1);
          const slice = filtered.slice(i + 1 - size, i + 1);
          const correct = slice.filter(s => s.correct && s.attempts === 1).length;
          point[label] = (correct / size) * 100;
        }
        return point;
      });
    }
  }, [stats, timelineCase, metric, timeType, eliminateOutliers, isTimedMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (stats.length === 0) {
    return (
      <Card withBorder padding="xs">
        <Card.Section withBorder px="xs">
          <Group>
            <Button variant="subtle" size="xs" leftSection={<TbArrowLeft />} onClick={onBack}>Back</Button>
            <Title mt="xs" mb="xs">OLL Prediction Reports</Title>
          </Group>
        </Card.Section>
        <Text ta="center" c="dimmed" py="xl">No solves recorded yet.</Text>
      </Card>
    );
  }

  const tableColumns = isTimedMode
    ? [
        { accessor: 'name', title: 'Case', textAlign: 'left' as const, footer: 'Total', sortable: true },
        { accessor: 'count', title: 'n', footer: totals ? String(totals.count) : '', sortable: true },
        { accessor: 'best', title: 'Best', render: (row: CaseReport) => formatTime(row.best), footer: totals ? formatTime(totals.best) : '', sortable: true },
        { accessor: 'meanOrMedian', title: metric === 'mean' ? 'Mean' : 'Median', render: (row: CaseReport) => formatTime(row.meanOrMedian), footer: totals ? formatTime(totals.meanOrMedian) : '', sortable: true },
        { accessor: 'stdDev', title: '\u03c3', render: (row: CaseReport) => formatTime(row.stdDev), footer: totals ? formatTime(totals.stdDev) : '', sortable: true },
      ]
    : [
        { accessor: 'name', title: 'Case', textAlign: 'left' as const, footer: 'Total', sortable: true },
        { accessor: 'count', title: 'n', footer: totals ? String(totals.count) : '', sortable: true },
        { accessor: 'firstTryPct', title: '1st Try %', render: (row: CaseReport) => `${row.firstTryPct.toFixed(0)}%`, footer: totals ? `${totals.firstTryPct.toFixed(0)}%` : '', sortable: true },
        { accessor: 'correctPct', title: 'Correct %', render: (row: CaseReport) => `${row.correctPct.toFixed(0)}%`, footer: totals ? `${totals.correctPct.toFixed(0)}%` : '', sortable: true },
      ];

  return (
    <Group align="flex-start" wrap="wrap">
      <Card withBorder padding={0} maw={400}>
        <Card.Section withBorder px="xs">
          <Group>
            <Button variant="subtle" size="xs" leftSection={<TbArrowLeft />} onClick={onBack}>Back</Button>
            <Title order={2}>OLL Prediction Reports</Title>
          </Group>
        </Card.Section>
        <Card.Section withBorder px="xs" py="xs">
          <Group gap="lg">
            <SegmentedControl
              size="xs"
              value={timeType}
              onChange={(value) => setTimeType(value as TimeType)}
              data={['% Correct', 'Insp', 'Exec']}
            />
            {isTimedMode && (
              <>
                <SegmentedControl
                  size="xs"
                  value={metric}
                  onChange={(value) => setMetric(value as 'mean' | 'median')}
                  data={[
                    { label: 'Mean', value: 'mean' },
                    { label: 'Median', value: 'median' },
                  ]}
                />
                <Checkbox
                  size="xs"
                  label="Eliminate 2σ outliers"
                  checked={eliminateOutliers}
                  onChange={(event) => setEliminateOutliers(event.currentTarget.checked)}
                />
              </>
            )}
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
          columns={tableColumns}
        />
      </Card>
      <Card withBorder padding={0} style={{ flex: 1, minWidth: 400 }}>
        <Card.Section withBorder px="xs">
          <Title order={2}>Timeline</Title>
        </Card.Section>
        <Card.Section withBorder px="xs" py="xs">
          <Group gap="lg" align="center">
            <Text fz="xs" fw={500}>Case</Text>
            <Select
              size="xs"
              value={timelineCase}
              onChange={(value) => setTimelineCase(value || 'all')}
              data={[{ label: 'All', value: 'all' }, ...caseNames.map(n => ({ label: n, value: n }))]}
              maw={120}
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
              <YAxis
                unit={isTimedMode ? 's' : '%'}
                domain={isTimedMode ? ['dataMin', 'dataMax'] : [0, 100]}
                tickFormatter={(v: number) => isTimedMode ? v.toFixed(2) : `${v.toFixed(0)}`}
              />
              <Tooltip
                labelFormatter={(v) => `Solve #${v}`}
                formatter={(value) => [isTimedMode ? (value as number).toFixed(2) + 's' : (value as number).toFixed(1) + '%']}
              />
              <Legend
                wrapperStyle={{ paddingTop: 20, cursor: 'pointer' }}
                onClick={(e) => {
                  const key = e.dataKey as string;
                  setHiddenLines(prev => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  });
                }}
              />
              {timeType === 'Insp' && timelineData.length > 0 && (() => {
                const allValues = timelineData.flatMap(d =>
                  MOVING_AVERAGES.filter(({ label }) => !hiddenLines.has(label)).map(({ label }) => d[label] as number).filter(v => v != null)
                );
                const max = Math.max(...allValues);
                return max >= 15 ? (
                  <ReferenceLine y={15} stroke="gray" strokeDasharray="4 4" strokeWidth={1} label={{ value: '15s', position: 'right', fill: 'gray', fontSize: 12 }} />
                ) : null;
              })()}
              {MOVING_AVERAGES.map(({ label, color }) => (
                <Line
                  key={label}
                  dataKey={label}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  hide={hiddenLines.has(label)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card.Section>
      </Card>
    </Group>
  );
};

export default OLLPredictionReportsView;
