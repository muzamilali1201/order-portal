function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addBusinessDays(startDate, daysToAdd) {
  const date = new Date(startDate);
  let remainingDays = Number(daysToAdd) || 0;

  while (remainingDays > 0) {
    date.setDate(date.getDate() + 1);
    if (!isWeekend(date)) {
      remainingDays -= 1;
    }
  }

  return date;
}

module.exports = {
  isWeekend,
  addBusinessDays,
};
