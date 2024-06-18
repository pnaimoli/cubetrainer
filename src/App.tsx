import React, { useState, useEffect } from 'react';
import { AppShell, Group, Button, Text } from '@mantine/core';
import AlgSetsNavbar from "./AlgSetsNavbar";
import TrainerView from "./TrainerView";
import AddAlgSetView from "./AddAlgSetView"; // Assuming you have this component

const AboutView: React.FC = () => <Text>About View</Text>;

const App: React.FC = () => {
  const [view, setView] = useState('About');
  const [algSets, setAlgSets] = useState<AlgSet[]>(() => {
    const savedAlgSets = localStorage.getItem("algSets");
    return savedAlgSets ? JSON.parse(savedAlgSets) : [];
  });

  useEffect(() => {
    localStorage.setItem("algSets", JSON.stringify(algSets));
  }, [algSets]);

  const renderView = () => {
    switch (view) {
      case 'About':
        return <AboutView />;
      case 'AddAlgSetView':
        return <AddAlgSetView algSets={algSets} setAlgSets={setAlgSets} setView={setView} />;
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
      navbar={{ width: "300", breakpoint: 'sm' }}
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Button variant="subtle" onClick={() => setView('About')}>About</Button>
          <Button variant="subtle" onClick={() => setView('TrainerView')}>Trainer</Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <AlgSetsNavbar setView={setView} algSets={algSets} setAlgSets={setAlgSets} />
      </AppShell.Navbar>
      <AppShell.Main>
        {renderView()}
      </AppShell.Main>
    </AppShell>
  );
};

export default App;
