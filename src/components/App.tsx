import React, { useState } from 'react';
import { AppShell, ScrollArea, Box, Group, Button, Text, Accordion, ActionIcon, Menu, Flex, Stack, Tooltip, Modal } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { FaFolder, FaFolderOpen, FaStar, FaEllipsisH, FaPlus, FaCog } from 'react-icons/fa';
import { MdBluetooth, MdBluetoothDisabled } from 'react-icons/md';
import { TbBattery1, TbBattery2, TbBattery3, TbBattery4, TbBatteryOff } from 'react-icons/tb';
import { connectGanCube, GanCubeConnection } from 'gan-web-bluetooth';
import { version } from '../../package.json';
import ReactLogo from '../assets/logo.svg?react';
import { AlgSet, Settings, Alg } from '../util/interfaces';
import TrainerView from "./TrainerView";
import AddAlgSetView from "./AddAlgSetView";
import SettingsView, { defaultSettings } from './SettingsView';
import WelcomeView from './WelcomeView';

const App: React.FC = () => {
  const [view, setView] = useState<string>('Welcome');
  const [algSets, setAlgSets] = useLocalStorage<AlgSet[]>({ key: 'algSets', defaultValue: [] });
  const [settings] = useLocalStorage<Settings>({ key: 'settings', defaultValue: defaultSettings });
  const [currentAlgSet, setCurrentAlgSet] = useState<AlgSet | null>(null);
  const [initialAlg, setInitialAlg] = useState<Alg | null>(null);
  const [editingAlgSet, setEditingAlgSet] = useState<AlgSet | null>(null);
  const [expandedItem, setExpandedItem] = useState<string>("");
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(true);
  const [conn, setConn] = useState<GanCubeConnection | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cubeName, setCubeName] = useState<string>('GAN Cube');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const handleBluetoothConnect = async () => {
    setError(null);
    setLoading(true);
    if (conn) {
      conn.disconnect();
      setConn(null);
      setCubeName('GAN Cube');
      setBatteryLevel(null);
      setLoading(false);
    } else {
      try {
        const connection = await connectGanCube();
        const sub = connection.events$.subscribe((event) => {
          if (event.type === 'HARDWARE' && event.hardwareName) {
            setCubeName(event.hardwareName);
          } else if (event.type === 'BATTERY') {
            setBatteryLevel(event.batteryLevel);
          } else if (event.type === 'DISCONNECT') {
            setConn(null);
            setCubeName('GAN Cube');
            setBatteryLevel(null);
            sub.unsubscribe();
          }
        });
        await connection.sendCubeCommand({ type: "REQUEST_FACELETS" });
        await connection.sendCubeCommand({ type: "REQUEST_HARDWARE" });
        setTimeout(() => connection.sendCubeCommand({ type: "REQUEST_BATTERY" }), 500);
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

  const BatteryIcon = ({ level }: { level: number }) => {
    const style = { display: 'block' };
    if (level > 75) return <TbBattery4 size="1.5rem" style={style} />;
    if (level > 50) return <TbBattery3 size="1.5rem" style={style} />;
    if (level > 25) return <TbBattery2 size="1.5rem" style={style} />;
    if (level > 0) return <TbBattery1 size="1.5rem" style={style} />;
    return <TbBatteryOff size="1.5rem" style={style} />;
  };

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDeleteAlgSet = (name: string): void => {
    setAlgSets(algSets.filter(set => set.name !== name));
    if (currentAlgSet?.name === name) {
      setCurrentAlgSet(null);
      setView('Welcome');
    }
    setDeleteTarget(null);
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
          <Menu.Item onClick={() => {
            setEditingAlgSet(set);
            setView('AddAlgSetView');
          }}>Edit</Menu.Item>
          <Menu.Item color="red" onClick={() => setDeleteTarget(set.name)}>Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Flex>
  );

  const renderView = (): React.ReactNode => {
    switch (view) {
      case 'Welcome':
        return <WelcomeView />;
      case 'AddAlgSetView':
        return <AddAlgSetView key={editingAlgSet?.name ?? 'new'} editingAlgSet={editingAlgSet} onSave={() => {
          if (editingAlgSet && currentAlgSet?.name === editingAlgSet.name) {
            setCurrentAlgSet(null);
          }
          setEditingAlgSet(null);
          setView('Welcome');
        }} />;
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
            <ReactLogo width="65px" height="100%"/>
            <Stack align="center">
              <Button
                leftSection={conn ? <MdBluetooth size="1.5rem" /> : <MdBluetoothDisabled size="1.5rem" />}
                rightSection={conn && batteryLevel !== null ? <Tooltip label={`${batteryLevel}%`} withArrow><Box><BatteryIcon level={batteryLevel} /></Box></Tooltip> : undefined}
                onClick={handleBluetoothConnect}
                color={conn ? 'green' : 'red'}
                loading={loading}
              >
                {conn ? `${cubeName} Connected` : 'Connect GAN Cube'}
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
            onClick={() => { setEditingAlgSet(null); setView('AddAlgSetView'); }}
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
      <Modal opened={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete Algorithm Set" centered>
        <Text mb="md">Are you sure you want to delete <b>{deleteTarget}</b>? This can't be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="red" onClick={() => deleteTarget && handleDeleteAlgSet(deleteTarget)}>Delete</Button>
        </Group>
      </Modal>
    </AppShell>
  );
};

export default App;
