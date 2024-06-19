import React, { useState, useEffect } from 'react';
import { MdBluetooth, MdBluetoothDisabled } from 'react-icons/md';
import { connectGanCube, GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import 'cubing/twisty';
import { AlgSet, Alg, ValidMove } from './interfaces';

interface TrainerViewProps {
  currentAlgSet: AlgSet;
}

const TrainerView: React.FC<TrainerViewProps> = ({ currentAlgSet }) => {
  const [conn, setConn] = useState<GanCubeConnection | null>(null);
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
          experimental-setup-anchor="end"
          experimental-stickering="full"
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
      {currentAlgSet && (
        <div>
          <h2>Training on: {currentAlgSet.name}</h2>
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
