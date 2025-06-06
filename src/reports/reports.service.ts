import { Injectable, Logger } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { promises as fsPromises } from 'fs';

/**
 * Constants for report processing status states
 */
export const ReportStatus = {
  IDLE: 'idle',
  PROCESSING: 'starting',
  FINISHED: 'finished', // This is a prefix, actual value includes timing details
  ERROR: 'error' // This is a prefix, actual value includes error details
} as const;

/**
 * Generic type for report processing status (can be any string)
 */
export type ReportProcessingStatus = string;

/**
 * Report types
 */
export enum ReportType {
  ACCOUNTS = 'accounts',
  YEARLY = 'yearly',
  FINANCIAL_STATEMENTS = 'fs'
}

/**
 * Runtime metrics for a single report type
 */
export class ReportTimeMetrics {
  /**
   * Processing time for accounts report in milliseconds
   * @example 1234.56
   */
  accounts: number;

  /**
   * Processing time for yearly report in milliseconds
   * @example 2345.67
   */
  yearly: number;

  /**
   * Processing time for financial statements report in milliseconds
   * @example 3456.78
   */
  fs: number;

  /**
   * Total processing time across all reports in milliseconds
   * @example 7890.12
   */
  total: number;
}

/**
 * Performance metrics for report generation
 */
export class ReportMetrics {
  /**
   * Time taken for most recent report generation run in milliseconds
   */
  lastRunTime: ReportTimeMetrics;

  /**
   * Average time taken across all report generation runs in milliseconds
   */
  averageRunTime: ReportTimeMetrics;

  /**
   * Number of report generation runs performed
   * @example 42
   */
  runs: number;

  /**
   * Timestamp of the last report generation run
   * @example "2025-06-05T23:55:00.000Z"
   */
  lastRun: Date | null;
}

/**
 * Status response for all reports
 */
export class ReportsStatusResponse {
  /**
   * Accounts report status
   * @example 'idle' or 'processing' or 'finished in 1.23s'
   */
  'accounts.csv': string;
  
  /**
   * Yearly report status
   * @example 'idle' or 'processing' or 'finished in 2.34s'
   */
  'yearly.csv': string;
  
  /**
   * Financial statements report status
   * @example 'idle' or 'processing' or 'finished in 3.45s'
   */
  'fs.csv': string;
  
  /**
   * Performance metrics for report generation
   */
  metrics: ReportMetrics;
  
  /**
   * Allow additional dynamic properties
   */
  [key: string]: string | ReportMetrics;
}

import { ConfigService } from '@nestjs/config';
import { ReportsConfig } from '../config/reports.config';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly TMP_DIR: string;
  private readonly OUTPUT_DIR: string;
  private readonly PARALLEL_PROCESSING: boolean;
  
  // Using Record<string, string> to allow for dynamic status strings that can change during processing
  private states: Record<string, string> = {
    [ReportType.ACCOUNTS]: ReportStatus.IDLE,
    [ReportType.YEARLY]: ReportStatus.IDLE,
    [ReportType.FINANCIAL_STATEMENTS]: ReportStatus.IDLE,
  };

  /**
   * Creates an instance of ReportsService.
   * @param configService Injected configuration service
   */
  constructor(private readonly configService: ConfigService) {
    // Get configuration values with fallbacks
    this.TMP_DIR = this.configService.get<string>('reports.tmpDir', 'tmp');
    this.OUTPUT_DIR = this.configService.get<string>('reports.outputDir', 'out');
    this.PARALLEL_PROCESSING = this.configService.get<boolean>('reports.parallelProcessing', true);
    
    // Ensure directories exist
    this.ensureDirectoriesExist();
    
    this.logger.log(`Reports service initialized with tmp: ${this.TMP_DIR}, output: ${this.OUTPUT_DIR}`);
  }
  
  /**
   * Ensures that required directories exist
   */
  private ensureDirectoriesExist(): void {
    try {
      // Check and create directories if they don't exist
      for (const dir of [this.TMP_DIR, this.OUTPUT_DIR]) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          this.logger.log(`Created directory: ${dir}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to create directories: ${error.message}`);
    }
  }

  // Track metrics for performance monitoring
  private metrics: ReportMetrics = {
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

  /**
   * Get the current status of a report
   * @param scope Type of report to get status for
   * @returns Current status as a string
   */
  state(scope: string): string {
    return this.states[scope];
  }
  
  /**
   * Get all report statuses
   * @returns Current status of all reports
   */
  getReportStatus(): ReportsStatusResponse {
    return {
      'accounts.csv': this.state(ReportType.ACCOUNTS),
      'yearly.csv': this.state(ReportType.YEARLY),
      'fs.csv': this.state(ReportType.FINANCIAL_STATEMENTS),
      'metrics': this.getMetrics(),
    };
  }
  
  /**
   * Returns the current metrics for report processing
   * @returns Performance metrics data
   */
  getMetrics(): ReportMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Process all reports asynchronously
   * @returns Whether processing completed successfully
   */
  async processReportsAsync(): Promise<boolean> {
    const startTime = performance.now();
    this.logger.log('Starting async report processing');
    
    try {
      if (this.PARALLEL_PROCESSING) {
        // Run each report generation in parallel using Promise.all
        this.logger.log('Processing reports in parallel mode');
        await Promise.all([
          this.accountsAsync(),
          this.yearlyAsync(),
          this.fsAsync()
        ]);
      } else {
        // Process reports sequentially for systems with limited resources
        this.logger.log('Processing reports sequentially');
        await this.accountsAsync();
        await this.yearlyAsync();
        await this.fsAsync();
      }
      
      // Update total metrics
      const totalTime = performance.now() - startTime;
      this.metrics.lastRunTime.total = totalTime;
      
      // Update average run time
      this.metrics.averageRunTime.total = 
        (this.metrics.averageRunTime.total * this.metrics.runs + totalTime) / (this.metrics.runs + 1);
      
      // Update general metrics
      this.metrics.runs++;
      this.metrics.lastRun = new Date();
      
      this.logger.log(`Report processing completed in ${(totalTime/1000).toFixed(2)}s`);
      return true;
    } catch (error) {
      this.logger.error('Error processing reports:', error);
      return false;
    }
  }
  
  /**
   * Asynchronous version of accounts report
   */
  async accountsAsync() {
    this.states.accounts = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/accounts.csv';
    const accountBalances: Record<string, number> = {};
    
    try {
      // Get list of files asynchronously
      const files = await fsPromises.readdir(tmpDir);
      const csvFiles = files.filter(file => file.endsWith('.csv'));
      
      // Process files in parallel
      await Promise.all(csvFiles.map(async (file) => {
        const content = await fsPromises.readFile(path.join(tmpDir, file), 'utf-8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');
          if (!accountBalances[account]) {
            accountBalances[account] = 0;
          }
          accountBalances[account] +=
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      }));
      
      const output = ['Account,Balance'];
      for (const [account, balance] of Object.entries(accountBalances)) {
        output.push(`${account},${balance.toFixed(2)}`);
      }
      
      await fsPromises.writeFile(outputFile, output.join('\n'));
      
      const processTime = performance.now() - start;
      this.states.accounts = `finished in ${(processTime / 1000).toFixed(2)} seconds`;
      
      // Track metrics
      this.metrics.lastRunTime.accounts = processTime;
      this.metrics.averageRunTime.accounts = 
        (this.metrics.averageRunTime.accounts * this.metrics.runs + processTime) / 
        (this.metrics.runs + 1);
        
      return true;
    } catch (error) {
      this.states.accounts = `error: ${error.message}`;
      return false;
    }
  }

  accounts() {
    this.states.accounts = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/accounts.csv';
    const accountBalances: Record<string, number> = {};
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv')) {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');
        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');
          if (!accountBalances[account]) {
            accountBalances[account] = 0;
          }
          accountBalances[account] +=
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      }
    });
    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }
    fs.writeFileSync(outputFile, output.join('\n'));
    this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  /**
   * Asynchronous version of yearly report
   */
  async yearlyAsync() {
    this.states.yearly = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/yearly.csv';
    const cashByYear: Record<string, number> = {};
    
    try {
      // Get list of files asynchronously
      const files = await fsPromises.readdir(tmpDir);
      const csvFiles = files.filter(file => file.endsWith('.csv') && file !== 'yearly.csv');
      
      // Process files in parallel
      await Promise.all(csvFiles.map(async (file) => {
        const content = await fsPromises.readFile(path.join(tmpDir, file), 'utf-8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          const [date, account, , debit, credit] = line.split(',');
          if (account === 'Cash') {
            const year = new Date(date).getFullYear();
            if (!cashByYear[year]) {
              cashByYear[year] = 0;
            }
            cashByYear[year] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }));
      
      const output = ['Financial Year,Cash Balance'];
      Object.keys(cashByYear)
        .sort()
        .forEach((year) => {
          output.push(`${year},${cashByYear[year].toFixed(2)}`);
        });
      
      await fsPromises.writeFile(outputFile, output.join('\n'));
      
      const processTime = performance.now() - start;
      this.states.yearly = `finished in ${(processTime / 1000).toFixed(2)} seconds`;
      
      // Track metrics
      this.metrics.lastRunTime.yearly = processTime;
      this.metrics.averageRunTime.yearly = 
        (this.metrics.averageRunTime.yearly * this.metrics.runs + processTime) / 
        (this.metrics.runs + 1);
      
      return true;
    } catch (error) {
      this.states.yearly = `error: ${error.message}`;
      return false;
    }
  }

  yearly() {
    this.states.yearly = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/yearly.csv';
    const cashByYear: Record<string, number> = {};
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv') && file !== 'yearly.csv') {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');
        for (const line of lines) {
          const [date, account, , debit, credit] = line.split(',');
          if (account === 'Cash') {
            const year = new Date(date).getFullYear();
            if (!cashByYear[year]) {
              cashByYear[year] = 0;
            }
            cashByYear[year] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    });
    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });
    fs.writeFileSync(outputFile, output.join('\n'));
    this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  /**
   * Asynchronous version of financial statement report
   */
  async fsAsync() {
    this.states.fs = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/fs.csv';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };
    
    try {
      // Initialize balances for all accounts
      const balances: Record<string, number> = {};
      for (const section of Object.values(categories)) {
        for (const group of Object.values(section)) {
          for (const account of group) {
            balances[account] = 0;
          }
        }
      }
      
      // Get list of files asynchronously
      const files = await fsPromises.readdir(tmpDir);
      const csvFiles = files.filter(file => file.endsWith('.csv') && file !== 'fs.csv');
      
      // Process files in parallel
      await Promise.all(csvFiles.map(async (file) => {
        const content = await fsPromises.readFile(path.join(tmpDir, file), 'utf-8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');
          
          if (balances.hasOwnProperty(account)) {
            balances[account] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }));
      
      // Generate the report
      const output: string[] = [];
      output.push('Basic Financial Statement');
      output.push('');
      output.push('Income Statement');
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      for (const account of categories['Income Statement']['Revenues']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalRevenue += value;
      }
      
      for (const account of categories['Income Statement']['Expenses']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalExpenses += value;
      }
      
      output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
      output.push('');
      output.push('Balance Sheet');
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      
      output.push('Assets');
      for (const account of categories['Balance Sheet']['Assets']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalAssets += value;
      }
      output.push(`Total Assets,${totalAssets.toFixed(2)}`);
      output.push('');
      
      output.push('Liabilities');
      for (const account of categories['Balance Sheet']['Liabilities']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalLiabilities += value;
      }
      output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
      output.push('');
      
      output.push('Equity');
      for (const account of categories['Balance Sheet']['Equity']) {
        const value = balances[account] || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalEquity += value;
      }
      output.push(
        `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
      );
      totalEquity += totalRevenue - totalExpenses;
      output.push(`Total Equity,${totalEquity.toFixed(2)}`);
      output.push('');
      output.push(
        `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
      );
      
      await fsPromises.writeFile(outputFile, output.join('\n'));
      
      const processTime = performance.now() - start;
      this.states.fs = `finished in ${(processTime / 1000).toFixed(2)} seconds`;
      
      // Track metrics
      this.metrics.lastRunTime.fs = processTime;
      this.metrics.averageRunTime.fs = 
        (this.metrics.averageRunTime.fs * this.metrics.runs + processTime) / 
        (this.metrics.runs + 1);
        
      return true;
    } catch (error) {
      this.states.fs = `error: ${error.message}`;
      return false;
    }
  }

  fs() {
    this.states.fs = 'starting';
    const start = performance.now();
    const tmpDir = 'tmp';
    const outputFile = 'out/fs.csv';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };
    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }
    fs.readdirSync(tmpDir).forEach((file) => {
      if (file.endsWith('.csv') && file !== 'fs.csv') {
        const lines = fs
          .readFileSync(path.join(tmpDir, file), 'utf-8')
          .trim()
          .split('\n');

        for (const line of lines) {
          const [, account, , debit, credit] = line.split(',');

          if (balances.hasOwnProperty(account)) {
            balances[account] +=
              parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
          }
        }
      }
    });

    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );
    fs.writeFileSync(outputFile, output.join('\n'));
    this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }
}
