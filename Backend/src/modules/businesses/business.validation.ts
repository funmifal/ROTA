export interface CreateBusinessInput {
  name: string;
  industry?: string;
  country?: string;
  timezone?: string;
}

export interface UpdateBusinessInput {
  name?: string;
  industry?: string;
  country?: string;
  timezone?: string;
}

// IANA timezone validation
export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateCreateBusinessInput(input: any): CreateBusinessInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid request payload.');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length < 2 || name.length > 100) {
    throw new Error('Business name must be between 2 and 100 characters.');
  }

  let timezone = typeof input.timezone === 'string' ? input.timezone.trim() : 'Africa/Lagos';
  if (!isValidIanaTimezone(timezone)) {
    throw new Error(`Invalid IANA timezone identifier: "${timezone}". Examples: "Africa/Lagos", "Europe/London", "America/New_York".`);
  }

  return {
    name,
    industry: typeof input.industry === 'string' ? input.industry.trim() : undefined,
    country: typeof input.country === 'string' ? input.country.trim() : undefined,
    timezone,
  };
}

export function validateUpdateBusinessInput(input: any): UpdateBusinessInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid request payload.');
  }

  const validated: UpdateBusinessInput = {};

  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length < 2 || name.length > 100) {
      throw new Error('Business name must be between 2 and 100 characters.');
    }
    validated.name = name;
  }

  if (input.industry !== undefined) {
    validated.industry = typeof input.industry === 'string' ? input.industry.trim() : undefined;
  }

  if (input.country !== undefined) {
    validated.country = typeof input.country === 'string' ? input.country.trim() : undefined;
  }

  if (input.timezone !== undefined) {
    const tz = typeof input.timezone === 'string' ? input.timezone.trim() : '';
    if (!isValidIanaTimezone(tz)) {
      throw new Error(`Invalid IANA timezone identifier: "${tz}".`);
    }
    validated.timezone = tz;
  }

  return validated;
}
