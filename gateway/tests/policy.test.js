import { createUserApiPolicy } from '../src/features/policy/user-api.policy.js';

describe('User API policy', () => {
  const evaluate = createUserApiPolicy();

  test('allows a token with a sub and uses it as the verified user', () => {
    expect(evaluate({ claims: { sub: 'user-abc', email: 'abc@example.com' } })).toEqual({
      allow: true,
      verifiedUser: 'user-abc',
    });
  });

  test('falls back to email when there is no sub', () => {
    expect(evaluate({ claims: { email: 'abc@example.com' } })).toEqual({
      allow: true,
      verifiedUser: 'abc@example.com',
    });
  });

  test('denies with 401 when the token carries no identity claim', () => {
    const decision = evaluate({ claims: { scope: 'read:users' } });
    expect(decision.allow).toBe(false);
    expect(decision.status).toBe(401);
  });

  test('denies when there are no claims at all', () => {
    expect(evaluate({ claims: undefined }).allow).toBe(false);
  });

  test('identity claim order is configurable', () => {
    const emailFirst = createUserApiPolicy({ identityClaims: ['email', 'sub'] });
    expect(emailFirst({ claims: { sub: 'user-abc', email: 'abc@example.com' } }).verifiedUser).toBe(
      'abc@example.com'
    );
  });
});
