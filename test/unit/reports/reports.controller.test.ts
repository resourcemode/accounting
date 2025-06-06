import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from '../../../src/reports/reports.controller';
import { ReportStatus, ReportType, ReportsService, ReportsStatusResponse } from '../../../src/reports/reports.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MockCacheModule } from '../../../src/cache/test/mock-cache.module';

// Sample report status response
const sampleStatusResponse: ReportsStatusResponse = {
  'accounts.csv': ReportStatus.IDLE,
  'yearly.csv': ReportStatus.IDLE,
  'fs.csv': ReportStatus.IDLE,
  metrics: {
    lastRunTime: { accounts: 0, yearly: 0, fs: 0, total: 0 },
    averageRunTime: { accounts: 0, yearly: 0, fs: 0, total: 0 },
    runs: 0,
    lastRun: null,
  },
};

// Mock ReportsService
const mockReportsService = {
  getReportStatus: jest.fn().mockReturnValue(sampleStatusResponse),
  processReportsAsync: jest.fn().mockResolvedValue(true),
};

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;
  let cacheManager: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MockCacheModule],
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
    cacheManager = module.get(CACHE_MANAGER);

    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset cache
    cacheManager.reset();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
  
  describe('getReportStatus', () => {
    it('should return the current processing state and metrics', () => {
      // Arrange & Act
      const result = controller.getReportStatus();
      
      // Assert
      expect(result).toEqual(sampleStatusResponse);
      expect(mockReportsService.getReportStatus).toHaveBeenCalled();
    });
  });
  
  describe('generateReportsAsync', () => {
    it('should start report processing asynchronously', () => {
      // Arrange & Act
      const result = controller.generateReportsAsync();
      
      // Assert - verify we return the correct response immediately
      expect(result).toEqual({
        message: 'Report generation started in background',
        status: 'processing',
        checkStatusAt: '/api/v1/reports',
      });
      
      // setImmediate will be called but we can't easily verify this in Jest
    });
    
    it('should respond quickly without waiting for processing to complete', () => {
      // Arrange - Record start time
      const startTime = performance.now();
      
      // Act - Call the endpoint
      controller.generateReportsAsync();
      
      // Assert - Calculate response time
      const responseTime = performance.now() - startTime;
      
      // Response should be very quick (under 50ms)
      expect(responseTime).toBeLessThan(50);
      
      // The service method should not have been called synchronously
      expect(mockReportsService.processReportsAsync).not.toHaveBeenCalled();
    });
  });
});
