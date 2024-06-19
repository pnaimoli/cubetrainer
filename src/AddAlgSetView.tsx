import React, { useRef, useState } from "react";
import { Textarea, Button, TextInput, Group, Box, Text } from "@mantine/core";
import Papa from 'papaparse';

import { SolvedState, ValidMove, Alg, AlgSet, SOLVED_STATES } from './interfaces';

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
        transform: (value) => value.trim()
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
            throw new Error(`Invalid move found in algorithm: ${move}`);
          }
          return move as ValidMove;
        });

        const solvedLower = solved.trim().toLowerCase();
        if (!Object.values(SolvedState).includes(solvedLower as SolvedState)) {
          throw new Error(`Invalid solved state: ${solved}`);
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
          <Box style={{ paddingLeft: '20px', color: '#555', lineHeight: '1.6' }}>
            <Box style={{ marginBottom: '10px' }}>
              <Text><strong>1. List each algorithm on a separate line.</strong></Text>
            </Box>
            <Box style={{ marginBottom: '10px' }}>
              <Text><strong>2. Separate each move by at least one space.</strong></Text>
            </Box>
            <Box style={{ marginBottom: '10px' }}>
              <Text><strong>3. Start with the name of the algorithm, followed by a colon, and then the algorithm in quotations, like this:</strong></Text>
              <Box ml="md" my="xs">
                <Text style={{ fontFamily: 'monospace', color: '#e67e22' }}>T: "R U R' U' R' F R2 U' R' U' R U R' F'"</Text>
                <Text style={{ fontFamily: 'monospace', color: '#e67e22' }}>J: "R U R' F' R U R' U' R' F R2 U' R' U' R U R' F'"</Text>
              </Box>
            </Box>
            <Box style={{ marginBottom: '10px' }}>
              <Text><strong>4. Assign a unique name to each algorithm</strong> (times are saved for each name, so if you want unique times for every algorithm use unique names).</Text>
            </Box>
            <Box style={{ marginBottom: '10px' }}>
              <Text><strong>5. Only use the following moves</strong> (', 2, or 3 can be added to the end, but nothing 4 or above):</Text>
              <Box ml="md" my="xs">
                <Text style={{ fontFamily: 'monospace', color: '#3498db' }}>R L U D F B M S E r l u d f b</Text>
              </Box>
            </Box>
            <Box style={{ marginBottom: '10px' }}>
              <Text><strong>6. Use a maximum of 1000 algorithms.</strong></Text>
            </Box>
            <Box style={{ marginBottom: '10px' }}>
              <Text><strong>7. Most algorithms ranging from F2L, last layer, blindfolded, FMC and more are usable!</strong></Text>
            </Box>
          </Box>
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
        description="see instructions for formatting"
        placeholder={`T: "R U R' U' R' F R2 U' R' U' R U R' F'"`}
        minRows={15}
        maxRows={15}
        autosize
        style={{ marginBottom: '10px' }}
      />
      <Group position="right">
        <Button onClick={handleAddAlgSet} disabled={nameExists}>Add AlgSet</Button>
      </Group>
    </Box>
  );
};

export default AddAlgSetView;
