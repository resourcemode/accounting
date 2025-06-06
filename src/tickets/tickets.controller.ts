import { Body, Controller, Get, Post, ValidationPipe, HttpStatus, InternalServerErrorException, NotFoundException, UseInterceptors, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TicketType } from '../../db/models/Ticket';
import { CreateTicketDto, TicketResponseDto, TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller('api/v1/tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}
  
  /**
   * Get all tickets
   * @returns List of all tickets
   */
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('all-tickets')
  @CacheTTL(3600) // Cache for 1 hour (3600 seconds)
  @ApiOperation({ summary: 'Get all tickets' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Tickets retrieved successfully',
    type: [TicketResponseDto]
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'No tickets found' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async findAll(): Promise<TicketResponseDto[]> {
    try {
      const tickets = await this.ticketsService.findAll();
      
      if (!tickets || tickets.length === 0) {
        throw new NotFoundException('No tickets found');
      }
      
      return tickets;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve tickets');
    }
  }

  /**
   * Create a new ticket
   * @param createTicketDto Data required to create a ticket
   * @returns The created ticket
   */
  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Ticket successfully created',
    type: TicketResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Ticket already exists or cannot be created due to business rules' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Internal server error' 
  })
  async create(
    @Body(new ValidationPipe({ 
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })) 
    createTicketDto: CreateTicketDto
  ): Promise<TicketResponseDto> {
    try {
      // Create the ticket
      const result = await this.ticketsService.createTicket(createTicketDto);
      
      // Invalidate the cache to ensure fresh data is fetched next time
      await this.cacheManager.del('all-tickets');
      
      return result;
    } catch (error) {
      // Re-throw NestJS exceptions as they already have proper HTTP status codes
      if (error.status) {
        throw error;
      }
      
      // Handle generic errors
      throw new InternalServerErrorException(
        'Failed to create ticket. Please try again later.'
      );
    }
  }
}
