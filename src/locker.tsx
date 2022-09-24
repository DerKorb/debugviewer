import { find, padStart } from "lodash";
import React from "react";
import { Rect, Text } from "react-konva";
import { EntryType, LockerInfo, Theme } from ".";

function printLocker(locker: LockerInfo) {
  console.log(`Locker${locker.id} ${locker.info}`);
  for (const e of locker.protocol) {
    console.log(
      `${padStart((e.time % 100000).toFixed(0), 6, " ")}ms: ${
        EntryType[e.type]
      } ${e.extraInfo ?? ""} ${(e.conflictingLockers ?? []).join(", ")}`
    );
  }
}

export interface LockerProps {
  locker: LockerInfo;
  warn: boolean;
  setHighlightedLockers: React.Dispatch<React.SetStateAction<number[]>>;
  scale: number;
  detailed: boolean;
  filters: string[];
  theme: Theme;
  highlighted: boolean;
}

export const Locker = React.memo(
  ({
    locker,
    theme,
    highlighted,
    filters,
    detailed,
    setHighlightedLockers,
    scale
  }: LockerProps): JSX.Element => {
    const { warn, protocol, begin, end, row } = locker;
    const width = (end - begin) * scale;
    const y = Number(row) * theme.rowHeight;
    const x = begin * scale;
    const errored = find(
      protocol,
      (p) => p.type === EntryType.Unlocked && p.extraInfo !== undefined
    );
    return (
      <>
        <Rect
          onClick={() => printLocker(locker)}
          onMouseEnter={() => {
            if (warn) {
              const conflictingLockers = find(protocol, {
                type: EntryType.DeadlockDetected
              }).conflictingLockers!;

              setHighlightedLockers(conflictingLockers);
            }
          }}
          onMouseLeave={() => {
            setHighlightedLockers([]);
          }}
          y={y}
          x={x}
          width={width + theme.borderWidth * 2}
          strokeWidth={theme.borderWidth}
          height={theme.rowHeight}
          fill={
            highlighted
              ? theme.highlightColor
              : warn
              ? theme.fillWarn
              : theme.fill
          }
          stroke={errored ? theme.error : theme.border}
        />
        {detailed ? (
          <>
            {protocol.map((entry, n) => {
              return (
                <Rect
                  key={n}
                  height={theme.rowHeight / 2}
                  width={2}
                  x={entry.time * scale}
                  y={
                    filters.length > 0 &&
                    entry.extraInfo &&
                    filters.some((filter) => entry.extraInfo.includes(filter))
                      ? y
                      : y + theme.rowHeight / 2
                  }
                  fill={theme.colors[entry.type]}
                />
              );
            })}

            <Text
              x={x + width + theme.borderWidth + 2}
              y={y + 2}
              text={`${locker.info}`}
              fill={"white"}
            />
          </>
        ) : null}
      </>
    );
  }
);
