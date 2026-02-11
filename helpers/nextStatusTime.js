function getNextStatusTime(status) {
  const date = new Date();


  if (status === "ORDERED") {
    date.setDate(date.getDate() + 10);
    return date;
  }

  if (status === "SENT_TO SELLER") {
    date.setDate(date.getDate() + 3);
    return date;
  }

  if (status === "SOFT_REMINDER") {
    date.setDate(date.getDate() + 2);
    return date;
  }

  return null; // no auto transition
}

module.exports = getNextStatusTime;
