const Controls = ({ resetApp }) => {
  return (
    <div className="controls">
      <button className="resetButton" onClick={resetApp} onTouchEnd={resetApp}>Reset</button>
    </div>
  );
};

export default Controls;
