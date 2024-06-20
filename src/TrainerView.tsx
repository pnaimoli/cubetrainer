import React, { useState, useEffect } from 'react';
import { connectGanCube, GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import { useLocalStorage } from '@mantine/hooks';
import 'cubing/twisty';
import { Alg } from 'cubing/alg';
import { AlgSet, Alg as Algorithm, Settings } from './interfaces';
import { KPattern } from 'cubing/kpuzzle';

interface TrainerViewProps {
  currentAlgSet: AlgSet;
  conn: GanCubeConnection | null;
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet, conn }) => {
  const [settings, setSettings] = useLocalStorage<Settings>({ key: 'settings' });
  const [currentAlg, setCurrentAlg] = useState<Algorithm | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [isSolved, setIsSolved] = useState<boolean>(true);

  useEffect(() => {
    if (currentAlgSet && currentAlgSet.algs.length > 0) {
      setCurrentAlg(currentAlgSet.algs[0]);
    }
  }, [currentAlgSet]);

  useEffect(() => {
    const player = document.querySelector('twisty-player');
    if (player && currentAlg) {
      const algString = currentAlg.alg.join(' ');
      const parsedAlg = Alg.fromString(algString);
      const inverseAlg = parsedAlg.invert().toString();
      (player as any).experimentalSetupAlg = inverseAlg;
    }
  }, [currentAlg]);

  useEffect(() => {
    if (conn) {
      const handleCubeEvent = (event: GanCubeEvent) => {
        if (event.type === "MOVE") {
          const player = document.querySelector('twisty-player');
          if (player) {
            (player as any).experimentalAddMove(event.move);
            setMoves(prevMoves => [...prevMoves, event.move]);
            checkIfSolved();
          }
        }
      };

      const sub = conn.events$.subscribe(handleCubeEvent);

      return () => {
        sub.unsubscribe();
      };
    }
  }, [conn]);

  const checkIfSolved = async () => {
    if (currentAlg) {
      const setupAlg = Alg.fromString(currentAlg.alg.join(' ')).invert().toString();
      const allMoves = setupAlg + ' ' + moves.join(' ');

      const player = document.querySelector('twisty-player');
      const puzzle = await player.experimentalModel.kpuzzle.get();
      const pattern = puzzle.defaultPattern();
      const updatedPattern = pattern.applyAlg(Alg.fromString(allMoves));

      setIsSolved(updatedPattern.experimentalIsSolved({
        ignoreCenterOrientation: true,
        ignorePuzzleOrientation: true,
      }));
    }
  };

  useEffect(() => {
    checkIfSolved();
  }, [currentAlg, moves]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: isSolved ? 'green' : 'red',
            marginRight: '10px'
          }}
        ></div>
        <h1>Algorithm Set: {currentAlgSet.name}</h1>
      </div>
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
              <li key={alg.name} onClick={() => {
                setCurrentAlg(alg);
                setMoves([]);
              }}>
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
