import React, { useState, useEffect } from 'react';
import { connectGanCube, GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { AlgSet, Alg, Settings } from './interfaces';

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn }) => {
  const [settings, setSettings] = useLocalStorage<Settings>({ key: 'settings' });
  const [currentAlg, setCurrentAlg] = useState<Alg | null>(null);

  useEffect(() => {
    if (currentAlgSet && currentAlgSet.algs.length > 0) {
      setCurrentAlg(currentAlgSet.algs[0]);
    }
  }, [currentAlgSet]);

  useEffect(() => {
    const player = document.querySelector('twisty-player');
    if (player && currentAlg) {
      (player as any).alg = currentAlg.alg.join(' ');
    }
  }, [currentAlg]);

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = (event: GanCubeEvent) => {
        if (event.type === "MOVE") {
          const player = document.querySelector('twisty-player');
          if (player) {
            (player as any).experimentalAddMove(event.move);
          }
        }
      };

      const sub = conn.events$.subscribe(handleCubeEvent);

      return () => {
        sub.unsubscribe();
      };
    }
  }, [conn]);

  return (
    <div>
      <h1>Algorithm Set: {currentAlgSet.name}</h1>
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
      {currentAlgSet && (
        <div>
          {currentAlg && (
            <div>
              <p>Current Algorithm: {currentAlg.name}</p>
              <p>{currentAlg.alg.join(' ')}</p>
            </div>
          )}
          <ul>
            {currentAlgSet.algs.map((alg) => (
              <li key={alg.name} onClick={() => setCurrentAlg(alg)}>
                {alg.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TrainerView;
