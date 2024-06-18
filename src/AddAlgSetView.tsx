import React, { useRef, useState } from "react";
import { Textarea, Button, TextInput, Group, Box, Text } from "@mantine/core";

interface AlgSet {
  name: string;
  algs: { name: string; alg: string }[];
}

interface AddAlgSetViewProps {
  algSets: AlgSet[];
  setAlgSets: React.Dispatch<React.SetStateAction<AlgSet[]>>;
}

const AddAlgSetView: React.FC<AddAlgSetViewProps> = ({ algSets, setAlgSets }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const folderNameRef = useRef<HTMLInputElement>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [nameExists, setNameExists] = useState<boolean>(false);

  const handleAddAlgSet = () => {
    const currentInput = textareaRef.current?.value || "";
    const newFolderName = folderNameRef.current?.value || "";
    if (algSets.some(set => set.name === newFolderName)) {
      setNameExists(true);
      return;
    }
    const algs = currentInput.split("\n").map(line => {
      const [name, alg] = line.split(": ");
      return { name, alg: alg?.replace(/"/g, "") || "" };
    });
    setAlgSets([...algSets, { name: newFolderName, algs }]);
    if (textareaRef.current) textareaRef.current.value = "";
    if (folderNameRef.current) folderNameRef.current.value = "";
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFolderName = e.target.value;
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
