import { Recording } from ".";
import { Tag, WithContext as ReactTags } from "react-tag-input";
import { useEffect, useState } from "react";

export interface ControlProps {
  recording: Recording;
  onNewFilters: (filters: string[]) => void;
  onReload: () => void;
}

export const Controls = ({
  recording,
  onNewFilters,
  onReload
}: ControlProps) => {
  const [filters, setFilters] = useState<Tag[]>([]);
  useEffect(() => {
    onNewFilters(filters.map((f) => f.text));
  }, [filters, onNewFilters]);
  return (
    <div
      style={{
        position: "absolute",
        left: 20,
        bottom: 20,
        backgroundColor: "white",
        padding: 4
      }}
    >
      Duration: {(recording.duration / 1000).toFixed(0)}s &nbsp;
      <button onClick={onReload}>reload</button>
      <ReactTags
        tags={filters}
        autofocus={false}
        placeholder={"Press enter to add new filter"}
        handleAddition={(newTag) => setFilters([...filters, newTag])}
        handleDelete={(n) =>
          setFilters(filters.filter((tag, index) => index !== n))
        }
      />
    </div>
  );
};
