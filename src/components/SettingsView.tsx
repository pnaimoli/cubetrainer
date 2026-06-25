import React from 'react';
import { Stack, Checkbox, Select, Tooltip, Group, Collapse, ActionIcon, Text, Divider, Box, NumberInput } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { TbListNumbers, TbArrowsShuffle, TbArrowsRandom, TbRepeat, TbRepeatOff, TbRepeatOnce } from 'react-icons/tb';
import { Settings, CUBE_ROTATIONS, cycleSetting } from '../util/interfaces';

export const defaultSettings: Settings = {
  randomPreAUF: false,
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
  randomRotations1: '',
  postSolveDelay: 1
};

const SettingsView: React.FC = () => {
  const [settings, setSettings] = useLocalStorage<Settings>({ key: 'settings', defaultValue: defaultSettings });

  return (
    <Stack>
      <Divider label="Alg Selection" />
      <Group>
        <Group gap="xs" onClick={() => setSettings(cycleSetting(settings, "playlistMode"))} style={{ cursor: 'pointer' }}>
          <Text fz="sm">Order:</Text>
          <Tooltip withArrow label={
            settings.playlistMode === 'ordered' ? 'Ordered - play algs in sequence' :
            settings.playlistMode === 'shuffle' ? 'Shuffle - cycle through all algs in random order before repeating' :
            'Random - pick a random alg each time'
          }>
            <ActionIcon variant="subtle">
              {settings.playlistMode === 'ordered' && <TbListNumbers style={{ color: 'gray' }} />}
              {settings.playlistMode === 'shuffle' && <TbArrowsShuffle style={{ color: 'green' }} />}
              {settings.playlistMode === 'random' && <TbArrowsRandom style={{ color: 'green' }} />}
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group
          gap="xs"
          onClick={() => settings.playlistMode !== 'random' && setSettings(cycleSetting(settings, "loopMode"))}
          style={{ cursor: settings.playlistMode === 'random' ? 'not-allowed' : 'pointer', opacity: settings.playlistMode === 'random' ? 0.4 : 1 }}
        >
          <Text fz="sm">Loop:</Text>
          <Tooltip withArrow label={
            settings.playlistMode === 'random' ? 'Loop has no effect in random mode - only Repeat Once is meaningful' :
            settings.loopMode === 'no loop' ? 'No Loop - stop after the last alg' :
            settings.loopMode === 'loop' ? 'Loop - restart from the beginning after finishing' :
            'Repeat Once - keep repeating the current alg'
          }>
            <ActionIcon variant="subtle" disabled={settings.playlistMode === 'random'}>
              {settings.loopMode === 'no loop' && <TbRepeatOff style={{ color: 'gray' }} />}
              {settings.loopMode === 'loop' && <TbRepeat style={{ color: 'green' }} />}
              {settings.loopMode === 'loop1' && <TbRepeatOnce style={{ color: 'green' }} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Group gap="xs" align="center">
        <Text fz="sm">Post-Solve Delay (s):</Text>
        <NumberInput
          value={settings.postSolveDelay}
          onChange={(value) => setSettings({ ...settings, postSolveDelay: typeof value === 'number' ? value : 0 })}
          min={0}
          max={10}
          step={0.1}
          decimalScale={1}
          hideControls
          maw="60px"
          size="xs"
        />
      </Group>
      <Divider label="Symmetries" />
      <Group>
        <Tooltip label="Add a random U move before the setup to misalign the F2L from the last layer" withArrow>
          <Box display="inline-flex">
            <Checkbox
              label="Random Pre-AUF"
              checked={settings.randomPreAUF}
              onChange={(event) => setSettings({ ...settings, randomPreAUF: event.currentTarget.checked })}
            />
          </Box>
        </Tooltip>
        <Tooltip label="Add a random U move after the setup that must be solved before executing the alg" withArrow>
          <Box display="inline-flex">
            <Checkbox
              label="Random AUF"
              checked={settings.randomAUF}
              onChange={(event) => setSettings({ ...settings, randomAUF: event.currentTarget.checked })}
            />
          </Box>
        </Tooltip>
      </Group>
      <Tooltip label="Add a random y rotation after the setup to change which side you're solving from" withArrow>
        <Box display="inline-flex">
          <Checkbox
            label="Random y's"
            checked={settings.randomYs}
            onChange={(event) => setSettings({ ...settings, randomYs: event.currentTarget.checked })}
          />
        </Box>
      </Tooltip>
      <Group>
        <Checkbox
          label="Mirror Across M"
          checked={settings.mirrorAcrossM}
          onChange={(event) => setSettings({ ...settings, mirrorAcrossM: event.currentTarget.checked })}
        />
        <Checkbox
          label="Randomize"
          checked={settings.randomizeMirrorAcrossM}
          disabled={!settings.mirrorAcrossM}
          onChange={(event) => setSettings({ ...settings, randomizeMirrorAcrossM: event.currentTarget.checked })}
        />
      </Group>
      <Group>
        <Checkbox
          label="Mirror Across S"
          checked={settings.mirrorAcrossS}
          onChange={(event) => setSettings({ ...settings, mirrorAcrossS: event.currentTarget.checked })}
        />
        <Checkbox
          label="Randomize"
          checked={settings.randomizeMirrorAcrossS}
          disabled={!settings.mirrorAcrossS}
          onChange={(event) => setSettings({ ...settings, randomizeMirrorAcrossS: event.currentTarget.checked })}
        />
      </Group>
      <Divider label="Display Settings"/>
      <Checkbox
        label="Show Hint Facelets"
        checked={settings.showHintFacelets}
        onChange={(event) => setSettings({ ...settings, showHintFacelets: event.currentTarget.checked })}
      />
      <Tooltip label="3D cube can optionally grey out unimportant stickers to your current case" withArrow>
        <Box display="inline-flex">
          <Checkbox
            label="Use Maskings"
            checked={settings.useMaskings}
            onChange={(event) => setSettings({ ...settings, useMaskings: event.currentTarget.checked })}
          />
        </Box>
      </Tooltip>
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
              onChange={(value) => setSettings({ ...settings, firstRotation: value || '' })}
              data={CUBE_ROTATIONS.map((rotation) => ({ value: rotation, label: rotation }))}
            />
            <Select
              label="Subsequent Rotation(s)"
              value={settings.randomRotations1}
              maw="175px"
              onChange={(value) => setSettings({ ...settings, randomRotations1: value || '' })}
              data={["x", "y", "z"]}
            />
        </Stack>
      </Collapse>
    </Stack>
  );
};

export default SettingsView;
