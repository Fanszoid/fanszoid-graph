export function getQuestionId(eventId: string, index: string): string {
  return "q" + eventId + "-" + index;
}
