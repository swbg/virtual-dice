const Info = ({ pips }) => {
  return (
    <div className="info">
      {pips && <div className="infoField">{pips}</div>}
    </div>
  );
};

export default Info;
