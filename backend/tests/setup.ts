import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Ensure test environment
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_for_testing_only';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_testing_only';
