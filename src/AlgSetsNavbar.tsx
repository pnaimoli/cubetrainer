import React, { useState, useEffect, useRef } from "react";
import { Textarea, Button, TextInput, Group, Accordion, ActionIcon, Center, Text, Menu, Box } from "@mantine/core";
import { FaFolder, FaFolderOpen, FaStar, FaEllipsisH, FaPlus, FaInfoCircle } from 'react-icons/fa';

interface AlgSet {
  name: string;
  algs: { name: string; alg: string }[];
}

interface AlgSetsNavbarProps {
  setView: (view: string) => void;
  algSets: AlgSet[];
  setAlgSets: React.Dispatch<React.SetStateAction<AlgSet[]>>;
}

const AlgSetsNavbar: React.FC<AlgSetsNavbarProps> = ({ setView, algSets, setAlgSets }) => {
  const [expandedItem, setExpandedItem] = useState<string>("");

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
        <Button
          leftSection={<FaPlus />}
          fullWidth onClick={() => setView('AddAlgSetView')}
          radius="0px"
          style={{ borderRadius: '0px', marginBottom: '10px' }}
        >
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
    </div>
  );
};

export default AlgSetsNavbar;
