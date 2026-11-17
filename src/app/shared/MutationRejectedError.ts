/** A single transactional command was rejected before committing any change. */
export class MutationRejectedError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'MutationRejectedError';
  }
}
