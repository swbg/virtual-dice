import { useEffect, useState } from "react";
import Controls from "./Controls";
import Info from "./Info";
import { resetCube } from "../3d/init";
import { initCannon, initThree, animate } from "../3d/init";

const App = () => {
  const [pips, setPips] = useState(null);

  useEffect(() => {
    initCannon();
    initThree(setPips);
    animate();
  }, []);

  const resetApp = () => {
    resetCube();
    setPips(null);
  };

  return (
    <div className="app">
      <Controls resetApp={resetApp} />
      <Info pips={pips} />
    </div>
  );
};

export default App;
