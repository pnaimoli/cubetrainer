import React from 'react';
import { Stack, Checkbox, Select, Tooltip, Group } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { FaInfoCircle } from 'react-icons/fa';
import { Settings } from './interfaces';

type CrossColor = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

const defaultSettings: Settings = {
  randomAUF: false,
  goInOrder: false,
  mirrorAcrossM: false,
  mirrorAcrossS: false,
  randomizeMirrorAcrossM: false,
  randomizeMirrorAcrossS: false,
  crossColor: 'B',
  useMaskings: false
};

const crossColors: CrossColor[] = ['U', 'D', 'L', 'R', 'F', 'B'];

const SettingsAside: React.FC = () => {
  const [settings, setSettings] = useLocalStorage<Settings>({ key: 'settings', defaultValue: defaultSettings });

  return (
    <Stack>
      <Checkbox
        label="Random AUF"
        checked={settings.randomAUF}
        onChange={(event) => setSettings({ ...settings, randomAUF: event.currentTarget.checked })}
      />
      <Checkbox
        label="Go in Order"
        checked={settings.goInOrder}
        onChange={(event) => setSettings({ ...settings, goInOrder: event.currentTarget.checked })}
      />
      <Group position="apart">
        <Checkbox
          label="Mirror Across M"
          checked={settings.mirrorAcrossM}
          onChange={(event) => setSettings({ ...settings, mirrorAcrossM: event.currentTarget.checked })}
        />
        <Checkbox
          label="Randomize"
          checked={settings.randomizeMirrorAcrossM}
          onChange={(event) => setSettings({ ...settings, randomizeMirrorAcrossM: event.currentTarget.checked })}
        />
      </Group>
      <Group position="apart">
        <Checkbox
          label="Mirror Across S"
          checked={settings.mirrorAcrossS}
          onChange={(event) => setSettings({ ...settings, mirrorAcrossS: event.currentTarget.checked })}
        />
        <Checkbox
          label="Randomize"
          checked={settings.randomizeMirrorAcrossS}
          onChange={(event) => setSettings({ ...settings, randomizeMirrorAcrossS: event.currentTarget.checked })}
        />
      </Group>
      <Select
        label="Cross Color"
        value={settings.crossColor}
        onChange={(value: CrossColor) => setSettings({ ...settings, crossColor: value })}
        data={crossColors.map((color) => ({ value: color, label: color }))}
      />
      <Checkbox
        label={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            Use Maskings
            <Tooltip label="3D cube can optionally grey out unimportant stickers to your current case" withArrow>
              <span><FaInfoCircle style={{ marginLeft: 5 }} /></span>
            </Tooltip>
          </div>
        }
        checked={settings.useMaskings}
        onChange={(event) => setSettings({ ...settings, useMaskings: event.currentTarget.checked })}
      />
    </Stack>
  );
};

export default SettingsAside;
