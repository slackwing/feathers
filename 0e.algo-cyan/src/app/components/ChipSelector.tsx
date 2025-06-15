import React from 'react';

interface ChipSelectorProps {
  onSelect: (value: string) => void;
  selected: string;
}

const ChipSelector: React.FC<ChipSelectorProps> = ({ onSelect, selected }) => {
  const chips = ['OFF', 'REAL-TIME', 'FILE'];

  return (
    <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          style={{
            padding: '8px 18px',
            borderRadius: 20,
            border: 'none',
            background: selected === chip ? '#555' : '#eee',
            color: selected === chip ? '#fff' : '#333',
            marginBottom: 8,
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 16,
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
};

export default ChipSelector; 