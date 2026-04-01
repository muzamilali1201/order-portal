const { addBusinessDays } = require("./businessDays");

function getNextStatusTime(status) {
  const date = new Date();

  if (status === "ORDERED") {
    date.setDate(date.getDate() + 10);
    return date;
  }

  if (status === "SENT_TO SELLER") {
    return addBusinessDays(date, 3);
  }

  if (status === "SOFT_REMINDER") {
    return addBusinessDays(date, 2);
  }

  return null; // no auto transition
}

module.exports = getNextStatusTime;
