import React from 'react';
import { Button, Stack, Box, Text } from '@mantine/core';
import { TbPuzzle } from 'react-icons/tb';

interface MinigamesSectionProps {
  onFRFL: () => void;
  onOptimalCross: () => void;
  onFinalF2L: () => void;
}

const MinigamesSection: React.FC<MinigamesSectionProps> = ({ onFRFL, onOptimalCross, onFinalF2L }) => {
  return (
    <Box>
      <Button
        leftSection={<TbPuzzle />}
        fullWidth
        color="orange"
        variant="filled"
        style={{ borderRadius: '0px', cursor: 'default' }}
        component="div"
      >
        <Text fw={700}>Minigames</Text>
      </Button>
      <Stack gap={0}>
        <Button
          fullWidth
          variant="subtle"
          color="orange"
          size="xs"
          onClick={onFRFL}
          style={{ borderRadius: '0px' }}
        >
          FR+FL Slot Game
        </Button>
        <Button
          fullWidth
          variant="subtle"
          color="orange"
          size="xs"
          onClick={onOptimalCross}
          style={{ borderRadius: '0px' }}
        >
          Optimal Cross
        </Button>
        <Button
          fullWidth
          variant="subtle"
          color="orange"
          size="xs"
          onClick={onFinalF2L}
          style={{ borderRadius: '0px' }}
        >
          OLL Prediction
        </Button>
      </Stack>
    </Box>
  );
};

export default MinigamesSection;
