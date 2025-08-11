import { Aggregate } from '@cqrs/framework';
import { TestId } from './types';
import { TestEvents } from './events';

export class TestAggregate extends Aggregate {
  constructor(id: TestId) {
    super(id);
  }

  // Add domain methods here
}
