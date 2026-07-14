import { Group, Chip } from '@mantine/core';
import { FACE_COLORS } from '../util/crossRotation';

const FACES = ['D', 'U', 'F', 'B', 'R', 'L'] as const;
const SHORT_NAMES: Record<string, string> = {
  D: 'W', U: 'Y', F: 'G', B: 'B', R: 'R', L: 'O'
};

interface FaceColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FaceColorPicker({ value, onChange }: FaceColorPickerProps) {
  return (
    <Chip.Group value={value} onChange={(val: string | string[]) => {
      const v = Array.isArray(val) ? val[0] : val;
      if (v) onChange(v);
    }}>
      <Group gap={4}>
        {FACES.map(face => {
          const color = FACE_COLORS[face];
          const active = value === face;
          return (
            <Chip
              key={face}
              value={face}
              size="xs"
              styles={{
                label: {
                  backgroundColor: active ? `${color}44` : 'transparent',
                  borderColor: active ? color : 'var(--mantine-color-default-border)',
                  color: active ? (face === 'D' ? '#fff' : color) : 'var(--mantine-color-dimmed)',
                  opacity: active ? 1 : 0.3,
                  paddingLeft: 6,
                  paddingRight: 6,
                  minWidth: 0,
                  '&[dataChecked]': {
                    backgroundColor: `${color}44`,
                    borderColor: color,
                  },
                },
                iconWrapper: {
                  display: 'none',
                },
              }}
            >
              {SHORT_NAMES[face]}
            </Chip>
          );
        })}
      </Group>
    </Chip.Group>
  );
}
