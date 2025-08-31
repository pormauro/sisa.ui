// utils.ts
export function calculateTimeDifference(startDate: Date, endDate: Date) {
    const diffInMilliseconds = endDate.getTime() - startDate.getTime();
    
    const hours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((diffInMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  }
  