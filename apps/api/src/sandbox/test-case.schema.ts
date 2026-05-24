import { z } from 'zod';

/**
 * Shape of a single test case persisted in LibraryItem.testCases.
 * Validated at the API boundary (admin PATCH endpoint), then re-read by
 * the test runner without further validation since the row is trusted.
 *
 * `hidden` cases show the name to the member but withhold input/output —
 * useful for hard graders where the admin wants to prevent the member
 * from gaming the assertion by hardcoding outputs.
 */
export const TestCaseSchema = z
  .object({
    name: z.string().min(1).max(60),
    stdin: z.string().max(8192),
    expectedStdout: z.string().max(8192),
    hidden: z.boolean().optional(),
  })
  .strict();

export type TestCase = z.infer<typeof TestCaseSchema>;

export const TestCasesPayloadSchema = z
  .object({
    testCases: z.array(TestCaseSchema).max(30),
    testCasesLanguages: z
      .array(z.enum(['PYTHON', 'CPP']))
      .max(2),
  })
  .strict();
