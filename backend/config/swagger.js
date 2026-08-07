const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Library Lending System API',
      version: '1.0.0',
      description: 'REST API for Library Lending System - A web-based application to automate library operations',
      contact: {
        name: 'API Support',
        email: 'support@librarysystem.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['user', 'admin'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Book: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            author: { type: 'string' },
            isbn: { type: 'string' },
            quantity: { type: 'integer' },
            available_quantity: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        LendingRecord: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            book_id: { type: 'integer' },
            borrowed_date: { type: 'string', format: 'date' },
            due_date: { type: 'string', format: 'date' },
            returned_date: { type: 'string', format: 'date', nullable: true },
            fine_amount: { type: 'number', format: 'decimal' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js'] // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

