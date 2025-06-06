import { Controller, Get, Post, HttpCode, HttpStatus, InternalServerErrorException, UseInterceptors, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ReportType, ReportsService, ReportsStatusResponse } from './reports.service';

/**
 * Response format for asynchronous report processing
 */
export class AsyncProcessingResponse {
  /**
   * Descriptive message about the processing
   * @example 'Report generation started in background'
   */
  message: string;
  
  /**
   * Current status of the request
   * @example 'processing'
   */
  status: string;
  
  /**
   * URL where status can be checked
   * @example '/api/v1/reports'
   */
  checkStatusAt: string;
}

@ApiTags('reports')
@Controller('api/v1/reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  /**
   * Get the current status of all reports
   * @returns Status of all reports and metrics
   */
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('reports-status')
  @CacheTTL(3600) // Cache for 1 hour (3600 seconds)
  @ApiOperation({ summary: 'Get current status of all reports' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Reports status retrieved successfully',
    type: ReportsStatusResponse 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  getReportStatus(): ReportsStatusResponse {
    try {
      return this.reportsService.getReportStatus();
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve report status');
    }
  }

  /**
   * Start asynchronous report generation
   * @returns Immediate response with processing information
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // 202 Accepted - Processing started but not completed
  @ApiOperation({ summary: 'Start asynchronous report generation' })
  @ApiResponse({ 
    status: HttpStatus.ACCEPTED, 
    description: 'Report generation started successfully',
    type: AsyncProcessingResponse 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Failed to initiate report generation' 
  })
  generateReportsAsync(): AsyncProcessingResponse {
    try {
      // Invalidate the cache immediately so that next call to getReportStatus shows 'processing'
      this.cacheManager.del('reports-status');
      
      // Start processing in the background without waiting
      setImmediate(() => {
        this.reportsService.processReportsAsync()
          .catch(error => {
            console.error('Error in background report processing:', error.stack || error.message);
          })
          .finally(() => {
            // Invalidate the cache again after processing is done
            // to ensure the next getReportStatus call shows fresh results
            this.cacheManager.del('reports-status');
          });
      });
      
      // Return immediately with status information
      return { 
        message: 'Report generation started in background', 
        status: 'processing',
        checkStatusAt: '/api/v1/reports'
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to initiate report processing');
    }
  }
}
