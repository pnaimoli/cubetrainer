import React, { useState } from 'react';
import { AppShell, Group, Button, Text, Accordion, ActionIcon, Center, Menu, Flex } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { FaFolder, FaFolderOpen, FaStar, FaEllipsisH, FaPlus, FaCog } from 'react-icons/fa';
import { version } from '../package.json';
import ReactLogo from './assets/logo.svg?react';
import { AlgSet } from './interfaces';
import TrainerView from "./TrainerView";
import AddAlgSetView from "./AddAlgSetView";
import SettingsAside from './SettingsAside';

const AboutView: React.FC = () => <Text>About View</Text>;

const App: React.FC = () => {
  const [view, setView] = useState<string>('About');
  const [algSets, setAlgSets] = useLocalStorage<AlgSet[]>({
    key: 'algSets',
    defaultValue: []
  });
  const [currentAlgSet, setCurrentAlgSet] = useState<AlgSet | null>(null);
  const [expandedItem, setExpandedItem] = useState<string>("");
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(true);

  const handleDeleteAlgSet = (name: string): void => {
    setAlgSets(algSets.filter(set => set.name !== name));
  };

  interface AccordionControlProps {
    set: AlgSet;
    expanded: boolean;
  }

  const AccordionControl: React.FC<AccordionControlProps> = ({ set, expanded }) => (
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

  const renderView = (): React.ReactNode => {
    switch (view) {
      case 'About':
        return <AboutView />;
      case 'AddAlgSetView':
        return <AddAlgSetView />;
      case 'TrainerView':
        return <TrainerView currentAlgSet={currentAlgSet} />;
      default:
        return <AboutView />;
    }
  };

  return (
    <AppShell
      header={{ height: 75 }}
      padding="md"
      navbar={{ width: 300, breakpoint: 'sm' }}
      aside={{ width: 300, collapsed: { mobile: !asideOpened, desktop: !asideOpened }, breakpoint: 'sm' }}
    >
      <AppShell.Header>
        <Flex justify="space-between" align="center" style={{ width: '100%' }}>
          <Group h="100%" px="md">
            <ReactLogo width="65px" height="100%" style={{ paddingTop: '10px' }}/>
            <Button variant="subtle" onClick={() => setView('About')}>About</Button>
          </Group>
          <Group mr="md">
            <Text>Cubetrainer v{version}</Text>
            <ActionIcon variant="subtle" onClick={toggleAside}>
              <FaCog size="1.5rem" />
            </ActionIcon>
          </Group>
        </Flex>
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
      <AppShell.Aside p="md">
        <SettingsAside />
      </AppShell.Aside>
      <AppShell.Main>
        {renderView()}
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
