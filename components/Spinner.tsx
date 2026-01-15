import React from 'react';

type SpinnerSize = 50 | 100 | 200 | 400;
type SpinnerColor = 'white' | 'black' | 'red' | 'green' | 'blue' | 'yellow' | 'violet' | 'brown' | 'orange' | 'rainbow';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 50, color = 'blue' }) => {
  const sizeClass = {
    50: 'w-[50px] h-[50px] border-4',
    100: 'w-[100px] h-[100px] border-8',
    200: 'w-[200px] h-[200px] border-[12px]',
    400: 'w-[400px] h-[400px] border-[16px]'
  }[size];

  const colorClass = color === 'rainbow' 
    ? 'spinner-rainbow' 
    : `border-${color}-500 border-t-transparent border-r-${color}-500 border-b-${color}-500 border-l-transparent`;

  const standardStyle = color !== 'rainbow' ? {
    borderColor: color,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent'
  } : {};

  return (
    <div 
      className={`spinner-ball ${sizeClass} ${color !== 'rainbow' ? '' : 'spinner-rainbow'}`}
      style={color !== 'rainbow' ? { 
        borderColor: color === 'white' ? 'white' : color === 'black' ? 'black' : undefined,
        borderTopColor: 'transparent', 
        borderLeftColor: 'transparent',
        // Fallback for simple colors if not using specific tailwind palette matches or custom CSS
        borderRightColor: color === 'white' ? 'white' : color,
        borderBottomColor: color === 'white' ? 'white' : color
       } : {}}
    />
  );
};