// The reference's operational color scale is separate from official drought declarations.
// Orange: risk in the first 0–2 months or at least two consecutive risk months.
// Yellow: risk later in the six-month forecast; red requires field confirmation.
export function seasonalAlertLevel(forecast: readonly { status: string }[]): "green" | "yellow" | "orange" {
  let run = 0;
  let longest = 0;
  for (const cell of forecast) {
    run = cell.status === "drought" ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const first = forecast.findIndex((cell) => cell.status === "drought");
  if (first === -1) return "green";
  return first <= 2 || longest >= 2 ? "orange" : "yellow";
}
