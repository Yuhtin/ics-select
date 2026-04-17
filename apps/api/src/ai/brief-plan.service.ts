import { Injectable } from '@nestjs/common';
import { DraftPlanService } from './draft-plan.service.js';

@Injectable()
export class BriefPlanService {
  constructor(private readonly draft: DraftPlanService) {}

  run(input: {
    memberId: string;
    weekStart: Date;
    weekEnd: Date;
    briefText: string;
    carryOverItemIds?: string[];
  }) {
    return this.draft.run(input);
  }
}
