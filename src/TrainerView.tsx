import React, { useState, useEffect } from 'react';
import { MdBluetooth, MdBluetoothDisabled } from 'react-icons/md';
import { connectGanCube, GanCubeConnection, GanCubeEvent } from 'gan-web-bluetooth';
import 'cubing/twisty';

const TrainerView: React.FC = () => {
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

export default TrainerView;
