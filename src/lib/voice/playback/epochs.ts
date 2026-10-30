/**
 * PlaybackEpoch: monotonic generation and session tracker.
 * Discards any out-of-order, stale, or canceled audio frames.
 */
export class PlaybackEpoch {
  private currentSessionEpoch = 1;
  private currentReplyEpoch = 1;

  get sessionEpoch(): number {
    return this.currentSessionEpoch;
  }

  get replyEpoch(): number {
    return this.currentReplyEpoch;
  }

  /**
   * Start a new overall session (e.g. after reconnect or microphone init).
   */
  nextSession(): { sessionEpoch: number; replyEpoch: number } {
    this.currentSessionEpoch++;
    this.currentReplyEpoch = 1;
    return { sessionEpoch: this.currentSessionEpoch, replyEpoch: this.currentReplyEpoch };
  }

  /**
   * Start a new agent reply turn.
   */
  nextReply(): number {
    this.currentReplyEpoch++;
    return this.currentReplyEpoch;
  }

  /**
   * Invalidate current reply turn on user barge-in / interruption.
   */
  cancelReply(): number {
    this.currentReplyEpoch++;
    return this.currentReplyEpoch;
  }

  /**
   * Check if a given session and reply match the currently active generation.
   */
  isValid(sessionEpoch: number, replyEpoch: number): boolean {
    return sessionEpoch === this.currentSessionEpoch && replyEpoch === this.currentReplyEpoch;
  }
}
