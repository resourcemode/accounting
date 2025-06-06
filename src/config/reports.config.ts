import { registerAs } from '@nestjs/config';

/**
 * Reports module configuration
 */
export interface ReportsConfig {
  /**
   * Directory for temporary files
   */
  tmpDir: string;
  
  /**
   * Directory for output reports
   */
  outputDir: string;
  
  /**
   * Whether to process reports in parallel
   */
  parallelProcessing: boolean;
}

export default registerAs('reports', (): ReportsConfig => ({
  tmpDir: process.env.REPORTS_TMP_DIR || 'tmp',
  outputDir: process.env.REPORTS_OUTPUT_DIR || 'out',
  parallelProcessing: process.env.REPORTS_PARALLEL_PROCESSING !== 'false'
}));
