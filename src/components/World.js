import { useEffect } from "react";
import { initCannon, initThree, animate } from "../3d/init";

const World = () => {
  useEffect(() => {
    initCannon();
    initThree();
    animate();
  }, []);

  return <div className="world"></div>;
};

export default World;
