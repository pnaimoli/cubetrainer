import React, { useState, useEffect, useRef } from "react";
import { Textarea, Button, Input, Group, Accordion, ActionIcon, Center, Text, Menu, Box } from "@mantine/core";
import { FaFolder, FaFolderOpen, FaStar, FaEllipsisH, FaPlus, FaInfoCircle } from 'react-icons/fa';

interface AlgSet {
  name: string;
  algs: { name: string; alg: string }[];
}

const AlgSets: React.FC = () => {
  const [algSets, setAlgSets] = useState<AlgSet[]>(() => {
    const savedAlgSets = localStorage.getItem("algSets");
    return savedAlgSets ? JSON.parse(savedAlgSets) : [];
  });
  const [expandedItem, setExpandedItem] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("algSets", JSON.stringify(algSets));
  }, [algSets]);

  const handleDeleteAlgSet = (name: string) => {
    setAlgSets(algSets.filter(set => set.name !== name));
  };

  function AccordionControl({ set, expanded }: { set: AlgSet, expanded: boolean }) {
    return (
      <Center style={{ justifyContent: 'space-between' }}>
        <Accordion.Control>
          {expanded ? <FaFolderOpen style={{ marginRight: 8 }} /> : <FaFolder style={{ marginRight: 8 }} />}
          {set.name}
        </Accordion.Control>
        <Menu>
          <Menu.Target>
            <ActionIcon size="lg" variant="subtle" color="gray">
              <FaEllipsisH size="1rem" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item>Edit</Menu.Item>
            <Menu.Item onClick={() => handleDeleteAlgSet(set.name)}>Delete</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Center>
    );
  }

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: "300px" }}>
        <Button leftSection={<FaPlus />} fullWidth onClick={() => setShowForm(true)} style={{ marginBottom: '10px' }}>
          New Algorithm Set
        </Button>
        <Accordion
          value={expandedItem}
          chevronSize="0px"
          onChange={setExpandedItem}
        >
          {algSets.sort((a, b) => a.name.localeCompare(b.name)).map((set) => (
            <Accordion.Item key={set.name} value={set.name}>
              <AccordionControl set={set} expanded={expandedItem === set.name} />
              <Accordion.Panel>
                <div>
                  {set.algs.map(alg => (
                    <Text key={`${set.name}-${alg.name}`} style={{ display: 'flex', alignItems: 'center' }}>
                      <FaStar style={{ marginRight: 8 }} />
                      {alg.name}: {alg.alg}
                    </Text>
                  ))}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </div>
      <div style={{ marginLeft: "20px", flex: 1 }}>
        {showForm && (
          <AddAlgSet algSets={algSets} setAlgSets={setAlgSets} setShowForm={setShowForm} />
        )}
      </div>
    </div>
  );
};

const AddAlgSet: React.FC<{ algSets: AlgSet[], setAlgSets: React.Dispatch<React.SetStateAction<AlgSet[]>>, setShowForm: React.Dispatch<React.SetStateAction<boolean>> }> = ({ algSets, setAlgSets, setShowForm }) => {
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
    setShowForm(false);
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
        <Box my="sm" style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <Text weight={500} mb="xs">Format</Text>
          <Text>List each algorithm on a different line.</Text>
          <Text>Separate each move by at least one space.</Text>
          <Text>First list the name of the algorithm, followed by a colon, and then the algorithm in quotations like below:</Text>
          <Text>T: "R U R' U' R' F R2 U' R' U' R U R' F'"</Text>
          <Text>J: "R U R' F' R U R' U' R' F R2 U' R' U' R U R' F'"</Text>
          <Text>Give each algorithm a unique name (times are saved for each name, so if you want unique times for every algorithm use unique names).</Text>
          <Text>Use only the following moves (', 2, or 3 can be added to the end, but nothing 4 or above):</Text>
          <Text>R L U D F B M S E r l u d f b</Text>
          <Text>Use a maximum of 1000 algorithms.</Text>
          <Text>Almost any algorithm ranging from F2L, last layer, blindfolded, FMC and more are usable!</Text>
        </Box>
      )}
      <Input
        ref={folderNameRef}
        placeholder="Set Name"
        maxLength={30}
        onChange={handleNameChange}
        style={{ marginBottom: '10px', maxWidth: '300px' }}
        error={nameExists ? "An algorithm set of this name already exists" : undefined}
      />
      <Textarea
        ref={textareaRef}
        placeholder={`T: "R U R' U' R' F R2 U' R' U' R U R' F'"`}
        minRows={15}
        maxRows={15}
        style={{ marginBottom: '10px' }}
      />
      <Group position="right">
        <Button onClick={handleAddAlgSet} disabled={nameExists}>Add AlgSet</Button>
      </Group>
    </Box>
  );
};

export default AlgSets;
