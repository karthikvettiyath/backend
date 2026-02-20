# Electrospot Backend API

Backend API server for Electrospot that connects to AWS RDS MySQL database.

## Prerequisites

- Node.js 18+ installed
- AWS RDS MySQL instance running
- Database tables created (see `database/schema.sql`)

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and update with your RDS credentials:

```bash
cp .env.example .env
```

Edit `.env` with your RDS connection details (see `.env.example` for template):

```env
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=3306
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=electrospot
DB_SSL=false

PORT=3000
JWT_SECRET=your-secret-key-change-this-in-production
```

**Important:** Never commit `.env` file to version control!

### 3. Create Database Tables

Make sure your RDS database has the required tables. See `CREATE_TABLES_GUIDE.md` in the root directory for instructions.

You can run the schema file using:

```bash
mysql -h your-rds-endpoint.region.rds.amazonaws.com \
      -P 3306 \
      -u your-database-user \
      -p \
      electrospot < database/schema.sql
```

### 4. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user (requires auth)

### Charging Stations

- `GET /stations` - Get all charging stations
- `GET /stations/:id` - Get station by ID
- `GET /stations/search?latitude=X&longitude=Y&radius=Z` - Search stations by location

### Bookings

- `POST /bookings` - Create booking (requires auth)
- `GET /bookings` - Get user bookings (requires auth)
- `DELETE /bookings/:id` - Cancel booking (requires auth)

### User Profile

- `GET /users/profile` - Get user profile (requires auth)
- `PUT /users/profile` - Update user profile (requires auth)

### Health Check

- `GET /health` - Check server and database status

## Testing the Connection

### 1. Test Database Connection

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### 2. Test Registration

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Test Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Troubleshooting

### Database Connection Error

1. **Check RDS Security Group:**
   - Ensure port 3306 is open
   - Add your IP address to allowed sources
   - If deploying, add your server's IP/security group

2. **Verify Credentials:**
   - Double-check DB_HOST, DB_USER, DB_PASSWORD in `.env`
   - Ensure database name exists: `electrospot`

3. **Test Connection Manually:**
   ```bash
   mysql -h your-rds-endpoint.region.rds.amazonaws.com \
         -P 3306 \
         -u your-database-user \
         -p
   ```

### Port Already in Use

If port 3000 is already in use, change `PORT` in `.env` file.

### Tables Don't Exist

Run the schema file to create tables:
```bash
mysql -h your-rds-endpoint.region.rds.amazonaws.com \
      -P 3306 \
      -u your-database-user \
      -p \
      electrospot < database/schema.sql
```

## Security Notes

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use strong JWT_SECRET** - Generate a random string for production
3. **Enable SSL** - Set `DB_SSL=true` for production connections
4. **Restrict RDS Access** - Only allow connections from your server's IP/security group
5. **Use Environment Variables** - In production, use AWS Secrets Manager or similar

## Deployment

For production deployment:

1. Set environment variables on your hosting platform (AWS EC2, Elastic Beanstalk, etc.)
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name electrospot-api
   ```
3. Enable SSL for database connections
4. Use a strong, random JWT_SECRET
5. Set up proper logging and monitoring

## Next Steps

1. Update Flutter app's `main.dart` to point to your backend URL
2. Test all API endpoints
3. Deploy backend to AWS EC2, Elastic Beanstalk, or similar
4. Update Flutter app with production API URL
