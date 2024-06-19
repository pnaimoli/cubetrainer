import React, { useRef, useState } from "react";
import { Textarea, Button, TextInput, Group, Box, Text, List } from "@mantine/core";
import Papa from 'papaparse';

import { SolvedState, ValidMove, Alg, AlgSet, SOLVED_STATES } from './interfaces';
import { ALG_PRESETS } from './algPresets';

interface AddAlgSetViewProps {
  algSets: AlgSet[];
  setAlgSets: React.Dispatch<React.SetStateAction<AlgSet[]>>;
}

const AddAlgSetView: React.FC<AddAlgSetViewProps> = ({ algSets, setAlgSets }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const folderNameRef = useRef<HTMLInputElement>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [nameExists, setNameExists] = useState<boolean>(false);

  const handleAddAlgSet = (): void => {
    const currentInput: string = textareaRef.current?.value.trim() || "";
    const newFolderName: string = folderNameRef.current?.value.trim() || "";

    if (algSets.some((set: AlgSet) => set.name === newFolderName)) {
      setNameExists(true);
      return;
    }

    let parsedData: string[][] = [];

    try {
      parsedData = Papa.parse(currentInput.trim(), {
        delimiter: ",",
        skipEmptyLines: true,
        transform: (value) => value.trim().replace(/[()]/g, '')
      }).data as string[][];
    } catch (error) {
      console.error("Error parsing CSV:", error);
      return;
    }

    const algs: Alg[] = [];

    try {
      parsedData.forEach((line) => {
        if (line.length < 2) {
          throw new Error(`Invalid line format: ${line}`);
        }
        const [name, alg, solved = 'full'] = line;
        const algMoves = alg.split(/\s+/).map(move => {
          if (!Object.values(ValidMove).includes(move as ValidMove)) {
            throw new Error(`Invalid move found in algorithm: ${move}, line: ${line}`);
          }
          return move as ValidMove;
        });

        const solvedLower = solved.trim().toLowerCase();
        if (!Object.values(SolvedState).includes(solvedLower as SolvedState)) {
          throw new Error(`Invalid solved state: ${solved}, line: ${line}`);
        }

        algs.push({ name: name.trim(), alg: algMoves, solved: solvedLower as SolvedState });
      });
    } catch (error) {
      console.error("Error converting to Alg:", error);
      return;
    }

    setAlgSets([...algSets, { name: newFolderName, algs }]);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newFolderName = e.target.value.trim();
    setNameExists(algSets.some(set => set.name === newFolderName));
  };

  const insertPreset = (preset: string) => {
    if (textareaRef.current) {
      textareaRef.current.value = preset.trim();
    }
  };

  const uniqueValidMoves = Array.from(new Set(Object.values(ValidMove).map(move => move.charAt(0))));

  return (
    <Box>
      <Button
        onClick={() => setShowInstructions(!showInstructions)}
        variant="subtle"
        style={{ marginBottom: '10px' }}
      >
        {showInstructions ? "Hide Instructions" : "Show Instructions"}
      </Button>
      {showInstructions && (
        <Box my="sm" style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <Text weight={700} mb="xs" style={{ fontSize: '20px' }}>Algorithm Input Format</Text>
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
              <Text><strong>Only use the following moves</strong> (', 2, or 3 can be added to the end, but nothing 4 or above):</Text>
              <Box ml="md" my="xs">
                <Text style={{ fontFamily: 'monospace', color: '#3498db' }}>{uniqueValidMoves.join(' ')}</Text>
              </Box>
            </List.Item>
            <List.Item>
              <Text><strong>Most algorithms ranging from F2L, last layer, blindfolded, FMC and more are usable!</strong></Text>
            </List.Item>
          </List>
        </Box>
      )}
      <TextInput
        mb="md"
        label="Algorithm Set Name"
        description="max 30 character(s)"
        ref={folderNameRef}
        placeholder="Set Name"
        maxLength={30}
        onChange={handleNameChange}
        style={{ maxWidth: '300px' }}
        error={nameExists ? "An algorithm set of this name already exists" : undefined}
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
                onClick={() => insertPreset(ALG_PRESETS[preset])}
              >
                {preset}
              </Button>
            ))}
            </>
        }
        placeholder={`T: "R U R' U' R' F R2 U' R' U' R U R' F'"`}
        minRows={15}
        maxRows={15}
        autosize
        styles={{ input: { fontFamily: 'monospace' } }}
        style={{ marginBottom: '10px' }}
      />
      <Group position="right">
        <Button onClick={handleAddAlgSet} disabled={nameExists}>Add AlgSet</Button>
      </Group>
    </Box>
  );
};

export default AddAlgSetView;
