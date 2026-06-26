import React, { useRef } from "react";
import { Textarea, Button, TextInput, Group, Box, Text, List } from "@mantine/core";
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { useForm } from "@mantine/form";
import Papa from 'papaparse';
import { Alg, AlgSet, ValidMove, SolvedState, SOLVED_STATES } from '../util/interfaces';
import { ALG_PRESETS } from '../util/algPresets';

function solvedStateToString(solved: number): string {
  // Try exact named match first (e.g. F2L, OLL)
  const exact = Object.entries(SolvedState)
    .find(([key, val]) => typeof val === 'number' && val === solved && isNaN(Number(key)));
  if (exact) return exact[0];

  // Decompose into primitive (single-bit) flags
  const flags = Object.entries(SolvedState)
    .filter(([key, val]) => {
      if (typeof val !== 'number' || !isNaN(Number(key))) return false;
      const v = val as number;
      if (v === 0) return false;
      return (v & (v - 1)) === 0 && (solved & v) !== 0;
    })
    .map(([name]) => name);

  return flags.length > 0 ? flags.join('|') : 'FULL';
}

function algSetToCsv(algSet: AlgSet): string {
  return algSet.algs.map(alg => {
    return `${alg.name}, ${alg.alg.join(' ')}, ${solvedStateToString(alg.solved ?? SolvedState.FULL)}`;
  }).join('\n');
}

interface AddAlgSetViewProps {
  editingAlgSet?: AlgSet | null;
  onSave?: (savedAlgSet?: AlgSet) => void;
}

const AddAlgSetView: React.FC<AddAlgSetViewProps> = ({ editingAlgSet, onSave }) => {
  const [algSets, setAlgSets] = useLocalStorage<AlgSet[]>({ key: 'algSets', defaultValue: [] });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showInstructions, {toggle: toggleInstructions}] = useDisclosure(false);
  const isEditing = !!editingAlgSet;

  const form = useForm({
    initialValues: {
      setName: editingAlgSet?.name ?? '',
      algList: editingAlgSet ? algSetToCsv(editingAlgSet) : '',
    },
    validate: {
      setName: (value: string) => {
        if (value.trim().length === 0) {
          return 'Set Name is required';
        }
        if (value.length > 30) {
          return 'Name must be at most 30 characters';
        }
        if (algSets.some(set => set.name === value.trim() && (!isEditing || set.id !== editingAlgSet!.id))) {
          return 'An algorithm set of this name already exists';
        }
        return null;
      },
      algList: (value) => value.trim().length === 0 ? 'Algorithm list is required' : null,
    },
  });

  const handleAddAlgSet = (values: { setName: string, algList: string }) => {
    const { setName, algList } = values;

    let parsedData: string[][] = [];

    try {
      parsedData = Papa.parse(algList.trim(), {
        delimiter: ",",
        skipEmptyLines: true,
        transform: (value) => value.trim().replace(/[()]/g, '')
      }).data as string[][];
    } catch (error) {
      form.setErrors({ algList: "Error parsing CSV data." });
      return;
    }

    try {
      const algs: Alg[] = parsedData.map((line) => {
        if (line.length < 2) {
          throw new Error(`Invalid line format: ${line}`);
        }
        const [name, alg, solved = 'FULL'] = line;
        const algMoves = alg.split(/\s+/).map(move => {
          if (!Object.values(ValidMove).includes(move as ValidMove)) {
            throw new Error(`Invalid move found in algorithm: ${move}, line: ${line}`);
          }
          return move as ValidMove;
        });

        const solvedStates = solved.toUpperCase().split('|').reduce((acc, state) => {
          const solvedState = state.trim() as keyof typeof SolvedState;
          if (!(solvedState in SolvedState)) {
            throw new Error(`Invalid solved state: ${solvedState}, line: ${line}`);
          }
          return acc | SolvedState[solvedState];
        }, 0);

        return { name: name.trim(), alg: algMoves, solved: solvedStates as SolvedState };
      });

      let savedAlgSet: AlgSet;
      if (isEditing) {
        savedAlgSet = { ...editingAlgSet!, name: setName.trim(), algs };
        setAlgSets(algSets.map(set => set.id === editingAlgSet!.id ? savedAlgSet : set));
      } else {
        savedAlgSet = { id: crypto.randomUUID(), name: setName.trim(), algs };
        setAlgSets([...algSets, savedAlgSet]);
      }
      onSave?.(savedAlgSet);
      if (!isEditing) form.reset();
    } catch (error) {
      form.setErrors({ algList: (error as Error).message });
    }
  };

  const insertPreset = (name: string, preset: string) => {
    if (textareaRef.current) {
      textareaRef.current.value = preset.trim();
      form.setFieldValue('algList', preset.trim());
      if (!form.values.setName) {
        form.setFieldValue('setName', name);
      }
    }
  };

  const uniqueValidMoves = Array.from(new Set(Object.values(ValidMove).map(move => move.charAt(0))));

  return (
    <Box>
      <Button
        onClick={toggleInstructions}
        variant="subtle"
        style={{ marginBottom: '10px' }}
      >
        {showInstructions ? "Hide Instructions" : "Show Instructions"}
      </Button>
      {showInstructions && (
        <Box my="sm" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <Text fw={700} mb="xs" style={{ fontSize: '20px' }}>Algorithm Input Format</Text>
          <List spacing="sm" type="ordered" style={{ color: '#555', lineHeight: '1.6' }}>
            <List.Item>
              <Text><strong>List each algorithm on a separate line.</strong></Text>
            </List.Item>
            <List.Item>
              <Text><strong>Separate each move by at least one space.</strong></Text>
            </List.Item>
            <List.Item>
              <Text><strong>Start with a unique name for the algorithm, followed by a comma, and then the algorithm, like this:</strong></Text>
              <Box ml="md" my="xs">
                <Text style={{ fontFamily: 'monospace', color: '#e67e22' }}>H, &nbsp;M2 U M2 U2 M2 U M2</Text>
                <Text style={{ fontFamily: 'monospace', color: '#e67e22' }}>Ja, L' U' L F L' U' L U L F' L2 U L</Text>
              </Box>
            </List.Item>
            <List.Item>
              <Text><strong>Optionally, add a solved state as the third column, separated by a comma. The solved state can be a bitwise OR combination of the following states:</strong></Text>
              <Box ml="md" my="xs">
                <Text style={{ fontFamily: 'monospace', color: '#e67e22' }}>
                  {SOLVED_STATES.join(', ')}
                </Text>
                <Text style={{ fontFamily: 'monospace', color: '#e67e22' }}>
                  Example: Insert, R U R', CROSS | F2LFR
                </Text>
              </Box>
            </List.Item>
            <List.Item>
              <Text><strong>Only use the following moves</strong> (', 2, or 3 can be added to the end, but nothing 4 or above):</Text>
              <Box ml="md" my="xs">
                <Text style={{ fontFamily: 'monospace', color: '#3498db' }}>{uniqueValidMoves.join(', ')}</Text>
              </Box>
            </List.Item>
            <List.Item>
              <Text><strong>Most algorithms ranging from F2L, last layer, blindfolded, FMC and more are usable!</strong></Text>
            </List.Item>
          </List>
        </Box>
      )}
      <form onSubmit={form.onSubmit((values) => handleAddAlgSet(values))}>
        <TextInput
          mb="md"
          label="Algorithm Set Name"
          description="max 30 character(s)"
          placeholder="Set Name"
          {...form.getInputProps('setName')}
          style={{ maxWidth: '300px' }}
          error={form.errors.setName}
        />
        <Textarea
          ref={textareaRef}
          label="Algorithm List"
          description={
            <>
              Presets:
              {Object.keys(ALG_PRESETS).map(preset => (
                <Button
                  key={preset}
                  size="xs"
                  variant="outline"
                  style={{ marginLeft: '10px' }}
                  onClick={() => insertPreset(preset, ALG_PRESETS[preset])}
                >
                  {preset}
                </Button>
              ))}
            </>
          }
          placeholder={`T, R U R' U' R' F R2 U' R' U' R U R' F'`}
          minRows={15}
          maxRows={15}
          autosize
          styles={{ input: { fontFamily: 'monospace' } }}
          style={{ marginBottom: '10px' }}
          {...form.getInputProps('algList')}
          error={form.errors.algList}
        />
        <Group>
          <Button type="submit">{isEditing ? 'Save AlgSet' : 'Add AlgSet'}</Button>
        </Group>
      </form>
    </Box>
  );
};

export default AddAlgSetView;
