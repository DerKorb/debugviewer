import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Stage, Layer, Text, Rect, Line } from "react-konva";
import { useDropzone } from "react-dropzone";
import { find, groupBy, keyBy, maxBy, times } from "lodash";
import { KonvaEventObject } from "konva/lib/Node";
import { Locker } from "./locker";
import { Controls } from "./controls";

function isBetween(value, x1, x2) {
  return (value <= x1 && value >= x2) || (value <= x2 && value >= x1);
}

function isInRange(begin, end, rangeStart, rangeEnd) {
  return (
    isBetween(begin, rangeStart, rangeEnd) ||
    isBetween(end, rangeStart, rangeEnd) ||
    (begin < rangeStart && end > rangeEnd)
  );
}
export enum EntryType {
  RequestRead,
  RequestWrite,
  ReadGranted,
  WriteGranted,
  ReadReleased,
  WriteReleased,
  RequestRejected,
  DeadlockDetected,
  DeadlockResolved,
  Unlocked,
  Created
}

export interface Theme {
  background: string;
  lightLines: string;
  mainLines: string;
  highlightColor: string;
  rowHeight: number;
  error: string;
  borderWidth: number;
  border: string;
  fill: string;
  fillWarn: string;
  colors: { [key in EntryType]: string };
}

const defaultTheme: Theme = {
  background: "#494848",
  rowHeight: 30,
  lightLines: "#444",
  fill: "white",
  fillWarn: "lightcoral",
  mainLines: "#666",
  highlightColor: "teal",
  borderWidth: 1,
  error: "red",
  border: "black",
  colors: {
    [EntryType.RequestRead]: "lightseagreen",
    [EntryType.RequestWrite]: "lightcoral",
    [EntryType.ReadGranted]: "seagreen",
    [EntryType.WriteGranted]: "coral",
    [EntryType.ReadReleased]: "darkseagreen",
    [EntryType.WriteReleased]: "darkcoral",
    [EntryType.RequestRejected]: "orange",
    [EntryType.DeadlockDetected]: "darkred",
    [EntryType.DeadlockResolved]: "darkgreen",
    [EntryType.Unlocked]: "yellow",
    [EntryType.Created]: "white"
  }
};

document.title = "Lockservice Debug Visualizer";

function sanityCheckProtocol(protocol: ProtocolEntry[]) {
  const lastHash: { [path: string]: string } = {};
  const lockerData = keyBy(
    Object.values(groupBy(protocol, "lockerId")).filter((l) =>
      find(l, (l) => l.type === EntryType.Unlocked && l.extraInfo === undefined)
    ),
    (x) => x[0].lockerId
  );
  for (const entry of protocol) {
    if (lockerData[entry.lockerId]) {
      switch (entry.type) {
        case EntryType.ReadGranted: {
          const [p, h] = entry.extraInfo.split(" ");
          if (h !== "undefined" && lastHash[p] && lastHash[p] !== h) {
            console.error("invalid hash", h, lastHash[p], entry);
          } else {
          }
          break;
        }
        case EntryType.WriteGranted: {
          const [p, h] = entry.extraInfo.split(" ");
          lastHash[p] = h;
          break;
        }
      }
    }
  }
}

export interface ProtocolEntry {
  time: number;
  lockerId: number;
  type: EntryType;
  extraInfo?: string;
  conflictingLockers?: number[];
}

export interface LockerInfo {
  id: number;
  info: string;
  label: string;
  row: number;
  warn: boolean;
  begin: number;
  end: number;
  protocol: ProtocolEntry[];
}

export interface Recording {
  lockers: LockerInfo[];
  begin: number;
  end: number;
  duration: number;
}

const rowHeight = 30;

const App = () => {
  const [data, setData] = React.useState<Array<ProtocolEntry>>([]);

  const maxRows = Math.floor(window.innerHeight / rowHeight);
  const [filters, setFilters] = useState<string[]>([]);

  const recording: Recording = React.useMemo(() => {
    const transactions = {};
    let currentRow = 0;
    globalThis.data = data;
    globalThis.check = () => {
      sanityCheckProtocol(data);
    };

    const lockers = Object.values(groupBy(data, "lockerId"))
      .filter((protocol) => protocol.length > 2)
      .map((protocol) => {
        let info = protocol[0]!.extraInfo;
        let row = currentRow;
        if (info.includes("eventId")) {
          const { eventId, eventType } = JSON.parse(info);
          info = `${eventId.split("-")[0]} ${eventType}`;
          if (transactions[eventId]) {
            row = transactions[eventId];
            info = "**";
          } else {
            transactions[eventId] = currentRow++;
          }
        } else {
          row = currentRow++;
        }
        if (currentRow >= maxRows) {
          currentRow = 0;
        }

        return {
          info,
          label: info,
          id: protocol[0]!.lockerId,
          row,
          warn:
            protocol.filter(({ type }) => type === EntryType.DeadlockDetected)
              .length > 0,
          begin: protocol[0]!.time,
          end: protocol[protocol.length - 1]!.time,
          protocol
        };
      });

    const firstEntry = lockers[0];
    const lastEntry = lockers[lockers.length - 1];
    const recordingBegin = firstEntry ? firstEntry.begin : 0;
    const recordingEnd = lastEntry
      ? maxBy(lockers, "end").end
      : window.innerWidth;
    const totalDuration = recordingEnd - recordingBegin + 200;

    return {
      lockers,
      begin: recordingBegin,
      end: recordingEnd,
      duration: totalDuration
    };
  }, [data, maxRows]);

  globalThis.recording = recording;

  let totalHeight = rowHeight * maxRows;
  const [highlightedLockers, setHighlightedLockers] = useState([]);
  const [visibleTimeStart, setVisibleTimeStart] = useState(recording.begin);
  const [scaleX, setScaleX] = React.useState(
    window.innerWidth / recording.duration
  );
  const visibleTimeEnd = visibleTimeStart + window.innerWidth / scaleX;

  useEffect(() => {
    setScaleX(Math.max(window.innerWidth / recording.duration, 0.01));
    setVisibleTimeStart(recording.begin);
  }, [recording.duration, recording.begin]);
  const setXWithinBounds = useCallback(
    (x: number) => {
      setVisibleTimeStart(
        Math.min(
          Math.max(x, recording.begin),
          recording.end - window.innerWidth / scaleX
        )
      );
    },
    [setVisibleTimeStart, recording.begin, recording.end, scaleX]
  );

  useEffect(() => {
    fetch("https://poker.feinarbyte-dev.de:8080/backend/debug").then(
      async (x) => {
        const result = await x.json();
        console.log(result);
        setData(result);
      }
    );
  }, []);

  function getX(time) {
    return scaleX * time;
  }

  const visibleLockers = React.useMemo(
    () =>
      recording.lockers
        .filter(({ begin, end }) =>
          isInRange(begin, end, visibleTimeStart, visibleTimeEnd)
        )
        .filter(
          ({ protocol }) =>
            filters.length === 0 ||
            find(protocol, (p) =>
              filters.some((filter) => p.extraInfo?.includes(filter))
            )
        ),
    [visibleTimeStart, recording.lockers, filters, visibleTimeEnd]
  );

  const onDrop = React.useCallback((acceptedFiles) => {
    console.log("accepted:", acceptedFiles);

    if (acceptedFiles[0].type === "application/json") {
      acceptedFiles[0].text().then((t) => {
        setData(JSON.parse(t));
      });
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    noClick: true,
    onDrop
  });

  const theme = defaultTheme;
  const lineIntervalInMs = scaleX < 0.1 ? 1000 : 100;
  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <Stage width={window.innerWidth} height={window.innerHeight}>
        <Layer
          onWheel={useCallback(
            (e: KonvaEventObject<WheelEvent>) => {
              const maxScale = window.innerWidth / recording.duration;
              const newScale = Math.max(
                scaleX * (e.evt.deltaY < 0 ? 1.3 : 0.7),
                maxScale
              );
              setScaleX(newScale);
              setXWithinBounds(
                visibleTimeStart -
                  (e.evt.clientX / newScale - e.evt.clientX / scaleX)
              );
            },
            [scaleX, visibleTimeStart, recording.duration, setXWithinBounds]
          )}
          x={-visibleTimeStart * scaleX}
          y={0}
          draggable
          onDragMove={(e) => {
            const newPos = e.target.position();
            // reset position to its old state
            // so drag is fully controlled by react
            e.target.position({ x: -visibleTimeStart * scaleX, y: 0 });

            setXWithinBounds(-newPos.x / scaleX);
          }}
        >
          <Rect
            x={visibleTimeStart * scaleX}
            y={0}
            fill={theme.background}
            width={window.innerWidth}
            height={window.innerHeight}
          />
          {times(recording.duration / lineIntervalInMs, (n) =>
            isBetween(
              recording.begin + n * lineIntervalInMs,
              visibleTimeStart,
              visibleTimeEnd
            ) ? (
              <Line
                key={`line${n}`}
                x={getX(recording.begin + n * lineIntervalInMs)}
                y={0}
                points={[0, 0, 0, totalHeight]}
                stroke={
                  (n % 10) * lineIntervalInMs === 0
                    ? theme.mainLines
                    : theme.lightLines
                }
              />
            ) : null
          )}
          {visibleLockers.map((locker, n) => {
            const { warn, id } = locker;
            return (
              <Locker
                scale={scaleX}
                locker={locker}
                warn={warn}
                filters={filters}
                setHighlightedLockers={setHighlightedLockers}
                detailed={visibleLockers.length < 100}
                theme={theme}
                highlighted={highlightedLockers.includes(id)}
              />
            );
          })}
        </Layer>
        {data.length === 0 ? (
          <Layer
            stroke={"black"}
            x={window.innerWidth / 2 - 200}
            y={window.innerHeight / 2 - 100}
          >
            <Rect fill={"white"} width={400} height={200} />
            <Text
              text={"drop upload a debug file"}
              width={400}
              height={200}
              align={"center"}
              verticalAlign={"middle"}
              fontSize={20}
            />
          </Layer>
        ) : null}
      </Stage>
      <Controls recording={recording} onNewFilters={setFilters} />
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
