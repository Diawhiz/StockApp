import React, { createContext, useContext, useState } from 'react';
import { toISODateString, shiftDate } from '../utils/dateUtils';

const DateContext = createContext();

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(toISODateString(new Date()));

  const goToPrevDay = () => {
    setSelectedDate((curr) => shiftDate(curr, -1));
  };

  const goToNextDay = () => {
    setSelectedDate((curr) => shiftDate(curr, 1));
  };

  const goToToday = () => {
    setSelectedDate(toISODateString(new Date()));
  };

  return (
    <DateContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        goToPrevDay,
        goToNextDay,
        goToToday,
      }}
    >
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error('useDate must be used within a DateProvider');
  }
  return context;
}
