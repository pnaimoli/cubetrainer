import React, { useState } from 'react';
import { AppShell, Group, Button, Text } from '@mantine/core';
import AlgSets from "./AlgSets";
import TrainerView from "./TrainerView";
import AlgSetsNavbar from "./AlgSetsNavbar"

const AboutView: React.FC = () => <Text>About View</Text>;

const App: React.FC = () => {
  const [view, setView] = useState('home');

  const renderView = () => {
    switch (view) {
      case 'About':
        return <AboutView />;
      case 'AddAlgSetView':
        return <AddAlgSetView />;
      case 'TrainerView':
        return <TrainerView />;
      default:
        return <AboutView />;
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
      navbar={{ width: "300", breakpoint: 'sm', }}
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Button variant="subtle" onClick={() => setView('About')}>About</Button>
          <Button variant="subtle" onClick={() => setView('TrainerView')}>Trainer</Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <AlgSetsNavbar/>
      </AppShell.Navbar>
      <AppShell.Main>
        {renderView()}
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
