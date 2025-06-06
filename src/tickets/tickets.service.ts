import { ConflictException, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

import { IsEnum, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  /**
   * Type of ticket to create
   * @example 'managementReport'
   */
  @ApiProperty({
    description: 'Type of ticket to create',
    enum: TicketType,
    example: TicketType.managementReport
  })
  @IsEnum(TicketType, { message: 'Ticket type must be one of the valid types' })
  type: TicketType;

  /**
   * ID of the company the ticket belongs to
   * @example 1
   */
  @ApiProperty({
    description: 'Company ID that the ticket belongs to',
    example: 1,
    minimum: 1
  })
  @IsNumber({}, { message: 'Company ID must be a number' })
  @IsPositive({ message: 'Company ID must be a positive number' })
  companyId: number;
}

export class TicketResponseDto {
  /**
   * Unique identifier for the ticket
   * @example 1
   */
  @ApiProperty({
    description: 'Unique identifier for the ticket',
    example: 1
  })
  id: number;

  /**
   * Type of the ticket
   * @example 'managementReport'
   */
  @ApiProperty({
    description: 'Type of the ticket',
    enum: TicketType,
    example: TicketType.managementReport
  })
  type: TicketType;

  /**
   * ID of the company the ticket belongs to
   * @example 1
   */
  @ApiProperty({
    description: 'ID of the company this ticket belongs to',
    example: 1
  })
  companyId: number;

  /**
   * ID of the user assigned to handle the ticket
   * @example 2
   */
  @ApiProperty({
    description: 'ID of the user assigned to this ticket',
    example: 2
  })
  assigneeId: number;

  /**
   * Current status of the ticket
   * @example 'open'
   */
  @ApiProperty({
    description: 'Current status of the ticket',
    enum: TicketStatus,
    example: TicketStatus.open
  })
  status: TicketStatus;

  /**
   * Category of the ticket
   * @example 'accounting'
   */
  @ApiProperty({
    description: 'Category of the ticket',
    enum: TicketCategory,
    example: TicketCategory.accounting
  })
  category: TicketCategory;
}

import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { InjectConnection } from '@nestjs/sequelize';

@Injectable()
export class TicketsService {
  
  /**
   * Creates an instance of TicketsService
   * @param sequelize The Sequelize instance for database operations
   */
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize
  ) {}
  /**
   * Create a new ticket according to business rules
   */
  async createTicket(createTicketDto: CreateTicketDto): Promise<TicketResponseDto> {
    const { type, companyId } = createTicketDto;
    
    // Handle the strikeOff ticket type separately
    if (type === TicketType.strikeOff) {
      return await this.createStrikeOffTicket(companyId);
    }
    
    // Handle registrationAddressChange duplicate check
    if (type === TicketType.registrationAddressChange) {
      await this.checkForDuplicateRegistrationTicket(companyId);
    }
    
    // Determine ticket category based on type
    const category = this.determineTicketCategory(type);
    
    // Find appropriate assignee
    const assignee = await this.findAssignee(type, companyId);
    
    // Create and return the ticket
    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });
    
    return this.mapTicketToDto(ticket);
  }
  
  /**
   * Find all tickets
   */
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }
  
  /**
   * Check if a duplicate registration address change ticket exists
   */
  private async checkForDuplicateRegistrationTicket(companyId: number): Promise<void> {
    const existingTicket = await Ticket.findOne({
      where: {
        companyId,
        type: TicketType.registrationAddressChange,
        status: TicketStatus.open,
      },
    });
    
    if (existingTicket) {
      throw new ConflictException(
        'A registration address change ticket already exists for this company.',
      );
    }
  }
  
  /**
   * Determine the appropriate ticket category based on type
   */
  private determineTicketCategory(type: TicketType): TicketCategory {
    switch (type) {
      case TicketType.managementReport:
        return TicketCategory.accounting;
      case TicketType.registrationAddressChange:
        return TicketCategory.corporate;
      case TicketType.strikeOff:
        return TicketCategory.management;
      default:
        throw new Error(`Unknown ticket type: ${type}`);
    }
  }
  
  /**
   * Find the appropriate assignee based on ticket type and business rules
   */
  private async findAssignee(type: TicketType, companyId: number): Promise<User> {
    let userRole: UserRole;
    
    // Determine primary role based on ticket type
    switch (type) {
      case TicketType.managementReport:
        userRole = UserRole.accountant;
        break;
      case TicketType.registrationAddressChange:
        userRole = UserRole.corporateSecretary;
        break;
      case TicketType.strikeOff:
        userRole = UserRole.director;
        break;
      default:
        throw new Error(`Unknown ticket type: ${type}`);
    }
    
    // First try to find users with the primary role
    let assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });
    
    // For registrationAddressChange, try director as fallback if no secretary exists
    if (type === TicketType.registrationAddressChange && !assignees.length) {
      userRole = UserRole.director;
      assignees = await User.findAll({
        where: { companyId, role: userRole },
        order: [['createdAt', 'DESC']],
      });
    }
    
    // If still no assignees, throw an error
    if (!assignees.length) {
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );
    }
    
    // Check for multiple corporate secretaries or directors
    if (
      (userRole === UserRole.corporateSecretary || userRole === UserRole.director) &&
      assignees.length > 1
    ) {
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );
    }
    
    return assignees[0];
  }
  
  /**
   * Create a strikeOff ticket and handle side effects using transaction for data consistency
   * @param companyId ID of the company to create a strikeOff ticket for
   * @returns Created ticket data
   * @throws ConflictException when director cannot be found or multiple directors exist
   */
  private async createStrikeOffTicket(companyId: number): Promise<TicketResponseDto> {
    // Use transaction to ensure all operations are atomic
    return this.sequelize.transaction(async (transaction: Transaction) => {
      try {
        // Find a director to assign the ticket to
        const directors = await User.findAll({
          where: { companyId, role: UserRole.director },
          order: [['createdAt', 'DESC']],
          transaction
        });
        
        // Check if any directors exist
        if (!directors.length) {
          throw new ConflictException(
            `Cannot find user with role ${UserRole.director} to create a strike off ticket`,
          );
        }
        
        // Check if multiple directors exist
        if (directors.length > 1) {
          throw new ConflictException(
            `Multiple users with role ${UserRole.director}. Cannot create a strike off ticket`,
          );
        }
        
        const director = directors[0];
        
        // Create the strikeOff ticket within the transaction
        const ticket = await Ticket.create({
          companyId,
          assigneeId: director.id,
          category: TicketCategory.management,
          type: TicketType.strikeOff,
          status: TicketStatus.open,
        }, { transaction });
        
        // Resolve all other active tickets for this company within the transaction
        await Ticket.update(
          { status: TicketStatus.resolved },
          {
            where: {
              companyId,
              status: TicketStatus.open,
              id: { [Op.ne]: ticket.id },
            },
            transaction
          },
        );
        
        return this.mapTicketToDto(ticket);
      } catch (error) {
        // Transaction will automatically roll back on error
        if (error instanceof ConflictException) {
          // Re-throw business rule exceptions
          throw error;
        }
        
        // Log and wrap other errors
        console.error('Error in createStrikeOffTicket transaction:', error);
        throw new ConflictException('Failed to process strike off ticket. Please try again.');
      }
    });
  }
  
  /**
   * Resolve all other active tickets for a company
   */
  private async resolveOtherCompanyTickets(companyId: number, excludeTicketId: number): Promise<void> {
    await Ticket.update(
      { status: TicketStatus.resolved },
      {
        where: {
          companyId,
          status: TicketStatus.open,
          id: { [Op.ne]: excludeTicketId },
        },
      },
    );
  }
  
  /**
   * Map a Ticket model to a TicketResponseDto
   */
  private mapTicketToDto(ticket: Ticket): TicketResponseDto {
    return {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };
  }
}
