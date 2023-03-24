import { useState, useEffect } from "react";
import styled from "styled-components";

const StyledMap = styled.div(
  ({ expanded }) => `
  background-color: var(--colour-bg);
  padding: ${expanded ? "var(--space-6)" : "var(--space-4)"};
  position: ${expanded ? "fixed" : "relative"};
  top: ${expanded ? "var(--space-6)" : "unset"};
  bottom: ${expanded ? "var(--space-6)" : "unset"};
  left: ${expanded ? "var(--space-6)" : "unset"};
  right: ${expanded ? "var(--space-6)" : "unset"};
  border: ${expanded ? "1px solid var(--colour-border)" : "none"};
  border-radius: 4px;
`
);

const space = 1000;

const rad = (deg) => deg * (Math.PI / 180);
const deg = (rad) => rad / (Math.PI / 180);

const rotate = (x, y, a, px, py) => {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));

  x -= px;
  y -= py;

  const newX = x * c - y * s;
  const newY = y * c + x * s;

  return [newX + px, (newY + py) * -1];
};

const Map = ({ circuit, Position, DriverList, TimingData }) => {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState({});
  const [[minX, minY, widthX, widthY], setBounds] = useState([
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  const [stroke, setStroke] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        `https://api.multiviewer.app/api/v1/circuits/${circuit}/${new Date().getFullYear()}`,
        {
          headers: {
            "User-Agent": "tdjsnelling/monaco",
          },
        }
      );
      if (res.status === 200) {
        const rawData = await res.json();

        const px = (Math.max(...rawData.x) - Math.min(...rawData.x)) / 2;
        const py = (Math.max(...rawData.y) - Math.min(...rawData.y)) / 2;

        rawData.transformedPoints = rawData.x.map((x, i) =>
          rotate(x, rawData.y[i], rawData.rotation, px, py)
        );

        const cMinX =
          Math.min(...rawData.transformedPoints.map(([x]) => x)) - space;
        const cMinY =
          Math.min(...rawData.transformedPoints.map(([, y]) => y)) - space;
        const cWidthX =
          Math.max(...rawData.transformedPoints.map(([x]) => x)) -
          cMinX +
          space * 2;
        const cWidthY =
          Math.max(...rawData.transformedPoints.map(([, y]) => y)) -
          cMinY +
          space * 2;

        setBounds([cMinX, cMinY, cWidthX, cWidthY]);

        const cStroke = (cWidthX + cWidthY) / 200;
        setStroke(cStroke);

        rawData.corners = rawData.corners.map((corner) => {
          const transformedCorner = rotate(
            corner.trackPosition.x,
            corner.trackPosition.y,
            rawData.rotation,
            px,
            py
          );

          const transformedLabel = rotate(
            corner.trackPosition.x + 5 * cStroke * Math.cos(rad(corner.angle)),
            corner.trackPosition.y + 5 * cStroke * Math.sin(rad(corner.angle)),
            rawData.rotation,
            px,
            py
          );

          return { ...corner, transformedCorner, transformedLabel };
        });

        rawData.startAngle = deg(
          Math.atan(
            (rawData.transformedPoints[3][1] -
              rawData.transformedPoints[0][1]) /
              (rawData.transformedPoints[3][0] -
                rawData.transformedPoints[0][0])
          )
        );

        setData(rawData);
      }
    };
    fetchData();
  }, [circuit]);

  const hasData = !!Object.keys(data).length;

  return hasData ? (
    <StyledMap expanded={expanded}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          position: "absolute",
          top: "var(--space-3)",
          right: "var(--space-3)",
        }}
      >
        {expanded ? "↓" : "↑"}
      </button>
      <svg
        viewBox={`${minX} ${minY} ${widthX} ${widthY}`}
        width="100%"
        height={expanded ? "100%" : "500px"}
      >
        <path
          stroke="var(--colour-fg)"
          strokeWidth={stroke}
          strokeLinejoin="round"
          fill="transparent"
          d={`M${data.transformedPoints[0][0]},${
            data.transformedPoints[0][1]
          } ${data.transformedPoints.map(([x, y]) => `L${x},${y}`).join(" ")}`}
        />
        <rect
          x={data.transformedPoints[0][0]}
          y={data.transformedPoints[0][1]}
          width={stroke * 4}
          height={stroke}
          fill="red"
          stroke="var(--colour-bg)"
          strokeWidth={stroke / 2}
          transform={`translate(${stroke * -2} ${(stroke * -1) / 2}) rotate(${
            data.startAngle + 90
          }, ${data.transformedPoints[0][0] + stroke * 2}, ${
            data.transformedPoints[0][1] + stroke / 2
          })`}
        />
        {Object.entries(Position.Entries ?? {}).map(([racingNumber, pos]) => {
          const driver = DriverList[racingNumber];
          const timingData = TimingData.Lines[racingNumber];
          const onTrack =
            pos.Status === "OnTrack" &&
            !timingData.KnockedOut &&
            !timingData.Retired &&
            !timingData.Stopped;
          const [rx, ry] = rotate(
            pos.X,
            pos.Y,
            data.rotation,
            (Math.max(...data.x) - Math.min(...data.x)) / 2,
            (Math.max(...data.y) - Math.min(...data.y)) / 2
          );
          const fontSize = stroke * 3;
          return (
            <g key={`pos-${racingNumber}`} opacity={onTrack ? 1 : 0.5}>
              <circle
                cx={rx}
                cy={ry}
                r={(stroke * 1.5) / (onTrack ? 1 : 2)}
                fill={`#${driver.TeamColour}`}
                stroke="var(--colour-bg)"
                strokeWidth={fontSize / 10}
                style={{ transition: "200ms linear" }}
              />
              <text
                x={rx + stroke * 1.5}
                y={ry + stroke}
                fill={`#${driver.TeamColour}`}
                fontSize={fontSize}
                fontWeight="bold"
                stroke="var(--colour-bg)"
                strokeWidth={fontSize / 30}
                style={{ transition: "200ms linear" }}
              >
                {driver.Tla}
              </text>
            </g>
          );
        })}
        {data.corners.map((corner) => {
          let string = `${corner.number}`;
          if (corner.letter) string = string + corner.letter;

          const fontSize = stroke * 2;

          const [cornerX, cornerY] = corner.transformedCorner;
          const [labelX, labelY] = corner.transformedLabel;

          const lineX = labelX + fontSize * (string.length * 0.25);
          const lineY = labelY - (labelY > cornerY ? fontSize * 0.7 : 0);

          return (
            <g key={`corner-${corner.number}}`}>
              <text
                x={labelX}
                y={labelY}
                fontSize={fontSize}
                fontWeight="bold"
                fill="red"
                stroke="var(--colour-bg)"
                strokeWidth={fontSize / 40}
              >
                {string}
              </text>
              <path
                stroke="red"
                strokeWidth={stroke / 2}
                opacity={0.25}
                d={`M${cornerX},${cornerY} L${lineX},${lineY}`}
              />
            </g>
          );
        })}
      </svg>
    </StyledMap>
  ) : null;
};

export default Map;