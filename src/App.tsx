import React, { useState, useEffect } from 'react';
import { AppShell, Group, Button, Text } from '@mantine/core';
import { MdBluetooth, MdBluetoothDisabled } from 'react-icons/md';
import { connectGanCube, GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import 'cubing/twisty';

const HomeView: React.FC = () => <Text>Home View</Text>;
const AboutView: React.FC = () => <Text>About View</Text>;

const RubiksTrainer: React.FC = () => {
  const [conn, setConn] = useState<GanCubeConnection | null>(null);
  const [scramble, setScramble] = useState("R U R' U'");

  useEffect(() => {
    const player = document.querySelector('twisty-player');
    if (player) {
      (player as any).experimentalSetupAlg = `z2 ${scramble}`;
    }
  }, [scramble]);

  const connectCube = async () => {
    if (conn) {
      conn.disconnect();
      setConn(null);
    } else {
      try {
        const connection = await connectGanCube();
        setConn(connection);
        connection.events$.subscribe(handleCubeEvent);
        await connection.sendCubeCommand({ type: "REQUEST_FACELETS" });
      } catch (error) {
        if (error.name !== 'NotFoundError') {
          console.error("Error connecting to the cube:", error);
        }
      }
    }
  };

  const handleCubeEvent = (event: GanCubeEvent) => {
    if (event.type === "MOVE") {
      const player = document.querySelector('twisty-player');
      if (player) {
        (player as any).experimentalAddMove(event.move);
      }
    }
  };

  return (
    <div>
      <h1>Rubik's Cube Trainer</h1>
      <div className="cube-container">
        <twisty-player
          class="cube"
          visualization="PG3D"
          control-panel="none"
          background="none"
          puzzle="3x3x3"
          tempo-scale="4"
          hint-facelets="none"
          style={{ width: "300px", height: "300px" }}
        />
      </div>
      <button onClick={connectCube}>
        {conn ? (
          <MdBluetoothDisabled className="icon" />
        ) : (
          <MdBluetooth className="icon" />
        )}
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState('home');

  const renderView = () => {
    switch (view) {
      case 'home':
        return <HomeView />;
      case 'about':
        return <AboutView />;
      case 'trainer':
        return <RubiksTrainer />;
      default:
        return <HomeView />;
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Button variant="subtle" onClick={() => setView('home')}>Home</Button>
          <Button variant="subtle" onClick={() => setView('about')}>About</Button>
          <Button variant="subtle" onClick={() => setView('trainer')}>Trainer</Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        {renderView()}
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
