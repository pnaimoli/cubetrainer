import React from 'react';
import { Stack, Checkbox, Select, Box, Tooltip, Group, Center, Collapse, Text, Divider } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { FaInfoCircle } from 'react-icons/fa';
import { Settings, CUBE_ROTATIONS } from './interfaces';

const defaultSettings: Settings = {
  randomAUF: false,
  goInOrder: false,
  mirrorAcrossM: false,
  mirrorAcrossS: false,
  randomizeMirrorAcrossM: false,
  randomizeMirrorAcrossS: false,
  useMaskings: false,
  fullColourNeutrality: false,
  firstRotation: '',
  randomRotations1: '',
  randomRotations2: ''
};

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
      <Checkbox
        label={
          <Center>
            Use Maskings
            <Tooltip label="3D cube can optionally grey out unimportant stickers to your current case" withArrow>
              <Box><FaInfoCircle style={{ marginLeft: 5 }} /></Box>
            </Tooltip>
          </Center>
        }
        checked={settings.useMaskings}
        onChange={(event) => setSettings({ ...settings, useMaskings: event.currentTarget.checked })}
      />
      <Divider />
      <Group>
        <Text>Full Colour Neutrality</Text>
        <Checkbox
          checked={settings.fullColourNeutrality}
          onChange={(event) => setSettings({ ...settings, fullColourNeutrality: event.currentTarget.checked })}
        />
      </Group>
      <Collapse in={!settings.fullColourNeutrality}>
        <Stack gap="xs">
          <Center>
            <Text style={{ whiteSpace: 'nowrap', marginRight: '8px' }}>First Rotation</Text>
            <Select
              value={settings.firstRotation}
              onChange={(value) => setSettings({ ...settings, firstRotation: value })}
              data={CUBE_ROTATIONS.map((rotation) => ({ value: rotation, label: rotation }))}
            />
          </Center>
          <Center>
            <Text style={{ whiteSpace: 'nowrap', marginRight: '8px' }}>Random Rotations 1</Text>
            <Select
              value={settings.randomRotations1}
              onChange={(value) => setSettings({ ...settings, randomRotations1: value })}
              data={CUBE_ROTATIONS.map((rotation) => ({ value: rotation, label: rotation }))}
            />
          </Center>
          <Center>
            <Text style={{ whiteSpace: 'nowrap', marginRight: '8px' }}>Random Rotations 2</Text>
            <Select
              value={settings.randomRotations2}
              onChange={(value) => setSettings({ ...settings, randomRotations2: value })}
              data={CUBE_ROTATIONS.map((rotation) => ({ value: rotation, label: rotation }))}
            />
          </Center>
        </Stack>
      </Collapse>
    </Stack>
  );
};

export default SettingsAside;
