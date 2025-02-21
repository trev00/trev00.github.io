/* eslint-disable react/prop-types */
/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame } from "@react-three/fiber";
import "./App.css";
import { useRef, useState } from "react";
import {TrackballControls } from "@react-three/drei";
import { useControls } from "leva";

const Earth = ({ position, args }) => {
  const ref = useRef()
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  
  useFrame((state, delta) => {
    const speed = isHovered ? 0.8 : 0.2
    ref.current.rotation.y += speed
    console.log(state.clock.elapsedTime)
    console.log(state)
  })
  return (
    <mesh position={position} ref={ref} 
    onPointerEnter={(event) => (event.stopPropagation(), setIsHovered(true))} 
    onPointerLeave={() => setIsHovered(false)}
    onClick={() => setIsClicked(!isClicked)}
    scale={isClicked ? 10 : 1}
    >
      <sphereGeometry args={args} />
      <meshStandardMaterial color={isClicked ? "red" : "lightblue"} wireframe />
    </mesh>
  )
}

const Scene = () => {
  const directionalLightRef = useRef();

  const { lightColour, lightIntensity } = useControls({
    lightColour: "white",
    lightIntensity: {
      value: 0.5,
      min: 0,
      max: 5,
      step: 0.1,
    },
  });

  return (
    <>
      <directionalLight
        position={[0, 1, 2]}
        intensity={lightIntensity}
        ref={directionalLightRef}
        color={lightColour}
      />
      <ambientLight intensity={0.5} />
      <Earth position={[0, 0, 0]} args={[1,32,32]}/>
      <TrackballControls enableZoom={false} noPan={true} enableRotate={true} mouseButtons={{ LEFT: null, MIDDLE: 0, RIGHT: 2 }}/>
    </>
  );
};

const App = () => {
  return (
    <Canvas>
      <Scene />
    </Canvas>
  );
};

export default App;
