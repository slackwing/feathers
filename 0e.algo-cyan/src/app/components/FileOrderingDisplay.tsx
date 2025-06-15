import React from 'react';
import styles from './FileOrderingDisplay.module.css';

interface FileOrderingDisplayProps {
  files: File[];
  onReorder: (newOrder: File[]) => void;
  onRun: () => void;
}

const FileOrderingDisplay: React.FC<FileOrderingDisplayProps> = ({ files, onReorder, onRun }) => {
  const [draggedFile, setDraggedFile] = React.useState<File | null>(null);

  const handleDragStart = (file: File) => {
    setDraggedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetFile: File) => {
    e.preventDefault();
    if (!draggedFile || draggedFile === targetFile) return;

    const newOrder = [...files];
    const draggedIndex = newOrder.indexOf(draggedFile);
    const targetIndex = newOrder.indexOf(targetFile);
    
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedFile);
    
    onReorder(newOrder);
    setDraggedFile(null);
  };

  const handleSort = () => {
    const newOrder = [...files].sort((a, b) => a.name.localeCompare(b.name));
    onReorder(newOrder);
  };

  return (
    <div className={styles.container}>
      <h3>Selected Files</h3>
      <div className={styles.fileList}>
        {files.map((file, index) => (
          <div
            key={file.name}
            className={styles.fileItem}
            draggable
            onDragStart={() => handleDragStart(file)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, file)}
          >
            <span className={styles.fileNumber}>{index + 1}</span>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        ))}
      </div>
      <div className={styles.buttonContainer}>
        <button className={styles.sortButton} onClick={handleSort}>
          Sort Alphabetically
        </button>
        <button className={styles.runButton} onClick={onRun}>
          Run Experiment
        </button>
      </div>
    </div>
  );
};

export default FileOrderingDisplay; 