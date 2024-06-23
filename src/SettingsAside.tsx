import React from 'react';
import { Stack, Checkbox, Select, Box, Tooltip, Group, Center, Collapse, ActionIcon, Text, Divider } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { FaInfoCircle } from 'react-icons/fa';
import { TbListNumbers, TbArrowsShuffle, TbArrowsRandom, TbRepeat, TbRepeatOff, TbRepeatOnce } from 'react-icons/tb';
import { Settings, CUBE_ROTATIONS, cycleSetting } from './interfaces';

const defaultSettings: Settings = {
  randomAUF: false,
  randomYs: false,
  playlistMode: 'ordered',
  loopMode: 'loop',
  mirrorAcrossM: false,
  mirrorAcrossS: false,
  randomizeMirrorAcrossM: false,
  randomizeMirrorAcrossS: false,
  showHintFacelets: false,
  useMaskings: false,
  fullColourNeutrality: false,
  firstRotation: '',
  randomRotations1: ''
};

const SettingsAside: React.FC = () => {
  const [settings, setSettings] = useLocalStorage<Settings>({ key: 'settings', defaultValue: defaultSettings });

  return (
    <Stack>
      <Divider label="Alg Selection" />
      <Group>
        <Group gap="xs" onClick={() => setSettings(cycleSetting(settings, "playlistMode"))} style={{ cursor: 'pointer' }}>
          <Text fz="sm">Order:</Text>
          <ActionIcon variant="subtle">
            {settings.playlistMode === 'ordered' && <TbListNumbers style={{ color: 'gray' }} />}
            {settings.playlistMode === 'shuffle' && <TbArrowsShuffle style={{ color: 'green' }} />}
            {settings.playlistMode === 'random' && <TbArrowsRandom style={{ color: 'green' }} />}
          </ActionIcon>
        </Group>
        <Group gap="xs" onClick={() => setSettings(cycleSetting(settings, "loopMode"))} style={{ cursor: 'pointer' }}>
          <Text fz="sm">Loop:</Text>
          <ActionIcon variant="subtle">
            {settings.loopMode === 'no loop' && <TbRepeatOff style={{ color: 'gray' }} />}
            {settings.loopMode === 'loop' && <TbRepeat style={{ color: 'green' }} />}
            {settings.loopMode === 'loop1' && <TbRepeatOnce style={{ color: 'green' }} />}
          </ActionIcon>
        </Group>
      </Group>
      <Divider label="Symmetries" />
      <Group position="apart">
        <Checkbox
          label="Random AUF"
          checked={settings.randomAUF}
          onChange={(event) => setSettings({ ...settings, randomAUF: event.currentTarget.checked })}
        />
        <Checkbox
          label={
            <Center>
              Random y's
              <Tooltip label="Do a random number of y rotation after the setup" withArrow>
                <Box><FaInfoCircle style={{ marginLeft: 5 }} /></Box>
              </Tooltip>
            </Center>
          }
          checked={settings.randomYs}
          onChange={(event) => setSettings({ ...settings, randomYs: event.currentTarget.checked })}
        />
      </Group>
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
      <Divider label="Display Settings"/>
      <Checkbox
        label="Show Hint Facelets"
        checked={settings.showHintFacelets}
        onChange={(event) => setSettings({ ...settings, showHintFacelets: event.currentTarget.checked })}
      />
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
      <Divider label="Preorientation"/>
      <Group>
        <Checkbox
          label="Full Colour Neutrality"
          checked={settings.fullColourNeutrality}
          onChange={(event) => setSettings({ ...settings, fullColourNeutrality: event.currentTarget.checked })}
        />
      </Group>
      <Collapse in={!settings.fullColourNeutrality}>
        <Stack gap="xs">
            <Select
              label="Initial Rotation"
              value={settings.firstRotation}
              maw="175px"
              onChange={(value) => setSettings({ ...settings, firstRotation: value })}
              data={CUBE_ROTATIONS.map((rotation) => ({ value: rotation, label: rotation }))}
            />
            <Select
              label="Subsequent Rotation(s)"
              value={settings.randomRotations1}
              maw="175px"
              onChange={(value) => setSettings({ ...settings, randomRotations1: value })}
              data={["x", "y", "z"]}
            />
        </Stack>
      </Collapse>
    </Stack>
  );
};

export default SettingsAside;
