import React, { useEffect, useState } from 'react';

interface ChipSelectorProps {
  onSelect: (value: string) => void;
  selected: string;
}

const fetchRecordingFiles = async (): Promise<string[]> => {
  try {
    const res = await fetch('/recordings/files.json');
    if (!res.ok) return [];
    const files = await res.json();
    if (!Array.isArray(files)) return [];
    return files.slice(0, 50);
  } catch {
    return [];
  }
};

const ChipSelector: React.FC<ChipSelectorProps> = ({ onSelect, selected }) => {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    fetchRecordingFiles().then(setFiles);
  }, []);

  const chips = ['OFF', 'REAL-TIME', ...files];

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