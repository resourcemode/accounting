import { Controller, Get, Post, HttpCode, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Get the current status of all reports
   * @returns Status of all reports and metrics
   */
  @Get()
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
      // Start processing in the background without waiting
      setImmediate(() => {
        this.reportsService.processReportsAsync()
          .catch(error => {
            console.error('Error in background report processing:', error.stack || error.message);
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
