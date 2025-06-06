import { Test, TestingModule } from '@nestjs/testing';
import fs from 'fs';
import path from 'path';
import { ConfigService } from '@nestjs/config';
import { ReportsService } from '../../../src/reports/reports.service';

describe('ReportsService Integration', () => {
  let service: ReportsService;

  // Mock ConfigService for testing
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      if (key === 'reports.tmpDir') return 'tmp';
      if (key === 'reports.outputDir') return 'out';
      if (key === 'reports.parallelProcessing') return true;
      return defaultValue;
    })
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    
    // Reset the service states
    service['states'] = {
      accounts: 'idle',
      yearly: 'idle',
      fs: 'idle',
    };
    
    // Reset metrics
    service['metrics'] = {
      lastRunTime: {
        accounts: 0,
        yearly: 0,
        fs: 0,
        total: 0
      },
      averageRunTime: {
        accounts: 0,
        yearly: 0,
        fs: 0,
        total: 0
      },
      runs: 0,
      lastRun: null,
    };
    
    // Ensure output directory exists
    if (!fs.existsSync('out')) {
      fs.mkdirSync('out');
    }
    
    // Create mock CSV data for testing
    const tmpDir = 'tmp';
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }
    
    // Create a test CSV file
    const testData = [
      '2024-01-01,Cash,,1000,0',
      '2024-01-02,Sales Revenue,,0,500',
      '2024-01-03,Cost of Goods Sold,,200,0',
    ].join('\n');
    
    fs.writeFileSync(path.join(tmpDir, 'test.csv'), testData);
  });

  afterEach(() => {
    // Clean up test files
    const tmpFile = path.join('tmp', 'test.csv');
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  
  it('should provide metrics information', () => {
    const metrics = service.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.runs).toBe(0);
    expect(metrics.lastRun).toBeNull();
  });
  
  describe('Asynchronous processing', () => {
    it('should process reports asynchronously', async () => {
      const result = await service.processReportsAsync();
      expect(result).toBe(true);
      
      // Check metrics
      const metrics = service.getMetrics();
      expect(metrics.runs).toBe(1);
      expect(metrics.lastRun).toBeInstanceOf(Date);
      expect(metrics.lastRunTime.accounts).toBeGreaterThan(0);
      expect(metrics.lastRunTime.yearly).toBeGreaterThan(0);
      expect(metrics.lastRunTime.fs).toBeGreaterThan(0);
      expect(metrics.lastRunTime.total).toBeGreaterThan(0);
    });
    
    it('should update the service states after processing', async () => {
      // Check initial state
      expect(service.state('accounts')).toBe('idle');
      expect(service.state('yearly')).toBe('idle');
      expect(service.state('fs')).toBe('idle');
      
      // Process reports
      await service.processReportsAsync();
      
      // Check updated states
      expect(service.state('accounts')).toContain('finished in');
      expect(service.state('yearly')).toContain('finished in');
      expect(service.state('fs')).toContain('finished in');
    });
    
    it('should process accounts report asynchronously', async () => {
      const result = await service.accountsAsync();
      expect(result).toBe(true);
      
      // Verify output file created
      expect(fs.existsSync('out/accounts.csv')).toBe(true);
      
      // Check contents
      const content = fs.readFileSync('out/accounts.csv', 'utf-8');
      expect(content).toContain('Account,Balance');
    });
    
    it('should process yearly report asynchronously', async () => {
      const result = await service.yearlyAsync();
      expect(result).toBe(true);
      
      // Verify output file created
      expect(fs.existsSync('out/yearly.csv')).toBe(true);
      
      // Check contents
      const content = fs.readFileSync('out/yearly.csv', 'utf-8');
      expect(content).toContain('Financial Year,Cash Balance');
      // Just verify there's some year with cash balance data, not specific values
      expect(content).toMatch(/\d{4},\d+\.\d{2}/);
    });
    
    it('should process financial statements asynchronously', async () => {
      const result = await service.fsAsync();
      expect(result).toBe(true);
      
      // Verify output file created
      expect(fs.existsSync('out/fs.csv')).toBe(true);
      
      // Check contents
      const content = fs.readFileSync('out/fs.csv', 'utf-8');
      expect(content).toContain('Basic Financial Statement');
      expect(content).toContain('Income Statement');
      expect(content).toContain('Balance Sheet');
    });
  });
});
