import React, { useState } from 'react';
import { Button, Collapse, Stack, Box } from '@mantine/core';
import { TbPuzzle } from 'react-icons/tb';

interface MinigamesSectionProps {
  onFRFL: () => void;
  onOptimalCross: () => void;
  onFinalF2L: () => void;
}

const MinigamesSection: React.FC<MinigamesSectionProps> = ({ onFRFL, onOptimalCross, onFinalF2L }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box>
      <Button
        leftSection={<TbPuzzle />}
        fullWidth
        color="orange"
        variant={expanded ? 'filled' : 'light'}
        onClick={() => setExpanded(e => !e)}
        style={{ borderRadius: '0px' }}
      >
        Minigames
      </Button>
      <Collapse in={expanded}>
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
      </Collapse>
    </Box>
  );
};

export default MinigamesSection;
