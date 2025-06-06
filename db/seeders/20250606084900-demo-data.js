'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 3 sample companies
    const companies = await queryInterface.bulkInsert(
      'companies',
      [
        {
          name: 'Acme Corp',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Globex Industries',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Wayne Enterprises',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      { returning: true }
    );

    // Add users with different roles
    const users = await queryInterface.bulkInsert(
      'users',
      [
        {
          name: 'John Director',
          role: 'director',
          companyId: 1, // Acme Corp
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Mary Accountant',
          role: 'accountant',
          companyId: 1, // Acme Corp
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'James Admin',
          role: 'corporateSecretary', // Using a valid enum value from UserRole
          companyId: 1, // Acme Corp
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Linda Director',
          role: 'director',
          companyId: 2, // Globex Industries
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Bruce Wayne',
          role: 'director',
          companyId: 3, // Wayne Enterprises
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      { returning: true }
    );

    // Add various tickets
    return queryInterface.bulkInsert(
      'tickets',
      [
        {
          type: 'managementReport',
          status: 'open',
          category: 'accounting',
          companyId: 1, // Acme Corp
          assigneeId: 2, // Mary Accountant
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'registrationAddressChange',
          status: 'open',
          category: 'registrationAddressChange',
          companyId: 2, // Globex Industries
          assigneeId: 4, // Linda Director
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'managementReport',
          status: 'resolved',
          category: 'accounting',
          companyId: 3, // Wayne Enterprises
          assigneeId: 5, // Bruce Wayne
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'managementReport',
          status: 'open',
          category: 'accounting',
          companyId: 1, // Acme Corp
          assigneeId: 1, // John Director
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          type: 'registrationAddressChange',
          status: 'resolved',
          category: 'registrationAddressChange',
          companyId: 3, // Wayne Enterprises
          assigneeId: 5, // Bruce Wayne
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove all seeded data in reverse order
    await queryInterface.bulkDelete('tickets', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('companies', null, {});
  }
};
