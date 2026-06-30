import { Group, Chip } from '@mantine/core';
import { CROSS_NAMES, FACE_COLORS } from '../util/crossRotation';

const FACES = ['D', 'U', 'F', 'B', 'R', 'L'] as const;

interface FaceColorPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function FaceColorPicker({ value, onChange }: FaceColorPickerProps) {
  return (
    <Chip.Group multiple value={value} onChange={(val: string[]) => {
      if (val.length > 0) onChange(val);
    }}>
      <Group gap="xs">
        {FACES.map(face => {
          const color = FACE_COLORS[face];
          const active = value.includes(face);
          return (
            <Chip
              key={face}
              value={face}
              size="xs"
              styles={{
                label: {
                  backgroundColor: active ? `${color}33` : `${color}15`,
                  borderColor: active ? color : `${color}44`,
                  color: face === 'D' ? (active ? '#fff' : '#888') : color,
                  opacity: active ? 1 : 0.5,
                  '&[dataChecked]': {
                    backgroundColor: `${color}33`,
                    borderColor: color,
                  },
                },
                iconWrapper: {
                  color: face === 'D' ? '#fff' : color,
                },
              }}
            >
              {CROSS_NAMES[face]}
            </Chip>
          );
        })}
      </Group>
    </Chip.Group>
  );
}
