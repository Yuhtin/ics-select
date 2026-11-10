import { BadRequestException } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';

const user = { sub: 'm1', role: 'MEMBER' } as any;
const base = { title: 'T', type: 'INTERNSHIP', companyName: 'C' };

describe('OpportunitiesController', () => {
  const service = { create: jest.fn(), update: jest.fn(), list: jest.fn() };
  const ctrl = new OpportunitiesController(service as any);
  beforeEach(() => jest.clearAllMocks());

  it.each(['javascript:alert(1)', 'www.x.com'])('rejects link url %s with 400', (url) => {
    expect(() => ctrl.create(user, { ...base, links: [{ label: 'x', url }] })).toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('passes a valid partial update through', () => {
    ctrl.update(user, 'o1', { title: 'New' });
    expect(service.update).toHaveBeenCalledWith(user, 'o1', { title: 'New' });
  });

  it('ignores a repeated interestedBy param', () => {
    ctrl.list(user, ['a', 'b']);
    expect(service.list).toHaveBeenCalledWith(user, { interestedBy: undefined });
  });
});
