const mockCollectBiRate = jest.fn();
const mockCollectFred = jest.fn();
const mockCollectIdxPrices = jest.fn();
const mockFetchSubscribedUsers = jest.fn();
const mockStartChild = jest.fn();
const mockAnalyzeDailyWorkflow = jest.fn();

jest.mock('@temporalio/workflow', () => ({
  proxyActivities: jest.fn(() => ({
    collectBiRate: mockCollectBiRate,
    collectFred: mockCollectFred,
    collectIdxPrices: mockCollectIdxPrices,
    fetchSubscribedUsers: mockFetchSubscribedUsers,
  })),
  startChild: mockStartChild,
}));

jest.mock('./analyze.workflow', () => ({
  analyzeDailyWorkflow: mockAnalyzeDailyWorkflow,
}));

import { collectDailyWorkflow } from './collect.workflow';

describe('collectDailyWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollectBiRate.mockResolvedValue(undefined);
    mockCollectFred.mockResolvedValue(undefined);
    mockCollectIdxPrices.mockResolvedValue(undefined);
    mockFetchSubscribedUsers.mockResolvedValue([]);
    mockStartChild.mockResolvedValue(undefined);
  });

  it('should call all three collection activities', async () => {
    await collectDailyWorkflow();

    expect(mockCollectBiRate).toHaveBeenCalledTimes(1);
    expect(mockCollectFred).toHaveBeenCalledTimes(1);
    expect(mockCollectIdxPrices).toHaveBeenCalledTimes(1);
  });

  it('should call activities in order: biRate → fred → idxPrices', async () => {
    await collectDailyWorkflow();

    const biRateOrder = mockCollectBiRate.mock.invocationCallOrder[0];
    const fredOrder = mockCollectFred.mock.invocationCallOrder[0];
    const idxOrder = mockCollectIdxPrices.mock.invocationCallOrder[0];

    expect(biRateOrder).toBeLessThan(fredOrder);
    expect(fredOrder).toBeLessThan(idxOrder);
  });

  it('should fetch subscribed users after all collectors finish', async () => {
    await collectDailyWorkflow();

    const idxOrder = mockCollectIdxPrices.mock.invocationCallOrder[0];
    const fetchOrder = mockFetchSubscribedUsers.mock.invocationCallOrder[0];

    expect(idxOrder).toBeLessThan(fetchOrder);
  });

  it('should spawn one child workflow per subscribed user', async () => {
    mockFetchSubscribedUsers.mockResolvedValue([111, 222, 333]);

    await collectDailyWorkflow();

    expect(mockStartChild).toHaveBeenCalledTimes(3);
  });

  it('should pass correct chatId to each child workflow', async () => {
    mockFetchSubscribedUsers.mockResolvedValue([111, 222]);

    await collectDailyWorkflow();

    expect(mockStartChild).toHaveBeenCalledWith(
      mockAnalyzeDailyWorkflow,
      expect.objectContaining({ args: [111] }),
    );
    expect(mockStartChild).toHaveBeenCalledWith(
      mockAnalyzeDailyWorkflow,
      expect.objectContaining({ args: [222] }),
    );
  });

  it('should assign unique workflow IDs to each child', async () => {
    mockFetchSubscribedUsers.mockResolvedValue([111, 222]);

    await collectDailyWorkflow();

    const [call1, call2] = mockStartChild.mock.calls;
    expect(call1[1].workflowId).not.toBe(call2[1].workflowId);
  });

  it('should embed chatId in the child workflow ID', async () => {
    mockFetchSubscribedUsers.mockResolvedValue([555]);

    await collectDailyWorkflow();

    const workflowId: string = mockStartChild.mock.calls[0][1].workflowId;
    expect(workflowId).toContain('555');
  });

  it('should not start any child workflows when no users are subscribed', async () => {
    mockFetchSubscribedUsers.mockResolvedValue([]);

    await collectDailyWorkflow();

    expect(mockStartChild).not.toHaveBeenCalled();
  });
});
