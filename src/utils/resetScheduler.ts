export interface ResetInfo {
  timePeriod: 'daily' | 'weekly' | 'monthly';
  nextReset: Date;
  resetTime: string;
}

export function getNextResetTime(timePeriod: 'daily' | 'weekly' | 'monthly'): ResetInfo {
  const now = new Date();
  let nextReset = new Date(now);

  if (timePeriod === 'daily') {
    // Reset daily at 1:00 AM
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(1, 0, 0, 0);
    
    return {
      timePeriod,
      nextReset,
      resetTime: nextReset.toLocaleString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
  } else if (timePeriod === 'weekly') {
    // Reset every Saturday at 12:59 PM
    const dayOfWeek = nextReset.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
    const daysToAdd = daysUntilSaturday === 0 && 
                      (now.getHours() > 12 || (now.getHours() === 12 && now.getMinutes() > 59))
                      ? 7 : daysUntilSaturday;
    
    nextReset.setDate(nextReset.getDate() + daysToAdd);
    nextReset.setHours(12, 59, 0, 0);
    
    return {
      timePeriod,
      nextReset,
      resetTime: nextReset.toLocaleString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
  } else if (timePeriod === 'monthly') {
    // Reset on last day of month at 12:59 PM
    const month = nextReset.getMonth();
    const year = nextReset.getFullYear();
    
    // Get last day of current month
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    nextReset.setDate(lastDay);
    nextReset.setHours(12, 59, 0, 0);
    
    // If we're past that time, schedule for next month
    if (now > nextReset) {
      nextReset = new Date(year, month + 1, 0);
      const nextLastDay = new Date(year, month + 2, 0).getDate();
      nextReset.setDate(nextLastDay);
      nextReset.setHours(12, 59, 0, 0);
    }
    
    return {
      timePeriod,
      nextReset,
      resetTime: nextReset.toLocaleString('en-US', { 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
  }

  return {
    timePeriod,
    nextReset,
    resetTime: 'Unknown'
  };
}

export function formatResetInfo(timePeriod: 'daily' | 'weekly' | 'monthly'): string {
  const reset = getNextResetTime(timePeriod);
  return `⏱️ Next reset: ${reset.resetTime}`;
}
