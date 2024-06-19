import React, { useState, useEffect } from 'react';
import { AppShell, Group, Button, Text, Accordion, ActionIcon, Center, Menu } from '@mantine/core';
import { FaFolder, FaFolderOpen, FaStar, FaEllipsisH, FaPlus } from 'react-icons/fa';

import { AlgSet } from './interfaces';
import TrainerView from "./TrainerView";
import AddAlgSetView from "./AddAlgSetView"; // Assuming you have this component

const AboutView = () => <Text>About View</Text>;

const App = () => {
  const [view, setView] = useState('About');
  const [algSets, setAlgSets] = useState(() => {
    const savedAlgSets = localStorage.getItem("algSets");
    return savedAlgSets ? JSON.parse(savedAlgSets) : [];
  });
  const [currentAlgSet, setCurrentAlgSet] = useState<AlgSet | null>(null);


  // For the Navbar
  const [expandedItem, setExpandedItem] = useState("");

  useEffect(() => {
    localStorage.setItem("algSets", JSON.stringify(algSets));
  }, [algSets]);

  const handleDeleteAlgSet = (name) => {
    setAlgSets(algSets.filter(set => set.name !== name));
  };

  const AccordionControl = ({ set, expanded }) => (
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
          <Menu.Item onClick={() => {
            setCurrentAlgSet(set);
            setView('TrainerView');
          }}>Train</Menu.Item>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item onClick={() => handleDeleteAlgSet(set.name)}>Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Center>
  );

  const renderView = () => {
    switch (view) {
      case 'About':
        return <AboutView />;
      case 'AddAlgSetView':
        return <AddAlgSetView algSets={algSets} setAlgSets={setAlgSets} />;
      case 'TrainerView':
        return <TrainerView currentAlgSet={currentAlgSet} />;
      default:
        return <AboutView />;
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
      navbar={{ width: 300, breakpoint: 'sm' }}
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Button variant="subtle" onClick={() => setView('About')}>About</Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <div style={{ width: "300px" }}>
          <Button
            leftSection={<FaPlus />}
            fullWidth
            onClick={() => setView('AddAlgSetView')}
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
                        {alg.name}: {alg.alg} ({alg.solved})
                      </Text>
                    ))}
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      </AppShell.Navbar>
      <AppShell.Main>
        {renderView()}
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
