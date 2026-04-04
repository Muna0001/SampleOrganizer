import KeyboardSampler from './KeyboardSampler';
import DrumPad from './DrumPad';

function InstrumentPanel({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  samplerEngine,
  keyboardSample,
  drumPads,
  onPadClick,
  onClearPad,
}) {
  if (!isOpen) {
    return (
      <div className="instrument-toggle" onClick={onToggle}>
        <span>INSTRUMENTS [+]</span>
      </div>
    );
  }

  return (
    <div className="instrument-panel">
      <div className="instrument-header">
        <div className="instrument-tabs">
          <button
            className={`instrument-tab ${activeTab === 'keyboard' ? 'active' : ''}`}
            onClick={() => onTabChange('keyboard')}
          >
            KEYBOARD
          </button>
          <button
            className={`instrument-tab ${activeTab === 'drumpad' ? 'active' : ''}`}
            onClick={() => onTabChange('drumpad')}
          >
            DRUM PAD
          </button>
        </div>
        <button className="instrument-close" onClick={onToggle}>[-]</button>
      </div>
      <div className="instrument-body">
        {activeTab === 'keyboard' ? (
          <KeyboardSampler engine={samplerEngine} sample={keyboardSample} />
        ) : (
          <DrumPad
            engine={samplerEngine}
            pads={drumPads}
            onPadClick={onPadClick}
            onClearPad={onClearPad}
          />
        )}
      </div>
    </div>
  );
}

export default InstrumentPanel;
