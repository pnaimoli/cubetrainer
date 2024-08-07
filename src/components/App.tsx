import React, { useState } from 'react';
import { AppShell, ScrollArea, Box, Group, Button, Text, Accordion, ActionIcon, Menu, Flex, Stack } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { FaFolder, FaFolderOpen, FaStar, FaEllipsisH, FaPlus, FaCog } from 'react-icons/fa';
import { MdBluetooth, MdBluetoothDisabled } from 'react-icons/md';
import { connectGanCube, GanCubeConnection } from 'gan-web-bluetooth';
import { version } from '../../package.json';
import ReactLogo from '../assets/logo.svg?react';
import { AlgSet, Settings, Alg } from '../util/interfaces';
import TrainerView from "./TrainerView";
import AddAlgSetView from "./AddAlgSetView";
import SettingsView from './SettingsView';
import WelcomeView from './WelcomeView';

const App: React.FC = () => {
  const [view, setView] = useState<string>('Welcome');
  const [algSets, setAlgSets] = useLocalStorage<AlgSet[]>({ key: 'algSets', defaultValue: [] });
  const [settings] = useLocalStorage<Settings>({ key: 'settings' });
  const [currentAlgSet, setCurrentAlgSet] = useState<AlgSet | null>(null);
  const [initialAlg, setInitialAlg] = useState<Alg | null>(null);
  const [expandedItem, setExpandedItem] = useState<string>("");
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(true);
  const [conn, setConn] = useState<GanCubeConnection | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleBluetoothConnect = async () => {
    setError(null);
    setLoading(true);
    if (conn) {
      conn.disconnect();
      setConn(null);
      setLoading(false);
    } else {
      try {
        const connection = await connectGanCube();
        await connection.sendCubeCommand({ type: "REQUEST_FACELETS" });
        setConn(connection);
        setLoading(false);
      } catch (error) {
        setLoading(false);
        const e = error as Error;
        if (e.name !== 'NotFoundError') {
          setError(e.message);
        }
      }
    }
  };

  const handleDeleteAlgSet = (name: string): void => {
    setAlgSets(algSets.filter(set => set.name !== name));
  };

  interface AccordionControlProps {
    set: AlgSet;
    expanded: boolean;
  }

  const AccordionControl: React.FC<AccordionControlProps> = ({ set, expanded }) => (
    <Flex align="center">
      <Accordion.Control>
        {expanded ? <FaFolderOpen style={{ marginRight: 8 }} /> : <FaFolder style={{ marginRight: 8 }} />}
        {set.name}
      </Accordion.Control>
      <Menu>
        <Menu.Target>
          <ActionIcon size="lg" variant="subtle" color="gray" mr="7px">
            <FaEllipsisH size="1rem" />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => {
            setInitialAlg(null);
            setCurrentAlgSet(set);
            setView('TrainerView');
          }}>Train</Menu.Item>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item onClick={() => handleDeleteAlgSet(set.name)}>Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Flex>
  );

  const renderView = (): React.ReactNode => {
    switch (view) {
      case 'Welcome':
        return <WelcomeView />;
      case 'AddAlgSetView':
        return <AddAlgSetView />;
      case 'TrainerView':
        if (currentAlgSet)
          return <TrainerView key={currentAlgSet.name} currentAlgSet={currentAlgSet} conn={conn} settings={settings} initialAlg={initialAlg} />;
        else
          return <WelcomeView />;
      default:
        return <WelcomeView />;
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
        <Flex justify="space-between" align="center">
          <Group h="100%" px="md">
            <ReactLogo width="65px" height="100%" style={{ paddingTop: '10px' }}/>
            <Stack align="center">
              <Button
                leftSection={conn ? <MdBluetooth size="1.5rem" /> : <MdBluetoothDisabled size="1.5rem" />}
                onClick={handleBluetoothConnect}
                color={conn ? '' : 'red'}
                loading={loading}
              >
                {conn ? 'Disconnect Gan 12 Cube' : 'Connect Gan 12 Cube'}
              </Button>
              <Text color="red" size="xs" pos="absolute" top={0}>{error}</Text>
            </Stack>
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
        <ScrollArea scrollbars="y">
          <Button
            leftSection={<FaPlus />}
            fullWidth
            onClick={() => setView('AddAlgSetView')}
            style={{ borderRadius: '0px' }}
          >
            New Algorithm Set
          </Button>
          <Box w={300}>
            <Accordion
              value={expandedItem}
              chevronSize="0px"
              onChange={(value) => setExpandedItem(value || '')}
              styles={{ content: { padding: '0px' } }}
            >
              {algSets.sort((a, b) => a.name.localeCompare(b.name)).map((set) => (
                <Accordion.Item key={set.name} value={set.name}>
                  <AccordionControl set={set} expanded={expandedItem === set.name} />
                  <Accordion.Panel>
                    {set.algs.map((alg, index) => (
                      <Group
                        gap="xs"
                        wrap="nowrap"
                        ff="monospace"
                        bg={index % 2 === 0 ? "var(--mantine-color-dark-6)" : undefined}
                        key={`${set.name}-${alg.name}`}
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                        onDoubleClick={() => {
                          setCurrentAlgSet(set);
                          setInitialAlg(alg);
                          setView('TrainerView');
                        }}
                      >
                        <Text span size="xs" fw={700} ml="xs"><FaStar style={{ marginRight: "8px", width: '10px', height: '10px'}} />{alg.name}:</Text>
                        <Text span size="xs" w="100%" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{alg.alg.join(' ')}</Text>
                        <Text span size="xs" mr="xs">({alg.solved})</Text>
                      </Group>
                    ))}
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Box>
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Aside p="md">
        <SettingsView />
      </AppShell.Aside>
      <AppShell.Main>
        {renderView()}
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
