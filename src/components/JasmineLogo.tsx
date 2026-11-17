'use client';

import React, { useId } from 'react';

interface JasmineIconProps {
  className?: string;
  size?: number;
}

export function JasmineIcon({ className = '', size = 24 }: JasmineIconProps) {
  const uid = useId().replace(/:/g, '');
  const petalId = `jasmine-p-${uid}`;
  const flowerId = `jasmine-f-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-66 -66 132 132"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <path
          id={petalId}
          d="M0 0C-15 -18 -13 -46 0 -62C13 -46 15 -18 0 0Z"
        />
        <g id={flowerId}>
          <g fill="#1E3A8A">
            <use href={`#${petalId}`} transform="rotate(0)" />
            <use href={`#${petalId}`} transform="rotate(72)" />
            <use href={`#${petalId}`} transform="rotate(144)" />
            <use href={`#${petalId}`} transform="rotate(216)" />
            <use href={`#${petalId}`} transform="rotate(288)" />
          </g>
          <g fill="#2563EB">
            <use href={`#${petalId}`} transform="rotate(36) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(108) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(180) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(252) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(324) scale(0.72)" />
          </g>
          <g fill="#93C5FD">
            <use href={`#${petalId}`} transform="rotate(0) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(72) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(144) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(216) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(288) scale(0.4)" />
          </g>
          <circle r="4" fill="#0B1330" />
        </g>
      </defs>
      <use href={`#${flowerId}`} />
    </svg>
  );
}

interface JasmineLockupProps {
  className?: string;
  height?: number;
}

export function JasmineLockup({ className = '', height = 40 }: JasmineLockupProps) {
  const uid = useId().replace(/:/g, '');
  const petalId = `jasmine-lp-${uid}`;
  const flowerId = `jasmine-lf-${uid}`;
  const width = Math.round((height * 520) / 200);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 520 200"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Jasmine"
    >
      <defs>
        <path
          id={petalId}
          d="M0 0C-15 -18 -13 -46 0 -62C13 -46 15 -18 0 0Z"
        />
        <g id={flowerId}>
          <g fill="#1E3A8A">
            <use href={`#${petalId}`} transform="rotate(0)" />
            <use href={`#${petalId}`} transform="rotate(72)" />
            <use href={`#${petalId}`} transform="rotate(144)" />
            <use href={`#${petalId}`} transform="rotate(216)" />
            <use href={`#${petalId}`} transform="rotate(288)" />
          </g>
          <g fill="#2563EB">
            <use href={`#${petalId}`} transform="rotate(36) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(108) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(180) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(252) scale(0.72)" />
            <use href={`#${petalId}`} transform="rotate(324) scale(0.72)" />
          </g>
          <g fill="#93C5FD">
            <use href={`#${petalId}`} transform="rotate(0) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(72) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(144) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(216) scale(0.4)" />
            <use href={`#${petalId}`} transform="rotate(288) scale(0.4)" />
          </g>
          <circle r="4" fill="#0B1330" />
        </g>
      </defs>
      <use href={`#${flowerId}`} transform="translate(100,104) scale(1.25)" />
      <text
        x="188"
        y="122"
        fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif"
        fontSize="68"
        fontWeight="500"
        letterSpacing="2"
        fill="currentColor"
      >
        Jasmine
      </text>
    </svg>
  );
}
