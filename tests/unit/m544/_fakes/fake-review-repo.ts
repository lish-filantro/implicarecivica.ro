/** In-memory ReviewRepo: records classification feedback rows for assertions. */
import type { ReviewRepo, FeedbackRow } from '@m544/emails/review/repo';

export class FakeReviewRepo implements ReviewRepo {
  feedback: FeedbackRow[] = [];

  async insertFeedback(row: FeedbackRow): Promise<void> {
    this.feedback.push(row);
  }
}
