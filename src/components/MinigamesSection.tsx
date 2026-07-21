import React from 'react';
import { Button, Stack, Box, Text } from '@mantine/core';
import { TbPuzzle } from 'react-icons/tb';

interface MinigamesSectionProps {
  onFRFLSimul: () => void;
  onCross: () => void;
  onXCross: () => void;
  onOLLPrediction: () => void;
}

const MinigamesSection: React.FC<MinigamesSectionProps> = ({ onFRFLSimul, onCross, onXCross, onOLLPrediction }) => {
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
          onClick={onFRFLSimul}
          style={{ borderRadius: '0px' }}
        >
          FR+FL Slot Simul
        </Button>
        <Button
          fullWidth
          variant="subtle"
          color="orange"
          size="xs"
          onClick={onCross}
          style={{ borderRadius: '0px' }}
        >
          Cross
        </Button>
        <Button
          fullWidth
          variant="subtle"
          color="orange"
          size="xs"
          onClick={onXCross}
          style={{ borderRadius: '0px' }}
        >
          XCross
        </Button>
        <Button
          fullWidth
          variant="subtle"
          color="orange"
          size="xs"
          onClick={onOLLPrediction}
          style={{ borderRadius: '0px' }}
        >
          OLL Prediction
        </Button>
      </Stack>
    </Box>
  );
};

export default MinigamesSection;
