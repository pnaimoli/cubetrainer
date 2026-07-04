import React, { useState, useEffect, useRef } from 'react';
import { AppShell, ScrollArea, Box, Group, Button, Text, Accordion, ActionIcon, Menu, Flex, Stack, Tooltip, Modal, Burger } from '@mantine/core';
import { useLocalStorage, useDisclosure } from '@mantine/hooks';
import { FaFolder, FaFolderOpen, FaStar, FaEllipsisH, FaPlus } from 'react-icons/fa';
import { MdBluetooth, MdBluetoothDisabled } from 'react-icons/md';
import { TbBattery1, TbBattery2, TbBattery3, TbBattery4, TbBatteryOff, TbBarbell, TbEdit, TbReport, TbTrash, TbChevronDown, TbCube, TbPlugConnectedX } from 'react-icons/tb';
import { connectGanCube, GanCubeConnection } from 'gan-web-bluetooth';
import { version } from '../../package.json';
import ReactLogo from '../assets/logo.svg?react';
import { AlgSet, Settings, Alg, SolveStat } from '../util/interfaces';
import TrainerView from "./TrainerView";
import AddAlgSetView from "./AddAlgSetView";
import { defaultSettings } from './SettingsView';
import WelcomeView from './WelcomeView';
import ReportsView from './ReportsView';
import MinigamesSection from './MinigamesSection';
import CrossTrainerView from './CrossTrainerView';
import XCrossTrainerView from './XCrossTrainerView';
import OLLPredictionView from './FinalF2LView';
import FRFLView from './FRFLView';


// One-time migration: assign ids to AlgSets and re-key stats.
// Runs synchronously before hooks read localStorage so every useLocalStorage
// instance across the component tree sees the migrated data on first render.
// TODO: Remove this migration after all users have been migrated.
(() => {
  try {
    const raw = localStorage.getItem('algSets');
    if (!raw) return;
    const sets: AlgSet[] = JSON.parse(raw);
    if (!sets.some(s => !s.id)) return;

    const rawStats = localStorage.getItem('stats');
    const stats: Record<string, SolveStat[]> = rawStats ? JSON.parse(rawStats) : {};

    const migrated = sets.map(set => {
      if (set.id) return set;
      const id = crypto.randomUUID();
      if (stats[set.name]) {
        stats[id] = stats[set.name];
        delete stats[set.name];
      }
      return { ...set, id };
    });

    localStorage.setItem('algSets', JSON.stringify(migrated));
    localStorage.setItem('stats', JSON.stringify(stats));
  } catch {
    // If localStorage is unavailable or data is corrupt, skip migration
  }
})();

const App: React.FC = () => {
  const [view, setView] = useState<string>('Welcome');
  const [algSets, setAlgSets] = useLocalStorage<AlgSet[]>({ key: 'algSets', defaultValue: [], getInitialValueInEffect: false });
  const [settings] = useLocalStorage<Settings>({ key: 'settings', defaultValue: defaultSettings, getInitialValueInEffect: false });
  const [currentAlgSet, setCurrentAlgSet] = useState<AlgSet | null>(null);
  const [initialAlg, setInitialAlg] = useState<Alg | null>(null);
  const [editingAlgSet, setEditingAlgSet] = useState<AlgSet | null>(null);
  const [expandedItem, setExpandedItem] = useState<string>("");
  const [conn, setConn] = useState<GanCubeConnection | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cubeName, setCubeName] = useState<string>('GAN Cube');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure();

  // Disconnect BLE on page reload so the cube doesn't get stuck in a
  // zombie GATT connection. The library's disconnect() is async so we
  // synchronously call device.gatt.disconnect() on the underlying
  // BluetoothDevice (a public property on GanCubeClassicConnection).
  const connRef = useRef(conn);
  useEffect(() => { connRef.current = conn; }, [conn]);
  useEffect(() => {
    const handleUnload = () => {
      try {
        const c = connRef.current as unknown as { device?: { gatt?: { connected: boolean; disconnect(): void } } };
        if (c?.device?.gatt?.connected) c.device.gatt.disconnect();
      } catch { /* best effort */ }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const cachedMacProvider = async (_device: BluetoothDevice, isFallback?: boolean): Promise<string | null> => {
    if (!isFallback) return null;
    const cached = localStorage.getItem('ganCubeMac');
    return cached || null;
  };

  const setupConnection = async (connection: GanCubeConnection) => {
    localStorage.setItem('ganCubeMac', connection.deviceMAC);
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
  };

  const handleBluetoothConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      const connection = await connectGanCube(cachedMacProvider);
      await setupConnection(connection);
      setLoading(false);
    } catch (error) {
      const e = error as Error;
      // If MAC retrieval failed, force-disconnect the stale GATT and retry once
      if (e.message?.includes('MAC address')) {
        try {
          localStorage.removeItem('ganCubeMac');
          const connection = await connectGanCube();
          await setupConnection(connection);
          setLoading(false);
          return;
        } catch (retryError) {
          const re = retryError as Error;
          setLoading(false);
          if (re.name !== 'NotFoundError') {
            setError(re.message);
          }
          return;
        }
      }
      setLoading(false);
      if (e.name !== 'NotFoundError') {
        setError(e.message);
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
    const setToDelete = algSets.find(set => set.name === name);
    setAlgSets(algSets.filter(set => set.name !== name));
    if (setToDelete && currentAlgSet?.id === setToDelete.id) {
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
          <Menu.Item leftSection={<TbBarbell size={14} />} onClick={() => {
            setInitialAlg(null);
            setCurrentAlgSet(set);
            setView('TrainerView');
            closeNav();
          }}>Train</Menu.Item>
          <Menu.Item leftSection={<TbEdit size={14} />} onClick={() => {
            setEditingAlgSet(set);
            setView('AddAlgSetView');
            closeNav();
          }}>Edit</Menu.Item>
          <Menu.Item leftSection={<TbReport size={14} />} onClick={() => {
            setCurrentAlgSet(set);
            setView('ReportsView');
            closeNav();
          }}>Reports</Menu.Item>
          <Menu.Item leftSection={<TbTrash size={14} />} color="red" onClick={() => setDeleteTarget(set.name)}>Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Flex>
  );

  const handleFRFL = () => {
    setView('FRFLView');
    closeNav();
  };

  const renderView = (): React.ReactNode => {
    switch (view) {
      case 'Welcome':
        return <WelcomeView />;
      case 'AddAlgSetView':
        return <AddAlgSetView key={editingAlgSet?.id ?? 'new'} editingAlgSet={editingAlgSet} onSave={(savedAlgSet) => {
          setEditingAlgSet(null);
          if (savedAlgSet) {
            setInitialAlg(null);
            setCurrentAlgSet(savedAlgSet);
            setView('TrainerView');
          } else {
            setView('Welcome');
          }
        }} />;
      case 'TrainerView':
        if (currentAlgSet)
          return <TrainerView key={currentAlgSet.id} currentAlgSet={currentAlgSet} conn={conn} settings={settings} initialAlg={initialAlg} disableAlgSelection={currentAlgSet.id.startsWith('minigame-')} />;
        else
          return <WelcomeView />;
      case 'ReportsView':
        if (currentAlgSet)
          return <ReportsView key={currentAlgSet.id} currentAlgSet={currentAlgSet} />;
        else
          return <WelcomeView />;
      case 'CrossTrainerView':
        return <CrossTrainerView conn={conn} settings={settings} />;
      case 'XCrossTrainerView':
        return <XCrossTrainerView conn={conn} settings={settings} />;
      case 'FRFLView':
        return <FRFLView conn={conn} settings={settings} />;
      case 'FinalF2LView':
        return <OLLPredictionView conn={conn} settings={settings} />;
      default:
        return <WelcomeView />;
    }
  };

  return (
    <AppShell
      header={{ height: 75 }}
      padding="md"
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
    >
      <AppShell.Header>
        <Flex justify="space-between" align="center">
          <Group h="100%" px="md">
            <Burger opened={navOpened} onClick={toggleNav} hiddenFrom="sm" size="sm" />
            <ReactLogo width="65px" height="100%" />
            <Stack align="center">
              {conn ? (
                <Group gap={0}>
                  <Button
                    leftSection={<MdBluetooth size="1.5rem" />}
                    rightSection={batteryLevel !== null ? <Tooltip label={`${batteryLevel}%`} withArrow><Box><BatteryIcon level={batteryLevel} /></Box></Tooltip> : undefined}
                    color="green"
                    style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                  >
                    {cubeName} Connected
                  </Button>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <Button color="green" px="xs" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }}>
                        <TbChevronDown size="1rem" />
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<TbCube size={14} />} onClick={() => conn.sendCubeCommand({ type: 'REQUEST_RESET' })}>
                        Reset Cube State
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item leftSection={<TbPlugConnectedX size={14} />} color="red" onClick={() => {
                        conn.disconnect();
                        setConn(null);
                        setCubeName('GAN Cube');
                        setBatteryLevel(null);
                      }}>
                        Disconnect
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              ) : (
                <Button
                  leftSection={<MdBluetoothDisabled size="1.5rem" />}
                  onClick={handleBluetoothConnect}
                  color="red"
                  loading={loading}
                >
                  Connect GAN Cube
                </Button>
              )}
              <Text color="red" size="xs" pos="absolute" top={0}>{error}</Text>
            </Stack>
          </Group>
          <Group mr="md" visibleFrom="sm">
            <Text>Cubetrainer v{version}</Text>
          </Group>
        </Flex>
      </AppShell.Header>
      <AppShell.Navbar>
        <ScrollArea scrollbars="y">
          <MinigamesSection
            onFRFL={handleFRFL}
            onOptimalCross={() => { setView('CrossTrainerView'); closeNav(); }}
            onXCross={() => { setView('XCrossTrainerView'); closeNav(); }}
            onFinalF2L={() => { setView('FinalF2LView'); closeNav(); }}
          />
          <Button
            leftSection={<FaPlus />}
            fullWidth
            onClick={() => { setEditingAlgSet(null); setView('AddAlgSetView'); closeNav(); }}
            style={{ borderRadius: '0px' }}
          >
            New Algorithm Set
          </Button>
          <Box>
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
                          closeNav();
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
