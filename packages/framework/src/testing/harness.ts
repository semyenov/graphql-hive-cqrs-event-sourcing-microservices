import { bootstrapFramework } from '..';
import type { IEvent } from '../core';
import type { AggregateId } from '../core/branded/types';
import type { Aggregate } from '../core/aggregate';
import type { AggregateRepository } from '../infrastructure/repository/aggregate';
import type { CommandBus, EventBus, QueryBus } from '../infrastructure/bus';
import type { InMemoryEventStore } from '../infrastructure/event-store/memory';

export class TestFramework<TEvent extends IEvent, TAggregate extends Aggregate<any, TEvent, string, AggregateId>> {
  public commandBus!: CommandBus;
  public queryBus!: QueryBus;
  public eventBus!: EventBus<TEvent>;
  public eventStore!: InMemoryEventStore<TEvent>;

  constructor() {}

  async setup() {
    const { commandBus, queryBus, eventBus, eventStore } = await bootstrapFramework<TEvent>();
    this.commandBus = commandBus;
    this.queryBus = queryBus;
    this.eventBus = eventBus;
    this.eventStore = eventStore;
  }

  async getAggregate(repository: AggregateRepository<any, TEvent, AggregateId, TAggregate>, id: AggregateId): Promise<TAggregate | null> {
    return repository.get(id);
  }

  async saveAggregate(repository: AggregateRepository<any, TEvent, AggregateId, TAggregate>, aggregate: TAggregate): Promise<void> {
    await repository.save(aggregate);
  }
} 