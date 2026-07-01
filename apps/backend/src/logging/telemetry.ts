import { createStructuredLogger } from "./create-structured-logger";

const logger = createStructuredLogger("Telemetry");

export class Telemetry {
  private static trackers = new Map<string, number>();

  /**
   * Starts a performance tracker for a given metric name.
   * Returns a tracker ID to pass to `Telemetry.end`.
   */
  static start(metricName: string): string {
    const trackerId = `${metricName}_${Math.random().toString(36).slice(2, 9)}`;
    this.trackers.set(trackerId, performance.now());
    return trackerId;
  }

  /**
   * Ends the performance tracker and logs the elapsed duration.
   */
  static end(trackerId: string, details?: Record<string, unknown>): void {
    const startTime = this.trackers.get(trackerId);
    if (startTime === undefined) {
      return;
    }
    this.trackers.delete(trackerId);
    const duration = Math.round(performance.now() - startTime);
    const metricName = trackerId.slice(0, trackerId.lastIndexOf("_"));

    logger.info(
      {
        metric: metricName,
        durationMs: duration,
        ...details,
      },
      `[TELEMETRY] ${metricName}: ${duration}ms`,
    );
  }

  /**
   * Logs a one-off telemetry event.
   */
  static event(eventName: string, details?: Record<string, unknown>): void {
    logger.info(
      {
        event: eventName,
        ...details,
      },
      `[TELEMETRY] ${eventName}`,
    );
  }
}
