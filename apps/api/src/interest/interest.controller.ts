import { Controller } from '@nestjs/common';

// Deprecated module — being removed in a later task (waitlist module wiring).
// The WaitlistEntry table replaced InterestSubmission.
@Controller('interest')
export class InterestController {}
