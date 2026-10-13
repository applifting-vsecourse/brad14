import { BadRequestException } from '@nestjs/common';

export function normalizePollOptions(options: string[]): string[] {
  const normalized = options.map((option) => option.trim());
  const errors: { field: string; message: string }[] = [];
  if (options.length < 2 || options.length > 6)
    errors.push({ field: 'poll.options', message: 'Use 2–6 answers' });
  const seen = new Set<string>();
  normalized.forEach((label, index) => {
    const field = `poll.options.${index}`;
    if (!label.length || label.length > 100)
      errors.push({ field, message: 'Use 1–100 characters' });
    if (seen.has(label.toLowerCase()))
      errors.push({ field, message: 'Answers must be different' });
    seen.add(label.toLowerCase());
  });
  if (errors.length)
    throw new BadRequestException({
      message: 'Check the poll answers',
      fieldErrors: errors,
    });
  return normalized;
}
