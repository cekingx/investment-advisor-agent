import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let configService: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue('fake-bot-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should delegate to bot.telegram.sendMessage with Markdown', async () => {
      const sendMessageSpy = jest
        .spyOn((service as any).bot.telegram, 'sendMessage')
        .mockResolvedValue({ message_id: 1, date: 1, chat: { id: 12345, type: 'private' } } as any);

      await service.sendMessage(12345, 'Hello *world*');

      expect(sendMessageSpy).toHaveBeenCalledWith(12345, 'Hello *world*', {
        parse_mode: 'Markdown',
      });

      sendMessageSpy.mockRestore();
    });
  });

  describe('sendErrorNotification', () => {
    it('should send generic message when no error provided', async () => {
      const sendMessageSpy = jest
        .spyOn((service as any).bot.telegram, 'sendMessage')
        .mockResolvedValue({ message_id: 1, date: 1, chat: { id: 12345, type: 'private' } } as any);

      await service.sendErrorNotification(12345);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        12345,
        '⚠️ Analysis failed. Will retry at the next scheduled run.',
      );

      sendMessageSpy.mockRestore();
    });

    it('should include error detail when provided', async () => {
      const sendMessageSpy = jest
        .spyOn((service as any).bot.telegram, 'sendMessage')
        .mockResolvedValue({ message_id: 1, date: 1, chat: { id: 12345, type: 'private' } } as any);

      await service.sendErrorNotification(12345, 'LLM timed out');

      expect(sendMessageSpy).toHaveBeenCalledWith(
        12345,
        '⚠️ Analysis failed: LLM timed out. Will retry at the next scheduled run.',
      );

      sendMessageSpy.mockRestore();
    });
  });
});
